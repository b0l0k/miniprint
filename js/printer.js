import {
  COMMAND,
  FRAME_LEN,
  PRINT_DATA_CHUNK,
  assertPrintWorthy,
  buildGetSetting,
  buildGetStatus,
  buildPrintReady,
  buildStartSession,
  isFrameMagic,
  parseIncomingMessage,
  parseSetting,
  parseStartSession,
  parseStatus,
  PrinterError,
} from "./protocol.js?v=5";
import { t } from "./i18n.js?v=1";

/** Serial Port Profile — APK Canon (`SPP_UUID`). */
export const SPP_UUID = "00001101-0000-1000-8000-00805f9b34fb";
export const OPP_UUID = "00001105-0000-1000-8000-00805f9b34fb";

export function serialSupported() {
  return typeof navigator !== "undefined" && "serial" in navigator;
}

function toHex(bytes, max = 64) {
  const slice = bytes.slice(0, max);
  const hex = [...slice].map((b) => b.toString(16).padStart(2, "0")).join(" ");
  return bytes.byteLength > max ? `${hex} …(+${bytes.byteLength - max}o)` : hex;
}

/**
 * Client imprimante via Web Serial (Bluetooth RFCOMM / SPP).
 */
export class ZoeminiPrinter {
  /** @type {SerialPort | null} */
  port = null;
  /** @type {ReadableStreamDefaultReader | null} */
  reader = null;
  /** @type {WritableStreamDefaultWriter | null} */
  writer = null;
  /** @type {Uint8Array} */
  #rx = new Uint8Array(0);
  /** @type {(msg: string, kind?: string) => void} */
  onLog = () => {};
  linkOpen = false;
  handshakeOk = false;
  session = null;
  status = null;
  setting = null;

  get connected() {
    return this.linkOpen && this.handshakeOk;
  }

  get rxPending() {
    return this.#rx;
  }

  /**
   * Une seule invite utilisateur (gesture). Pas de 2e requestPort.
   * @param {{ preferGranted?: boolean }} [opts]
   */
  async pickPort({ preferGranted = true } = {}) {
    if (!serialSupported()) {
      throw new PrinterError(t("printer.noSerial"), "no_serial");
    }

    if (preferGranted) {
      const granted = await navigator.serial.getPorts();
      const bt = granted.filter((p) => {
        const id = p.getInfo?.()?.bluetoothServiceClassId;
        return id === 0x1101 || id === SPP_UUID || id != null;
      });
      if (bt.length === 1) {
        this.onLog(t("printer.reuseBtPort", { id: String(bt[0].getInfo?.()?.bluetoothServiceClassId ?? "BT") }));
        return bt[0];
      }
      if (granted.length === 1) {
        this.onLog(t("printer.reuseSerialPort"));
        return granted[0];
      }
    }

    // Sans filtre strict : Windows expose parfois un COM mappé plutôt que l’UUID SPP.
    // On autorise quand même SPP + OPP pour les ports BT non mappés.
    return navigator.serial.requestPort({
      allowedBluetoothServiceClassIds: [0x1101, SPP_UUID, 0x1105, OPP_UUID],
    });
  }

