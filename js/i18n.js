/**
 * Internationalisation FR / EN.
 * Français par défaut ; choix persisté dans localStorage (`miniprint.lang`).
 */

const STORAGE_KEY = "miniprint.lang";
const SUPPORTED = /** @type {const} */ (["fr", "en"]);

/** @type {Record<string, Record<string, string>>} */
const STRINGS = {
  fr: {
    "meta.title": "MiniPrint 💕 atelier photo",
    "header.tagline": "atelier tout mignon · Zoemini 2",
    "header.connect": "📡 Bluetooth",
    "header.disconnect": "Déconnecter",
    "header.printerOffline": "Hors ligne",
    "header.printerReady": "Prête 💕",
    "header.printerLink": "Connectée…",
    "header.statusAria": "Statut imprimante",
    "header.battery": "Batterie",
    "header.paper": "Papier",
    "header.cover": "Couvercle",
    "header.firmware": "Firmware",
    "header.refresh": "Rafraîchir statut",
    "header.print": "Imprimer ✨",
    "banner.support": "Ouvre cette page dans <strong>Chrome</strong> ou <strong>Edge</strong> pour imprimer ✨",

    "tab.collage": "Collages",
    "tab.stickers": "Stickers",
    "tab.frames": "Cadres",
    "tab.effects": "Effets",
    "tab.light": "Lumière",

    "collage.hint": "Choisis une mise en page, puis tape ＋ Photo sur le rendu 📸",
    "collage.format": "Format",
    "collage.portrait": "Portrait",
    "collage.landscape": "Paysage",
    "collage.round": "Rond",
    "collage.roundTitle": "Papier sticker rond pré-découpé",
    "collage.roundNote":
      "Papier sticker rond pré-découpé : 2 pastilles de ⌀ 35 mm. Le reste de la feuille n’est pas imprimé.",
    "collage.layout": "Mise en page",
    "collage.layoutLocked": "Mise en page imposée par le papier pré-découpé.",
    "collage.patterns": "Motifs de fond",
    "collage.none": "Aucun",
    "collage.orientLandscape": "Mode paysage — le rendu sera tourné à l’impression.",
    "collage.orientPortrait": "Mode portrait.",
    "collage.orientRound": "Mode stickers ronds — charge du papier pré-découpé rond.",

    "collage.single": "1 photo",
    "collage.split-v": "2 haut/bas",
    "collage.split-h": "2 côte à côte",
    "collage.feature": "1 grande + 2",
    "collage.grid4": "Grille 4",
    "collage.strip3": "Bande 3",

    "stickers.hint": "Stickers Canon + emojis — clique puis glisse 🎀",
    "stickers.emojis": "Emojis",
    "stickers.searchAria": "Rechercher un emoji",
    "stickers.searchPlaceholder": "Rechercher… smile, sourire, chat…",
    "stickers.categories": "Catégories",
    "stickers.all": "Tous",
    "stickers.noneEmoji": "Aucun emoji",
    "stickers.noneEmojiQuery": "Aucun emoji pour « {q} »",
    "stickers.stickerTitle": "Sticker {id}",
    "stickers.patternTitle": "Motif {id}",
    "stickers.frameTitle": "Cadre {id}",

    "cat.Cœur & ciel": "Cœur & ciel",
    "cat.Nœuds": "Nœuds",
    "cat.Bijoux": "Bijoux",
    "cat.Mode": "Mode",
    "cat.Gourmandises": "Gourmandises",
    "cat.Boissons": "Boissons",
    "cat.Bulles": "Bulles",
    "cat.Mots": "Mots",
    "cat.Banderoles": "Banderoles",
    "cat.Dodo": "Dodo",
    "cat.Sport": "Sport",
    "cat.Fun": "Fun",
    "cat.Capybaras": "Capybaras",
    "cat.Chats": "Chats",
    "cat.Chiens": "Chiens",
    "cat.Hamsters": "Hamsters",
    "cat.Lapins": "Lapins",
    "cat.Forêt": "Forêt",
    "cat.Ferme": "Ferme",
    "cat.Mer": "Mer",
    "cat.Autre": "Autre",

    "emoji.Favoris": "Favoris",
    "emoji.Smileys": "Smileys",
    "emoji.Gestes": "Gestes",
    "emoji.Animaux": "Animaux",
    "emoji.Nature": "Nature",
    "emoji.Gourmand": "Gourmand",
    "emoji.Activités": "Activités",
    "emoji.Voyages": "Voyages",
    "emoji.Objets": "Objets",
    "emoji.Symboles": "Symboles",

    "frames.hint": "Les vrais cadres de l’appli Canon 🖼️",
    "effects.hint": "Filtres / tons couleur de l’appli Canon 🌈",
    "effects.none": "Aucun",

    "light.hint": "Réglages photo — luminosité, contraste… ☀️",
    "light.brightness": "Luminosité",
    "light.contrast": "Contraste",
    "light.saturation": "Saturation",
    "light.warmth": "Chaleur",
    "light.vignette": "Vignette",
    "light.reset": "Réinitialiser",

    "tools.aria": "Outils rapides",
    "tools.text": "Texte",
    "tools.textTitle": "Ajouter du texte",
    "tools.sticker": "Sticker",
    "tools.stickerTitle": "Stickers",
    "tools.photo": "Photo",
    "tools.photoTitle": "Ajouter une photo",

    "stage.canvasAria": "Zone de création",
    "stage.hint": "Glisse les stickers · double-clic pour changer une photo",

    "sel.title": "Sélection ✨",
    "sel.none": "Rien de sélectionné",
    "sel.stickerEmoji": "Sticker {emoji}",
    "sel.stickerCanon": "Sticker Canon",
    "sel.text": "Texte « {text} »",
    "sel.photo": "Photo {n}",
    "sel.slotEmpty": "Emplacement {n} (vide)",
    "sel.smaller": "Plus petit",
    "sel.bigger": "Plus grand",
    "sel.rotate": "Pivoter",
    "sel.flip": "Miroir gauche ↔ droite",
    "sel.delete": "Supprimer",
    "sel.editText": "✏️ Modifier le texte",
    "sel.font": "Police",
    "sel.color": "Couleur",
    "sel.size": "Taille",
    "sel.fit": "Cadrage",
    "sel.fitContain": "Ajuster",
    "sel.fitContainTitle": "Image entière, sans déformer",
    "sel.fitCover": "Remplir",
    "sel.fitCoverTitle": "Remplir le cadre (rogne)",
    "sel.fitStretch": "Étirer",
    "sel.fitStretchTitle": "Étirer (peut déformer)",
    "sel.fitHint": "Remplir : glisse la photo pour recadrer · ± pour zoomer",

    "prompt.text": "Texte :",
    "prompt.newText": "Ton texte :",
    "prompt.newTextDefault": "Hello !",

    "log.title": "Journal",
    "log.close": "Fermer",
    "log.fabTitle": "Journal",
    "log.fabLabel": "Journal",

    "status.paperEmpty": "vide",
    "status.paperOk": "ok",
    "status.coverOpen": "ouvert",
    "status.coverOk": "ok",

    "lang.fr": "FR",
    "lang.en": "EN",
    "lang.frName": "Français",
    "lang.enName": "English",
    "lang.switchAria": "Langue",

    "progress.prep": "Préparation…",
    "progress.send": "Envoi {pct}%",
    "progress.printing": "Impression…",
    "progress.done": "C'est parti !",

    "log.choosePrinter": "Choisis l'imprimante (Canon / SPP)…",
    "log.readyBattery": "Prête · batterie {battery}% · FW {fw}",
    "log.portBlocked": "Port bloqué — oubli + nouvelle sélection…",
    "log.noDevice": "Aucun appareil choisi.",
    "log.needGesture": "Chrome a besoin d’un nouveau clic. Reclique Connecter (imprimante appairée, appli Canon fermée).",
    "log.linkOpenRetry": "Lien BT ouvert — reclique Bluetooth pour réessayer.",
    "log.handshakeRetry": "Relance du handshake…",
    "log.handshakeOk": "Handshake OK · batterie {battery}% · FW {fw}",
    "log.disconnected": "Déconnectée.",
    "log.statusRefreshed": "Statut rafraîchi.",
    "log.connectFirst": "Connecte d'abord l'imprimante (Bluetooth).",
    "log.addContent": "Ajoute au moins une photo ou un sticker.",
    "log.render": "Rendu de la composition…",
    "log.sending": "Envoi ({kb} Ko)…",
    "log.transferOk": "Transfert OK — impression en cours.",
    "log.noSerial": "Web Serial indisponible — création OK, impression Chrome/Edge seulement.",
    "log.loadingCatalog": "Chargement des stickers & cadres Canon…",
    "log.readyStudio": "Atelier prêt ✨ {frames} cadres · {stickers} stickers · {effects} effets",
    "log.catalogErr": "Catalogue Canon: {msg}",

    "printer.noSerial": "Web Serial n'est pas disponible. Utilisez Chrome ou Edge sur desktop.",
    "printer.reuseBtPort": "Réutilisation du port déjà autorisé ({id}).",
    "printer.reuseSerialPort": "Réutilisation du port série déjà autorisé.",
    "printer.forceCloseFail": "Fermeture préalable impossible ({msg})",
    "printer.btNotConnected": "L’imprimante n’est pas connectée au système BT — tentative d’ouverture quand même…",
    "printer.opening": "Ouverture RFCOMM (essai {n}/{total}, baud={baud}{buf})…",
    "printer.openFail": "open échoué : {msg}",
    "printer.openFailed": "Impossible d'ouvrir le port ({msg}). Sur ChromeOS : 1) imprimante appairée et allumée 2) ferme l'appli Canon Mini Print 3) reclique Connecter pour resélectionner le port. Sinon oublie l'imprimante en BT et réapparie.",
    "printer.linkOpen": "Lien RFCOMM ouvert · bluetoothServiceClassId={bt} · usb={usb} · connected={connected}",
    "printer.noLink": "Pas de lien RFCOMM ouvert.",
    "printer.sessionOk": "Session OK · batterie {battery}% · MTU {mtu}",
    "printer.rxBuffer": "RX buffer: {pending}",
    "printer.handshakeIncomplete": "Handshake non terminé.",
    "printer.noWriter": "Port série indisponible.",
    "printer.badAck": "ACK invalide (attendu {expected}, reçu {got}).",
    "printer.timeout": "Délai dépassé (RX={bytes}o).",
    "printer.rxFrame": "RX frame ack={ack} err={err} · {hex}",
    "printer.rxGrow": "RX +{n}o: {hex}",
    "printer.rxPurge": "RX sans magic 43xx, purge: {hex}",
    "printer.rxSkip": "RX ignore {n}o avant magic",

    "err.status": "L'imprimante signale une erreur ({code}).",
    "err.lowBattery": "Batterie trop faible ({battery}%). Chargez l'imprimante.",
    "err.coverOpen": "Le couvercle est ouvert.",
    "err.noPaper": "Plus de papier ZINK.",
    "err.wrongSheet": "Mauvaise SMART SHEET détectée.",
  },

  en: {
    "meta.title": "MiniPrint 💕 photo studio",
    "header.tagline": "cute little studio · Zoemini 2",
    "header.connect": "📡 Bluetooth",
    "header.disconnect": "Disconnect",
    "header.printerOffline": "Offline",
    "header.printerReady": "Ready 💕",
    "header.printerLink": "Connected…",
    "header.statusAria": "Printer status",
    "header.battery": "Battery",
    "header.paper": "Paper",
    "header.cover": "Cover",
    "header.firmware": "Firmware",
    "header.refresh": "Refresh status",
    "header.print": "Print ✨",
    "banner.support": "Open this page in <strong>Chrome</strong> or <strong>Edge</strong> to print ✨",

    "tab.collage": "Collages",
    "tab.stickers": "Stickers",
    "tab.frames": "Frames",
    "tab.effects": "Effects",
    "tab.light": "Light",

    "collage.hint": "Pick a layout, then tap ＋ Photo on the canvas 📸",
    "collage.format": "Format",
    "collage.portrait": "Portrait",
    "collage.landscape": "Landscape",
    "collage.round": "Round",
    "collage.roundTitle": "Pre-cut circle sticker paper",
    "collage.roundNote":
      "Pre-cut circle sticker paper: two ⌀ 35 mm circles. Anything outside them is not printed.",
    "collage.layout": "Layout",
    "collage.layoutLocked": "Layout is set by the pre-cut paper.",
    "collage.patterns": "Background patterns",
    "collage.none": "None",
    "collage.orientLandscape": "Landscape mode — the print will be rotated for the printer.",
    "collage.orientPortrait": "Portrait mode.",
    "collage.orientRound": "Round sticker mode — load pre-cut circle sticker paper.",

    "collage.single": "1 photo",
    "collage.split-v": "2 top/bottom",
    "collage.split-h": "2 side by side",
    "collage.feature": "1 large + 2",
    "collage.grid4": "4-grid",
    "collage.strip3": "3-strip",

    "stickers.hint": "Canon stickers + emojis — click then drag 🎀",
    "stickers.emojis": "Emojis",
    "stickers.searchAria": "Search emojis",
    "stickers.searchPlaceholder": "Search… smile, sourire, cat…",
    "stickers.categories": "Categories",
    "stickers.all": "All",
    "stickers.noneEmoji": "No emoji",
    "stickers.noneEmojiQuery": "No emoji for “{q}”",
    "stickers.stickerTitle": "Sticker {id}",
    "stickers.patternTitle": "Pattern {id}",
    "stickers.frameTitle": "Frame {id}",

    "cat.Cœur & ciel": "Hearts & sky",
    "cat.Nœuds": "Bows",
    "cat.Bijoux": "Jewelry",
    "cat.Mode": "Fashion",
    "cat.Gourmandises": "Sweets",
    "cat.Boissons": "Drinks",
    "cat.Bulles": "Bubbles",
    "cat.Mots": "Words",
    "cat.Banderoles": "Banners",
    "cat.Dodo": "Sleepy",
    "cat.Sport": "Sport",
    "cat.Fun": "Fun",
    "cat.Capybaras": "Capybaras",
    "cat.Chats": "Cats",
    "cat.Chiens": "Dogs",
    "cat.Hamsters": "Hamsters",
    "cat.Lapins": "Bunnies",
    "cat.Forêt": "Forest",
    "cat.Ferme": "Farm",
    "cat.Mer": "Sea",
    "cat.Autre": "Other",

    "emoji.Favoris": "Favorites",
    "emoji.Smileys": "Smileys",
    "emoji.Gestes": "Gestures",
    "emoji.Animaux": "Animals",
    "emoji.Nature": "Nature",
    "emoji.Gourmand": "Food",
    "emoji.Activités": "Activities",
    "emoji.Voyages": "Travel",
    "emoji.Objets": "Objects",
    "emoji.Symboles": "Symbols",

    "frames.hint": "Real frames from the Canon app 🖼️",
    "effects.hint": "Filters / color tones from the Canon app 🌈",
    "effects.none": "None",

    "light.hint": "Photo tweaks — brightness, contrast… ☀️",
    "light.brightness": "Brightness",
    "light.contrast": "Contrast",
    "light.saturation": "Saturation",
    "light.warmth": "Warmth",
    "light.vignette": "Vignette",
    "light.reset": "Reset",

    "tools.aria": "Quick tools",
    "tools.text": "Text",
    "tools.textTitle": "Add text",
    "tools.sticker": "Sticker",
    "tools.stickerTitle": "Stickers",
    "tools.photo": "Photo",
    "tools.photoTitle": "Add a photo",

    "stage.canvasAria": "Creation area",
    "stage.hint": "Drag stickers · double-click to change a photo",

    "sel.title": "Selection ✨",
    "sel.none": "Nothing selected",
    "sel.stickerEmoji": "Sticker {emoji}",
    "sel.stickerCanon": "Canon sticker",
    "sel.text": "Text “{text}”",
    "sel.photo": "Photo {n}",
    "sel.slotEmpty": "Slot {n} (empty)",
    "sel.smaller": "Smaller",
    "sel.bigger": "Bigger",
    "sel.rotate": "Rotate",
    "sel.flip": "Flip left ↔ right",
    "sel.delete": "Delete",
    "sel.editText": "✏️ Edit text",
    "sel.font": "Font",
    "sel.color": "Color",
    "sel.size": "Size",
    "sel.fit": "Fit",
    "sel.fitContain": "Fit",
    "sel.fitContainTitle": "Whole image, no distortion",
    "sel.fitCover": "Fill",
    "sel.fitCoverTitle": "Fill the frame (crops)",
    "sel.fitStretch": "Stretch",
    "sel.fitStretchTitle": "Stretch (may distort)",
    "sel.fitHint": "Fill: drag the photo to reframe · ± to zoom",

    "prompt.text": "Text:",
    "prompt.newText": "Your text:",
    "prompt.newTextDefault": "Hello!",

    "log.title": "Log",
    "log.close": "Close",
    "log.fabTitle": "Log",
    "log.fabLabel": "Log",

    "status.paperEmpty": "empty",
    "status.paperOk": "ok",
    "status.coverOpen": "open",
    "status.coverOk": "ok",

    "lang.fr": "FR",
    "lang.en": "EN",
    "lang.frName": "Français",
    "lang.enName": "English",
    "lang.switchAria": "Language",

    "progress.prep": "Preparing…",
    "progress.send": "Sending {pct}%",
    "progress.printing": "Printing…",
    "progress.done": "Here we go!",

    "log.choosePrinter": "Pick the printer (Canon / SPP)…",
    "log.readyBattery": "Ready · battery {battery}% · FW {fw}",
    "log.portBlocked": "Port locked — forgetting + picking again…",
    "log.noDevice": "No device selected.",
    "log.needGesture": "Chrome needs a fresh click. Click Connect again (printer paired, Canon app closed).",
    "log.linkOpenRetry": "BT link is open — click Bluetooth again to retry.",
    "log.handshakeRetry": "Retrying handshake…",
    "log.handshakeOk": "Handshake OK · battery {battery}% · FW {fw}",
    "log.disconnected": "Disconnected.",
    "log.statusRefreshed": "Status refreshed.",
    "log.connectFirst": "Connect the printer first (Bluetooth).",
    "log.addContent": "Add at least one photo or sticker.",
    "log.render": "Rendering the composition…",
    "log.sending": "Sending ({kb} KB)…",
    "log.transferOk": "Transfer OK — printing now.",
    "log.noSerial": "Web Serial unavailable — editing OK, printing needs Chrome/Edge.",
    "log.loadingCatalog": "Loading Canon stickers & frames…",
    "log.readyStudio": "Studio ready ✨ {frames} frames · {stickers} stickers · {effects} effects",
    "log.catalogErr": "Canon catalog: {msg}",

    "printer.noSerial": "Web Serial is unavailable. Use Chrome or Edge on desktop.",
    "printer.reuseBtPort": "Reusing already-allowed port ({id}).",
    "printer.reuseSerialPort": "Reusing already-allowed serial port.",
    "printer.forceCloseFail": "Could not pre-close port ({msg})",
    "printer.btNotConnected": "Printer is not connected to system BT — trying to open anyway…",
    "printer.opening": "Opening RFCOMM (try {n}/{total}, baud={baud}{buf})…",
    "printer.openFail": "open failed: {msg}",
    "printer.openFailed": "Could not open the port ({msg}). On ChromeOS: 1) printer paired and on 2) close Canon Mini Print 3) click Connect again to reselect the port. Or forget the printer in BT and pair again.",
    "printer.linkOpen": "RFCOMM link open · bluetoothServiceClassId={bt} · usb={usb} · connected={connected}",
    "printer.noLink": "No RFCOMM link open.",
    "printer.sessionOk": "Session OK · battery {battery}% · MTU {mtu}",
    "printer.rxBuffer": "RX buffer: {pending}",
    "printer.handshakeIncomplete": "Handshake not finished.",
    "printer.noWriter": "Serial port unavailable.",
    "printer.badAck": "Invalid ACK (expected {expected}, got {got}).",
    "printer.timeout": "Timed out (RX={bytes} B).",
    "printer.rxFrame": "RX frame ack={ack} err={err} · {hex}",
    "printer.rxGrow": "RX +{n} B: {hex}",
    "printer.rxPurge": "RX without 43xx magic, purge: {hex}",
    "printer.rxSkip": "RX skipping {n} B before magic",

    "err.status": "The printer reported an error ({code}).",
    "err.lowBattery": "Battery too low ({battery}%). Charge the printer.",
    "err.coverOpen": "The cover is open.",
    "err.noPaper": "Out of ZINK paper.",
    "err.wrongSheet": "Wrong SMART SHEET detected.",
  },
};

