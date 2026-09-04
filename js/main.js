import { COLLAGES, Studio } from "./studio.js?v=5";
import { prepareStageCanvas } from "./image.js?v=3";
import { ZoeminiPrinter, serialSupported } from "./printer.js?v=4";
import { EMOJI_GROUPS, searchEmojis } from "./emoji.js?v=2";
import { initI18n, onLangChange, setLang, t, tCategory, tEmojiGroup } from "./i18n.js?v=2";

const $ = (sel) => document.querySelector(sel);

const els = {
  support: $("#support-banner"),
  connectBtn: $("#btn-connect"),
  disconnectBtn: $("#btn-disconnect"),
  handshakeBtn: $("#btn-handshake"),
  refreshBtn: $("#btn-refresh"),
  printBtn: $("#btn-print"),
  addTextBtn: $("#btn-add-text"),
  gotoStickersBtn: $("#btn-goto-stickers"),
  addPhotoQuickBtn: $("#btn-add-photo-quick"),
  resetAdjBtn: $("#btn-reset-adj"),
  fileInput: $("#file-input"),
  canvas: $("#studio-canvas"),
  collageList: $("#collage-list"),
  orientList: $("#orient-list"),
  emojiCats: $("#emoji-cats"),
  emojiList: $("#emoji-list"),
  emojiSearch: $("#emoji-search"),
  stickerCats: $("#sticker-cats"),
  stickerList: $("#sticker-list"),
  frameList: $("#frame-list"),
  effectList: $("#effect-list"),
  patternList: $("#pattern-list"),
  adjustSliders: $("#adjust-sliders"),
  selLabel: $("#sel-label"),
  smaller: $("#btn-smaller"),
  bigger: $("#btn-bigger"),
  rotL: $("#btn-rot-left"),
  rotR: $("#btn-rot-right"),
  del: $("#btn-delete"),
  textTools: $("#text-tools"),
  photoTools: $("#photo-tools"),
  fitList: $("#fit-list"),
  fontList: $("#font-list"),
  colorList: $("#color-list"),
  textSize: $("#text-size"),
  textSizeVal: $("#val-text-size"),
  editTextBtn: $("#btn-edit-text"),
  log: $("#log"),
  statusCard: $("#status-card"),
  battery: $("#stat-battery"),
  paper: $("#stat-paper"),
  cover: $("#stat-cover"),
  fw: $("#stat-fw"),
  progress: $("#progress"),
  progressBar: $("#progress-bar"),
  progressLabel: $("#progress-label"),
  printerPill: $("#printer-pill"),
  printerLabel: $("#printer-label"),
  logToggle: $("#btn-toggle-log"),
  logClose: $("#btn-close-log"),
  logPopover: $("#log-popover"),
  logBadge: $("#log-badge"),
};

const printer = new ZoeminiPrinter();
printer.onLog = (msg, kind = "info") => log(msg, kind);

const studio = new Studio(els.canvas, { fileInput: els.fileInput });
studio.onChange = () => updateSelectionLabel();

const TEXT_FONTS = [
  { id: "Mini Gochi", label: "Gochi", sample: "Aa" },
  { id: "Mini Butterfly", label: "Butterfly", sample: "Aa" },
  { id: "Mini Pinyon", label: "Pinyon", sample: "Aa" },
  { id: "Mini Qwigley", label: "Qwigley", sample: "Aa" },
  { id: "Mini Chawp", label: "Chawp", sample: "Aa" },
  { id: "Mini Berantas", label: "Berantas", sample: "Aa" },
  { id: "Mini Didact", label: "Didact", sample: "Aa" },
  { id: "Mini Old Standard", label: "Old Standard", sample: "Aa" },
  { id: "Mini Vinsdojo", label: "Vinsdojo", sample: "Aa" },
  { id: "Mini Pacifico", label: "Pacifico", sample: "Aa" },
  { id: "Mini Nunito", label: "Nunito", sample: "Aa" },
];

const TEXT_COLORS = [
  "#ff6b9d",
  "#e84d82",
  "#1c2438",
  "#ffffff",
  "#f0a56f",
  "#1a6b5c",
  "#4d96ff",
  "#c77dff",
  "#ffd93d",
  "#ff6b6b",
];

let activeStickerCat = null; // rempli au boot (1ère catégorie, pas « tous »)
let activeEmojiGroup = EMOJI_GROUPS[0]?.name ?? "";
let emojiQuery = "";
/** @type {any} */
let catalogCache = null;

