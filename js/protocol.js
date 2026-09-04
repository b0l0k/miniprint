/**
 * Protocole Canon Ivy 2 / Zoemini 2 — porté depuis
 * https://github.com/dtgreene/ivy2
 */

export const START_CODE = 0x430f; // 17167 — requêtes (host → imprimante)
/** Réponses imprimante : nibble bas inversé (`43 f0` observé sur Zoemini 2). */
export const RESPONSE_START_CODE = 0x43f0;
export const FRAME_LEN = 34;
export const PRINT_DATA_CHUNK = 990;
export const PRINT_BATTERY_MIN = 30;

/** @param {number} b0 @param {number} b1 */
export function isFrameMagic(b0, b1) {
  const code = (b0 << 8) | b1;
  return code === START_CODE || code === RESPONSE_START_CODE;
}

export const COMMAND = {
  START_SESSION: 0,
  GET_STATUS: 257,
  SETTING_ACCESSORY: 259,
  PRINT_READY: 769,
  REBOOT: 65535,
};

/**
 * @param {number} command
 * @param {{ flag1?: boolean, flag2?: boolean }} [opts]
 * @returns {Uint8Array}
 */
export function getBaseMessage(command, { flag1 = false, flag2 = false } = {}) {
  const buf = new ArrayBuffer(34);
  const view = new DataView(buf);

  let b1 = 1;
  let b2 = 32;
  if (flag1) {
    b1 = -1;
    b2 = -1;
  }

  // struct ">HhbHB" — same packing as ivy2/task.py
  view.setUint16(0, START_CODE, false);
  view.setInt16(2, b1, false);
  view.setInt8(4, b2);
  view.setUint16(5, command, false);
  view.setUint8(7, flag2 ? 1 : 0);

  return new Uint8Array(buf);
}

export function buildStartSession() {
  return getBaseMessage(COMMAND.START_SESSION, { flag1: true });
}

export function buildGetStatus() {
  return getBaseMessage(COMMAND.GET_STATUS);
}

export function buildGetSetting() {
  return getBaseMessage(COMMAND.SETTING_ACCESSORY);
}

export function buildPrintReady(length, flag = false) {
  const msg = getBaseMessage(COMMAND.PRINT_READY);
  msg[8] = (length >>> 24) & 0xff;
  msg[9] = (length >>> 16) & 0xff;
  msg[10] = (length >>> 8) & 0xff;
  msg[11] = length & 0xff;
  msg[12] = 1;
  msg[13] = flag ? 2 : 1;
  return msg;
}

/**
 * @param {Uint8Array} data
 */
export function parseIncomingMessage(data) {
  const payload = data.slice(8);
  const ack = (data[6] & 255) | ((data[5] & 255) << 8);
  const error = data[7] & 255;
  return { data, payload, ack, error };
}

function parseBitRange(input, size) {
  let bits = "";
  for (let i = 0; i < size; i++) {
    bits += (input >> i) & 1 ? "1" : "0";
  }
  const reversed = bits.split("").reverse().join("");
  return parseInt(reversed, 2) || 0;
}

export function parseStartSession(response) {
  const d = response.data;
  const batteryLevel = parseBitRange((d[9] << 8) | d[10], 6);
  const mtu = ((d[11] & 255) << 8) | (d[12] & 255);
  return { batteryLevel, mtu };
}

export function parseStatus(response) {
  const p = response.payload;
  const i = (p[0] << 8) | p[1];
  const errorCode = p[2];
  const batteryLevel = parseBitRange(i, 6);
  const usbStatus = (i >> 7) & 1;
  const queueFlags = ((p[4] & 255) << 8) | (p[5] & 255);

  return {
    errorCode,
    batteryLevel,
    usbStatus,
    coverOpen: (queueFlags & 1) === 1,
    noPaper: (queueFlags & 2) === 2,
    wrongSmartSheet: (queueFlags & 16) === 16,
  };
}

export function parseSetting(response) {
  const p = response.payload;
  return {
    autoPowerOff: p[0],
    firmwareVersion: `${p[1]}.${p[2]}.${p[3]}`,
    tmdVersion: p[5],
    photosPrinted: (p[6] << 8) | p[7],
    colorId: p[8],
  };
}

export class PrinterError extends Error {
  /** @param {string} code */
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

export function assertPrintWorthy(status) {
  if (status.errorCode !== 0) {
    throw new PrinterError(
      `L'imprimante signale une erreur (${status.errorCode}).`,
      "status_error",
    );
  }
  if (status.batteryLevel < PRINT_BATTERY_MIN) {
    throw new PrinterError(
      `Batterie trop faible (${status.batteryLevel}%). Chargez l'imprimante.`,
      "low_battery",
    );
  }
  if (status.coverOpen) {
    throw new PrinterError("Le couvercle est ouvert.", "cover_open");
  }
  if (status.noPaper) {
    throw new PrinterError("Plus de papier ZINK.", "no_paper");
  }
  if (status.wrongSmartSheet) {
    throw new PrinterError("Mauvaise SMART SHEET détectée.", "wrong_sheet");
  }
}