/** @type {"fr" | "en"} */
let currentLang = "fr";

/** @type {Set<() => void>} */
const listeners = new Set();

function readStoredLang() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "fr" || v === "en") return v;
  } catch {
    /* ignore */
  }
  return "fr";
}

export function getLang() {
  return currentLang;
}

/**
 * @param {string} key
 * @param {Record<string, string | number>} [vars]
 */
export function t(key, vars = {}) {
  const table = STRINGS[currentLang] || STRINGS.fr;
  let out = table[key] ?? STRINGS.fr[key] ?? key;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replaceAll(`{${k}}`, String(v));
  }
  return out;
}

/** Traduit une catégorie sticker Canon (clé = nom FR du catalogue). */
export function tCategory(name) {
  const key = `cat.${name}`;
  const translated = t(key);
  return translated === key ? name : translated;
}

/** Traduit un groupe emoji (clé = nom FR interne). */
export function tEmojiGroup(name) {
  const key = `emoji.${name}`;
  const translated = t(key);
  return translated === key ? name : translated;
}

import { asset } from "./base.js?v=3";

const LANG_META = {
  fr: { flag: asset("assets/flags/fr.svg"), code: "FR" },
  en: { flag: asset("assets/flags/en.svg"), code: "EN" },
};

/**
 * Applique `data-i18n`, `data-i18n-html`, `data-i18n-title`,
 * `data-i18n-placeholder`, `data-i18n-aria` sur le document.
 */