let logUnread = 0;

function setLogOpen(open) {
  els.logPopover.hidden = !open;
  els.logToggle.setAttribute("aria-expanded", open ? "true" : "false");
  if (open) {
    logUnread = 0;
    els.logBadge.hidden = true;
  }
}

function log(msg, kind = "info") {
  const line = document.createElement("p");
  line.className = `log-line log-${kind}`;
  const time = new Date().toLocaleTimeString("fr-FR", { hour12: false });
  line.textContent = `[${time}] ${msg}`;
  els.log.prepend(line);

  if (els.logPopover.hidden) {
    logUnread += 1;
    els.logBadge.hidden = false;
    els.logBadge.textContent = String(Math.min(logUnread, 99));
  }
}

function setPrinterUi() {
  const link = printer.linkOpen;
  const ok = printer.connected;
  els.connectBtn.hidden = link;
  els.disconnectBtn.hidden = !link;
  els.handshakeBtn.hidden = !link;
  els.refreshBtn.disabled = !ok;
  els.printBtn.disabled = false;
  const state = ok ? "online" : link ? "link" : "offline";
  els.statusCard.dataset.state = state;
  els.printerPill.dataset.state = state;
  els.printerLabel.textContent = ok ? t("header.printerReady") : link ? t("header.printerLink") : t("header.printerOffline");
}

function renderStatus() {
  const s = printer.status;
  const set = printer.setting;
  if (!s) {
    els.battery.textContent = "—";
    els.paper.textContent = "—";
    els.cover.textContent = "—";
    els.fw.textContent = "—";
    return;
  }
  els.battery.textContent = `${s.batteryLevel}%`;
  els.paper.textContent = s.noPaper ? t("status.paperEmpty") : t("status.paperOk");
  els.cover.textContent = s.coverOpen ? t("status.coverOpen") : t("status.coverOk");
  els.fw.textContent = set?.firmwareVersion ?? "—";
  els.cover.closest(".status-chip")?.setAttribute(
    "title",
    s.coverOpen ? "Couvercle ouvert" : "Couvercle fermé",
  );
  els.paper.closest(".status-chip")?.setAttribute(
    "title",
    s.noPaper ? "Plus de papier" : "Papier OK",
  );
}

function setProgress(pct, label) {
  if (pct == null) {
    els.progress.hidden = true;
    return;
  }
  els.progress.hidden = false;
  els.progressBar.style.width = `${pct}%`;
  els.progressLabel.textContent = label ?? `${pct}%`;
}

function syncTextTools() {
  const sel = studio.selection;
  const isText = sel?.kind === "text";
  els.textTools.hidden = !isText;
  if (!isText) return;
  const t = studio.texts[sel.index];
  if (!t) return;
  els.textSize.value = String(Math.round(t.size));
  els.textSizeVal.textContent = String(Math.round(t.size));
  [...els.fontList.children].forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.font === t.font);
  });
  [...els.colorList.children].forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.color === t.color);
  });
}

function syncPhotoTools() {
  const sel = studio.selection;
  const slot = sel?.kind === "slot" ? studio.slots[sel.index] : null;
  const show = Boolean(slot?.bitmap);
  els.photoTools.hidden = !show;
  if (!show) return;
  const fit = slot.fit || "contain";
  [...els.fitList.querySelectorAll("[data-fit]")].forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.fit === fit);
  });
}

function updateSelectionLabel() {
  const sel = studio.selection;
  if (!sel) {
    els.selLabel.textContent = t("sel.none");
    syncTextTools();
    syncPhotoTools();
    return;
  }
  if (sel.kind === "sticker") {
    const s = studio.stickers[sel.index];
    els.selLabel.textContent = s?.type === "emoji" ? t("sel.stickerEmoji", { emoji: s.emoji }) : t("sel.stickerCanon");
  } else if (sel.kind === "text") {
    els.selLabel.textContent = t("sel.text", { text: studio.texts[sel.index]?.text ?? "" });
  } else if (sel.kind === "slot") {
    const slot = studio.slots[sel.index];
    els.selLabel.textContent = slot?.bitmap
      ? t("sel.photo", { n: sel.index + 1 })
      : t("sel.slotEmpty", { n: sel.index + 1 });
  }
  syncTextTools();
  syncPhotoTools();
}