  /**
   * Ferme un port s’il est encore ouvert (cas fréquent après getPorts()
   * ou un plantage précédent — surtout ChromeOS).
   * @param {SerialPort} port
   */
  async #forceClosePort(port) {
    if (!port || (!port.readable && !port.writable)) return;
    try {
      await port.close();
    } catch (err) {
      this.onLog(t("printer.forceCloseFail", { msg: err.message }), "warn");
    }
  }

  /**
   * Ouvre le port avec retries. Sur ChromeOS un port « déjà autorisé »
   * est souvent encore marqué ouvert / IN_USE.
   * @param {SerialPort} port
   */
  async #openPort(port) {
    const connected = port.connected;
    if (connected === false) {
      this.onLog(t("printer.btNotConnected"), "warn");
    }

    await this.#forceClosePort(port);
    await sleep(350);

    /** @type {SerialOptions[]} */
    const attempts = [
      { baudRate: 9600, bufferSize: 16 * 1024 },
      { baudRate: 9600 },
      { baudRate: 115200 },
    ];

    let lastErr = null;
    for (let i = 0; i < attempts.length; i++) {
      const opts = attempts[i];
      try {
        this.onLog(
          t("printer.opening", {
            n: i + 1,
            total: attempts.length,
            baud: opts.baudRate,
            buf: opts.bufferSize ? `, buf=${opts.bufferSize}` : "",
          }),
        );
        await port.open(opts);
        return;
      } catch (err) {
        lastErr = err;
        this.onLog(t("printer.openFail", { msg: err.message }), "warn");
        await this.#forceClosePort(port);
        await sleep(500 + i * 400);
      }
    }

    throw lastErr ?? new Error("Failed to open serial port");
  }

  /**
   * Ouvre le RFCOMM puis tente le handshake ivy2.
   * En cas d’échec handshake, le lien reste ouvert pour debug / retry.
   * @param {SerialPort} port
   */
  async connect(port) {
    if (this.linkOpen) {
      await this.disconnect().catch(() => {});
      await sleep(400);
    }

    try {
      await this.#openPort(port);
    } catch (err) {
      throw new PrinterError(t("printer.openFailed", { msg: err.message }), "open_failed");
    }

    this.port = port;
    this.writer = port.writable.getWriter();
    this.reader = port.readable.getReader();
    this.#rx = new Uint8Array(0);
    this.linkOpen = true;
    this.handshakeOk = false;
    this.#readLoop();

    const info = port.getInfo?.() ?? {};
    this.onLog(
      t("printer.linkOpen", {
        bt: info.bluetoothServiceClassId ?? "n/a",
        usb: info.usbVendorId ?? "-",
        connected: port.connected ?? "?",
      }),
      "ok",
    );

    // La pile OS/Chrome a souvent besoin d’un court délai après open.
    await sleep(800);

    return this.handshake();
  }

  /** Relance StartSession / Status / Setting sans refermer le port. */
  async handshake() {
    if (!this.linkOpen) {
      throw new PrinterError(t("printer.noLink"), "not_connected");
    }

    this.#rx = new Uint8Array(0);
    this.handshakeOk = false;

    try {
      this.onLog(`TX StartSession: ${toHex(buildStartSession())}`);
      this.session = await this.startSession();
      this.onLog(
        t("printer.sessionOk", { battery: this.session.batteryLevel, mtu: this.session.mtu }),
        "ok",
      );

      this.status = await this.getStatus();
      this.setting = await this.getSetting();
      this.handshakeOk = true;

      return {
        session: this.session,
        status: this.status,
        setting: this.setting,
        info: this.port?.getInfo?.() ?? {},
      };
    } catch (err) {
      const pending = this.#rx.byteLength
        ? toHex(this.#rx)
        : "(aucune donnée reçue)";
      this.onLog(t("printer.rxBuffer", { pending }), "warn");
      throw err;
    }
  }

  async disconnect() {
    this.linkOpen = false;
    this.handshakeOk = false;
    try {
      await this.reader?.cancel();
    } catch {
      /* ignore */
    }
    try {
      this.reader?.releaseLock();
    } catch {
      /* ignore */
    }
    try {
      await this.writer?.close();
    } catch {
      /* ignore */
    }
    try {
      this.writer?.releaseLock();
    } catch {
      /* ignore */
    }
    try {
      await this.port?.close();
    } catch {
      /* ignore */
    }
    this.reader = null;
    this.writer = null;
    this.port = null;
    this.#rx = new Uint8Array(0);
    await sleep(300);
  }

  async startSession() {
    const response = await this.#exchange(
      buildStartSession(),
      COMMAND.START_SESSION,
      12_000,
    );
    return parseStartSession(response);
  }

  async getStatus() {
    const response = await this.#exchange(buildGetStatus(), COMMAND.GET_STATUS);
    this.status = parseStatus(response);
    return this.status;
  }

  async getSetting() {
    const response = await this.#exchange(
      buildGetSetting(),
      COMMAND.SETTING_ACCESSORY,
    );
    this.setting = parseSetting(response);
    return this.setting;
  }

  /**
   * @param {Uint8Array} jpegBytes
   * @param {{ onProgress?: (pct: number) => void, transferTimeoutMs?: number }} [opts]
   */
  async printJpeg(jpegBytes, opts = {}) {
    const { onProgress, transferTimeoutMs = 60_000 } = opts;
    if (!this.connected) {
      throw new PrinterError(t("printer.handshakeIncomplete"), "not_connected");
    }

    const status = await this.getStatus();
    assertPrintWorthy(status);
    await this.getSetting();

    await this.#exchange(
      buildPrintReady(jpegBytes.byteLength),
      COMMAND.PRINT_READY,
    );

    const total = jpegBytes.byteLength;
    let sent = 0;
    while (sent < total) {
      const end = Math.min(sent + PRINT_DATA_CHUNK, total);
      await this.#write(jpegBytes.subarray(sent, end));
      sent = end;
      onProgress?.(Math.round((sent / total) * 100));
      await sleep(20);
    }

    await this.#receive(null, transferTimeoutMs);
    onProgress?.(100);
  }

  async #exchange(message, expectedAck, timeoutMs = 8000) {
    await this.#write(message);
    return this.#receive(expectedAck, timeoutMs);
  }

  async #write(bytes) {
    if (!this.writer) {
      throw new PrinterError(t("printer.noWriter"), "no_writer");
    }
    // Copie : certains backends n’aiment pas les subarrays partagés.
    await this.writer.write(bytes.slice());
  }

  async #receive(expectedAck, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    let lastLen = -1;
    while (Date.now() < deadline) {
      const frame = this.#tryParseFrame();
      if (frame) {
        this.onLog(
          t("printer.rxFrame", { ack: frame.ack, err: frame.error, hex: toHex(frame.data) }),
        );
        if (expectedAck != null && frame.ack !== expectedAck) {
          throw new PrinterError(
            t("printer.badAck", { expected: expectedAck, got: frame.ack }),
            "ack",
          );
        }
        // Certaines réponses ivy2 mettent error≠0 même sur succès partiel ;
        // on ne bloque que si on attendait un ACK précis et error est absurde.
        // ivy2 ignore error dans __receive_message et laisse process_response décider.
        return frame;
      }
      if (this.#rx.byteLength !== lastLen && this.#rx.byteLength > 0) {
        lastLen = this.#rx.byteLength;
        this.onLog(t("printer.rxGrow", { n: lastLen, hex: toHex(this.#rx) }), "warn");
      }
      await sleep(30);
    }
    throw new PrinterError(t("printer.timeout", { bytes: this.#rx.byteLength }), "timeout");
  }

  #tryParseFrame() {
    if (this.#rx.byteLength < 2) return null;

    let start = -1;
    for (let i = 0; i <= this.#rx.byteLength - 2; i++) {
      // Requêtes = 43 0f · Réponses Zoemini = 43 f0 (confirmé en live)
      if (isFrameMagic(this.#rx[i], this.#rx[i + 1])) {
        start = i;
        break;
      }
    }

    if (start < 0) {
      if (this.#rx.byteLength > 128) {
        this.onLog(t("printer.rxPurge", { hex: toHex(this.#rx) }), "warn");
        this.#rx = this.#rx.slice(-1);
      }
      return null;
    }

    if (start > 0) {
      this.onLog(t("printer.rxSkip", { n: start }), "warn");
      this.#rx = this.#rx.slice(start);
    }

    if (this.#rx.byteLength < FRAME_LEN) return null;

    const packet = this.#rx.slice(0, FRAME_LEN);
    this.#rx = this.#rx.slice(FRAME_LEN);
    return parseIncomingMessage(packet);
  }

  async #readLoop() {
    while (this.reader && this.linkOpen) {
      try {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (value?.byteLength) {
          const merged = new Uint8Array(this.#rx.byteLength + value.byteLength);
          merged.set(this.#rx, 0);
          merged.set(value, this.#rx.byteLength);
          this.#rx = merged;
        }
      } catch {
        break;
      }
    }
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