export function applyDom(root = document) {
  root.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.getAttribute("data-i18n"));
  });
  root.querySelectorAll("[data-i18n-html]").forEach((el) => {
    el.innerHTML = t(el.getAttribute("data-i18n-html"));
  });
  root.querySelectorAll("[data-i18n-title]").forEach((el) => {
    el.title = t(el.getAttribute("data-i18n-title"));
  });
  root.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.setAttribute("placeholder", t(el.getAttribute("data-i18n-placeholder")));
  });
  root.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    el.setAttribute("aria-label", t(el.getAttribute("data-i18n-aria")));
  });

  const title = t("meta.title");
  if (document.title !== title) document.title = title;
  document.documentElement.lang = currentLang;

  const meta = LANG_META[currentLang] ?? LANG_META.fr;
  const flagEl = document.getElementById("lang-flag");
  const codeEl = document.getElementById("lang-code");
  if (flagEl) flagEl.src = meta.flag;
  if (codeEl) codeEl.textContent = meta.code;

  document.querySelectorAll("[data-lang]").forEach((btn) => {
    const active = btn.getAttribute("data-lang") === currentLang;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-selected", active ? "true" : "false");
  });
}

/** @param {(lang: string) => void} fn */
export function onLangChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * @param {"fr" | "en"} lang
 * @param {{ persist?: boolean }} [opts]
 */
export function setLang(lang, { persist = true } = {}) {
  if (!SUPPORTED.includes(lang)) return;
  if (lang === currentLang) {
    applyDom();
    return;
  }
  currentLang = lang;
  if (persist) {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* ignore */
    }
  }
  applyDom();
  listeners.forEach((fn) => fn(lang));
}

export function initI18n() {
  currentLang = readStoredLang();
  applyDom();
}

export { SUPPORTED as LANGS };