function buildTextTools() {
  TEXT_FONTS.forEach((f) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "font-btn";
    btn.dataset.font = f.id;
    btn.innerHTML = `<span style="font-family:'${f.id}',sans-serif;font-size:1.25rem">${f.sample}</span><small>${f.label}</small>`;
    btn.addEventListener("click", () => {
      studio.updateSelectedText({ font: f.id });
      syncTextTools();
    });
    els.fontList.appendChild(btn);
  });

  TEXT_COLORS.forEach((color) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "color-swatch";
    btn.dataset.color = color;
    btn.style.background = color;
    btn.title = color;
    btn.addEventListener("click", () => {
      studio.updateSelectedText({ color });
      syncTextTools();
    });
    els.colorList.appendChild(btn);
  });

  els.textSize.addEventListener("input", () => {
    const size = Number(els.textSize.value);
    els.textSizeVal.textContent = String(size);
    studio.updateSelectedText({ size });
  });

  els.editTextBtn.addEventListener("click", () => {
    if (studio.selection?.kind !== "text") return;
    const item = studio.texts[studio.selection.index];
    const next = prompt(t("prompt.text"), item?.text ?? "");
    if (next != null) studio.updateSelectedText({ text: next });
    updateSelectionLabel();
  });
}

function wirePhotoTools() {
  els.fitList?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-fit]");
    if (!btn) return;
    studio.setSlotFit(btn.dataset.fit);
    syncPhotoTools();
  });
}

function wireTabs() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      activateTab(tab.dataset.tab);
    });
  });
}

function activateTab(id) {
  document.querySelectorAll(".tab").forEach((t) => {
    t.classList.toggle("is-active", t.dataset.tab === id);
  });
  document.querySelectorAll(".tab-panel").forEach((p) => {
    p.classList.toggle("is-active", p.dataset.panel === id);
  });
}

function buildCollages() {
  els.collageList.innerHTML = "";
  COLLAGES.forEach((c) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip" + (c.id === studio.collageId ? " is-active" : "");
    btn.textContent = t(c.labelKey);
    btn.addEventListener("click", () => {
      studio.setCollage(c.id);
      [...els.collageList.children].forEach((el) => el.classList.toggle("is-active", el === btn));
    });
    els.collageList.appendChild(btn);
  });
}

function wireOrientation() {
  els.orientList?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-orient]");
    if (!btn) return;
    studio.setOrientation(btn.dataset.orient);
    [...els.orientList.querySelectorAll("[data-orient]")].forEach((el) => {
      el.classList.toggle("is-active", el === btn);
    });
    log(
      btn.dataset.orient === "landscape"
        ? t("collage.orientLandscape")
        : t("collage.orientPortrait"),
      "ok",
    );
  });
}

function buildPatterns(catalog) {
  const none = document.createElement("button");
  none.type = "button";
  none.className = "pattern-btn is-none is-active";
  none.textContent = t("collage.none");
  none.addEventListener("click", () => {
    studio.setPattern(null);
    [...els.patternList.children].forEach((el) => el.classList.toggle("is-active", el === none));
  });
  els.patternList.appendChild(none);

  catalog.patterns.forEach((p) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pattern-btn";
    btn.title = t("stickers.patternTitle", { id: p.id });
    const img = document.createElement("img");
    img.src = p.thumb || p.src;
    img.alt = "";
    btn.appendChild(img);
    btn.addEventListener("click", () => {
      studio.setPattern(p.id);
      [...els.patternList.children].forEach((el) => el.classList.toggle("is-active", el === btn));
    });
    els.patternList.appendChild(btn);
  });
}

function buildEmojis() {
  // avoid stacking listeners on search when re-building
  const search = els.emojiSearch;
  const searchClone = search.cloneNode(true);
  search.parentNode.replaceChild(searchClone, search);
  els.emojiSearch = searchClone;
  els.emojiSearch.addEventListener("input", () => {
    emojiQuery = els.emojiSearch.value;
    els.emojiCats.classList.toggle("is-dimmed", Boolean(emojiQuery.trim()));
    renderEmojis();
  });

  EMOJI_GROUPS.forEach((group) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cat-pill" + (group.name === activeEmojiGroup ? " is-active" : "");
    btn.textContent = tEmojiGroup(group.name);
    btn.addEventListener("click", () => {
      activeEmojiGroup = group.name;
      [...els.emojiCats.children].forEach((el) => el.classList.toggle("is-active", el === btn));
      renderEmojis();
    });
    els.emojiCats.appendChild(btn);
  });

  renderEmojis();
}

function renderEmojis() {
  const q = emojiQuery.trim();
  const emojis = q
    ? searchEmojis(q, { limit: 240 })
    : searchEmojis("", { groupName: activeEmojiGroup, limit: 500 });

  els.emojiList.innerHTML = "";
  if (!emojis.length) {
    const empty = document.createElement("p");
    empty.className = "emoji-empty";
    empty.textContent = q ? t("stickers.noneEmojiQuery", { q }) : t("stickers.noneEmoji");
    els.emojiList.appendChild(empty);
    return;
  }

  emojis.forEach((emoji) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "sticker-btn";
    btn.textContent = emoji;
    btn.title = emoji;
    btn.addEventListener("click", () => studio.addEmojiSticker(emoji));
    els.emojiList.appendChild(btn);
  });
}

function buildStickerCats(catalog) {
  els.stickerCats.innerHTML = "";
  const cats = [...new Set(catalog.stickers.map((s) => s.category))];
  if (!activeStickerCat) activeStickerCat = cats[0] || "all";
  const allCats = ["all", ...cats];
  allCats.forEach((cat) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cat-pill" + (cat === activeStickerCat ? " is-active" : "");
    btn.textContent = cat === "all" ? t("stickers.all") : tCategory(cat);
    btn.addEventListener("click", () => {
      activeStickerCat = cat;
      [...els.stickerCats.children].forEach((el) =>
        el.classList.toggle("is-active", el === btn),
      );
      renderCanonStickers(catalog);
    });
    els.stickerCats.appendChild(btn);
  });
}

function renderCanonStickers(catalog) {
  els.stickerList.innerHTML = "";
  catalog.stickers
    .filter((s) => activeStickerCat === "all" || s.category === activeStickerCat)
    .forEach((s) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "sticker-btn";
      btn.title = t("stickers.stickerTitle", { id: s.id });
      const img = document.createElement("img");
      img.src = s.thumb || s.src;
      img.alt = "";
      img.loading = "lazy";
      btn.appendChild(img);
      btn.addEventListener("click", () => studio.addCanonSticker(s));
      els.stickerList.appendChild(btn);
    });
}

function buildFrames(catalog) {
  const none = document.createElement("button");
  none.type = "button";
  none.className = "frame-btn" + (studio.frameId == null ? " is-active" : "");
  none.title = t("collage.none");
  none.textContent = t("collage.none");
  none.style.display = "grid";
  none.style.placeItems = "center";
  none.style.fontWeight = "800";
  none.style.fontSize = "0.75rem";
  none.style.color = "#8a6a78";
  none.addEventListener("click", () => {
    studio.setFrame(null);
    [...els.frameList.children].forEach((el) => el.classList.toggle("is-active", el === none));
  });
  els.frameList.appendChild(none);

  catalog.frames.forEach((f) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "frame-btn" + (f.id === studio.frameId ? " is-active" : "");
    btn.title = t("stickers.frameTitle", { id: f.id });
    const img = document.createElement("img");
    img.src = f.thumb;
    img.alt = "";
    img.loading = "lazy";
    btn.appendChild(img);
    btn.addEventListener("click", () => {
      studio.setFrame(f.id);
      [...els.frameList.children].forEach((el) => el.classList.toggle("is-active", el === btn));
    });
    els.frameList.appendChild(btn);
  });
}

function buildEffects(catalog) {
  const none = document.createElement("button");
  none.type = "button";
  none.className = "effect-btn is-active";
  none.innerHTML = `<span>${t("effects.none")}</span>`;
  none.addEventListener("click", () => {
    studio.setEffect(null);
    [...els.effectList.children].forEach((el) => el.classList.toggle("is-active", el === none));
  });
  els.effectList.appendChild(none);

  catalog.effects.forEach((e) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "effect-btn";
    btn.title = e.name;
    if (e.thumb) {
      const img = document.createElement("img");
      img.src = e.thumb;
      img.alt = e.name;
      img.loading = "lazy";
      btn.appendChild(img);
    }
    const label = document.createElement("span");
    label.textContent = e.name;
    btn.appendChild(label);
    btn.addEventListener("click", () => {
      studio.setEffect(e.id);
      [...els.effectList.children].forEach((el) => el.classList.toggle("is-active", el === btn));
    });
    els.effectList.appendChild(btn);
  });
}

function wireAdjustments() {
  els.adjustSliders.querySelectorAll("input[type=range]").forEach((input) => {
    const key = input.dataset.adj;
    const val = document.getElementById(`val-${key}`);
    input.addEventListener("input", () => {
      if (val) val.textContent = input.value;
      studio.setAdjustment(key, input.value);
    });
  });
  els.resetAdjBtn.addEventListener("click", () => {
    studio.resetAdjustments();
    els.adjustSliders.querySelectorAll("input[type=range]").forEach((input) => {
      input.value = "0";
      const val = document.getElementById(`val-${input.dataset.adj}`);
      if (val) val.textContent = "0";
    });
  });
}

async function connect() {
  els.connectBtn.disabled = true;
  try {
    log(t("log.choosePrinter"));
    let port = await printer.pickPort({ preferGranted: true });
    try {
      const info = await printer.connect(port);
      renderStatus();
      setPrinterUi();
      log(
        t("log.readyBattery", { battery: info.status.batteryLevel, fw: info.setting.firmwareVersion }),
        "ok",
      );
      return;
    } catch (err) {
      if (err?.code !== "open_failed") throw err;

      // Port réutilisé souvent verrouillé (ChromeOS / getPorts).
      log(t("log.portBlocked"), "warn");
      try {
        await port.close();
      } catch {
        /* ignore */
      }
      try {
        await port.forget?.();
      } catch {
        /* ignore */
      }
      await new Promise((r) => setTimeout(r, 400));

      port = await printer.pickPort({ preferGranted: false });
      const info = await printer.connect(port);
      renderStatus();
      setPrinterUi();
      log(
        t("log.readyBattery", { battery: info.status.batteryLevel, fw: info.setting.firmwareVersion }),
        "ok",
      );
    }
  } catch (err) {
    if (err?.name === "NotFoundError") log(t("log.noDevice"), "warn");
    else if (/user gesture|NotAllowedError|SecurityError/i.test(String(err?.message ?? err?.name ?? ""))) {
      log(t("log.needGesture"), "warn");
    } else {
      log(err.message || String(err), "err");
      if (printer.linkOpen) log(t("log.linkOpenRetry"), "warn");
    }
    setPrinterUi();
    renderStatus();
  } finally {
    els.connectBtn.disabled = false;
  }
}

async function retryHandshake() {
  try {
    log(t("log.handshakeRetry"));
    const info = await printer.handshake();
    renderStatus();
    setPrinterUi();
    log(
      t("log.handshakeOk", { battery: info.status.batteryLevel, fw: info.setting.firmwareVersion }),
      "ok",
    );
  } catch (err) {
    log(err.message || String(err), "err");
    setPrinterUi();
  }
}

async function disconnect() {
  await printer.disconnect();
  setPrinterUi();
  renderStatus();
  log(t("log.disconnected"));
}

async function refresh() {
  try {
    await printer.getStatus();
    await printer.getSetting();
    renderStatus();
    log(t("log.statusRefreshed"), "ok");
  } catch (err) {
    log(err.message || String(err), "err");
  }
}

async function printNow() {
  if (!printer.connected) {
    log(t("log.connectFirst"), "warn");
    return;
  }
  if (!studio.slots.some((s) => s.bitmap) && studio.stickers.length === 0) {
    log(t("log.addContent"), "warn");
    return;
  }

  els.printBtn.disabled = true;
  setProgress(0, t("progress.prep"));
  try {
    log(t("log.render"));
    const stage = await studio.renderExport();
    const { jpeg } = await prepareStageCanvas(stage, { quality: 0.92 });
    log(t("log.sending", { kb: Math.round(jpeg.byteLength / 1024) }));
    await printer.printJpeg(jpeg, {
      onProgress: (pct) =>
        setProgress(pct, pct < 100 ? t("progress.send", { pct }) : t("progress.printing")),
    });
    setProgress(100, t("progress.done"));
    log(t("log.transferOk"), "ok");
    await printer.getStatus().catch(() => {});
    renderStatus();
  } catch (err) {
    log(err.message || String(err), "err");
    setProgress(null);
  } finally {
    setPrinterUi();
    setTimeout(() => setProgress(null), 2500);
  }
}

function refreshLocalizedUi() {
  buildCollages();
  if (catalogCache) {
    buildStickerCats(catalogCache);
    renderCanonStickers(catalogCache);
    // patterns/frames/effects keep structure; refresh "Aucun" labels
    els.patternList.innerHTML = "";
    buildPatterns(catalogCache);
    els.frameList.innerHTML = "";
    buildFrames(catalogCache);
    els.effectList.innerHTML = "";
    buildEffects(catalogCache);
  }
  els.emojiCats.innerHTML = "";
  buildEmojis();
  setPrinterUi();
  renderStatus();
  updateSelectionLabel();
}

function setLangMenuOpen(open) {
  const root = $("#lang-switch");
  const trigger = $("#lang-trigger");
  const menu = $("#lang-menu");
  if (!root || !trigger || !menu) return;
  root.classList.toggle("is-open", open);
  menu.hidden = !open;
  trigger.setAttribute("aria-expanded", open ? "true" : "false");
}

function wireLangSwitch() {
  const root = $("#lang-switch");
  const trigger = $("#lang-trigger");
  const menu = $("#lang-menu");
  if (!root || !trigger || !menu) return;

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    setLangMenuOpen(menu.hidden);
  });

  menu.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-lang]");
    if (!btn) return;
    setLang(btn.getAttribute("data-lang"));
    setLangMenuOpen(false);
  });

  document.addEventListener("click", (e) => {
    if (!root.contains(e.target)) setLangMenuOpen(false);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setLangMenuOpen(false);
  });
}

async function boot() {
  initI18n();
  onLangChange(() => refreshLocalizedUi());
  wireLangSwitch();
  wireTabs();
  buildCollages();
  wireOrientation();
  wireAdjustments();
  buildTextTools();
  wirePhotoTools();

  if (!serialSupported()) {
    els.support.hidden = false;
    els.connectBtn.disabled = true;
    log(t("log.noSerial"), "warn");
  } else {
    els.support.hidden = true;
  }

  setPrinterUi();
  renderStatus();
  updateSelectionLabel();

  els.connectBtn.addEventListener("click", connect);
  els.disconnectBtn.addEventListener("click", disconnect);
  els.handshakeBtn.addEventListener("click", retryHandshake);
  els.refreshBtn.addEventListener("click", refresh);
  els.printBtn.addEventListener("click", printNow);
  els.addPhotoQuickBtn?.addEventListener("click", () => studio.pickPhotoForSlot());
  els.addTextBtn.addEventListener("click", () => {
    const value = prompt(t("prompt.newText"), t("prompt.newTextDefault"));
    if (value) studio.addText(value);
  });
  els.gotoStickersBtn?.addEventListener("click", () => {
    activateTab("stickers");
  });
  els.smaller.addEventListener("click", () => studio.scaleSelection(0.9));
  els.bigger.addEventListener("click", () => studio.scaleSelection(1.1));
  els.rotL.addEventListener("click", () => studio.rotateSelection(-0.15));
  els.rotR.addEventListener("click", () => studio.rotateSelection(0.15));
  els.del.addEventListener("click", () => studio.deleteSelection());

  els.logToggle.addEventListener("click", () => {
    setLogOpen(els.logPopover.hidden);
  });
  els.logClose.addEventListener("click", () => setLogOpen(false));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setLogOpen(false);
  });

  window.addEventListener("keydown", (e) => {
    if (e.target.matches("input, textarea")) return;
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      studio.deleteSelection();
    }
    if (e.key === "+" || e.key === "=") studio.scaleSelection(1.1);
    if (e.key === "-") studio.scaleSelection(0.9);
    if (e.key === "ArrowLeft") studio.nudgeSelection(-12, 0);
    if (e.key === "ArrowRight") studio.nudgeSelection(12, 0);
    if (e.key === "ArrowUp") studio.nudgeSelection(0, -12);
    if (e.key === "ArrowDown") studio.nudgeSelection(0, 12);
  });

  try {
    if (document.fonts?.ready) await document.fonts.ready;
  } catch {
    /* ignore */
  }

  try {
    log(t("log.loadingCatalog"));
    const catalog = await studio.loadCatalog();
    catalogCache = catalog;
    buildEmojis();
    buildStickerCats(catalog);
    renderCanonStickers(catalog);
    buildFrames(catalog);
    buildEffects(catalog);
    buildPatterns(catalog);
    await studio.render();
    log(
      t("log.readyStudio", {
        frames: catalog.frames.length,
        stickers: catalog.stickers.length,
        effects: catalog.effects.length,
      }),
      "ok",
    );
  } catch (err) {
    log(t("log.catalogErr", { msg: err.message }), "err");
    await studio.render();
  }
}

boot();
