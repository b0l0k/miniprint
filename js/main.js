import { COLLAGES, Studio } from "./studio.js";
import { prepareStageCanvas } from "./image.js";
import { ZoeminiPrinter, serialSupported } from "./printer.js";

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
  emojiList: $("#emoji-list"),
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
  els.printerLabel.textContent = ok ? "Prête 💕" : link ? "Connectée…" : "Hors ligne";
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
  els.paper.textContent = s.noPaper ? "vide" : "ok";
  els.cover.textContent = s.coverOpen ? "open" : "ok";
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
    els.selLabel.textContent = "Rien de sélectionné";
    syncTextTools();
    syncPhotoTools();
    return;
  }
  if (sel.kind === "sticker") {
    const s = studio.stickers[sel.index];
    els.selLabel.textContent = s?.type === "emoji" ? `Sticker ${s.emoji}` : "Sticker Canon";
  } else if (sel.kind === "text") {
    els.selLabel.textContent = `Texte « ${studio.texts[sel.index]?.text ?? ""} »`;
  } else if (sel.kind === "slot") {
    const slot = studio.slots[sel.index];
    els.selLabel.textContent = slot?.bitmap
      ? `Photo ${sel.index + 1}`
      : `Emplacement ${sel.index + 1} (vide)`;
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
    const t = studio.texts[studio.selection.index];
    const next = prompt("Texte :", t?.text ?? "");
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
  COLLAGES.forEach((c) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip" + (c.id === studio.collageId ? " is-active" : "");
    btn.textContent = c.label;
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
        ? "Format paysage — l’impression pivote pour le papier Zoemini."
        : "Format portrait.",
      "ok",
    );
  });
}

function buildPatterns(catalog) {
  const none = document.createElement("button");
  none.type = "button";
  none.className = "pattern-btn is-none is-active";
  none.textContent = "Aucun";
  none.addEventListener("click", () => {
    studio.setPattern(null);
    [...els.patternList.children].forEach((el) => el.classList.toggle("is-active", el === none));
  });
  els.patternList.appendChild(none);

  catalog.patterns.forEach((p) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pattern-btn";
    btn.title = `Motif ${p.id}`;
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

function buildEmojis(catalog) {
  (catalog.emojiStickers || []).forEach((emoji) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "sticker-btn";
    btn.textContent = emoji;
    btn.addEventListener("click", () => studio.addEmojiSticker(emoji));
    els.emojiList.appendChild(btn);
  });
}

function buildStickerCats(catalog) {
  const cats = [...new Set(catalog.stickers.map((s) => s.category))];
  if (!activeStickerCat) activeStickerCat = cats[0] || "all";
  const allCats = ["all", ...cats];
  allCats.forEach((cat) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cat-pill" + (cat === activeStickerCat ? " is-active" : "");
    btn.textContent = cat === "all" ? "Tous" : cat;
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
      btn.title = `Sticker ${s.id}`;
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
  none.title = "Sans cadre";
  none.textContent = "Aucun";
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
    btn.title = `Cadre ${f.id}`;
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
  none.innerHTML = "<span>Aucun</span>";
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
    log("Choisis l'imprimante (Canon / SPP)…");
    let port = await printer.pickPort({ preferGranted: true });
    try {
      const info = await printer.connect(port);
      renderStatus();
      setPrinterUi();
      log(
        `Prête · batterie ${info.status.batteryLevel}% · FW ${info.setting.firmwareVersion}`,
        "ok",
      );
      return;
    } catch (err) {
      if (err?.code !== "open_failed") throw err;

      // Port réutilisé souvent verrouillé (ChromeOS / getPorts).
      log("Port bloqué — oubli + nouvelle sélection…", "warn");
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
        `Prête · batterie ${info.status.batteryLevel}% · FW ${info.setting.firmwareVersion}`,
        "ok",
      );
    }
  } catch (err) {
    if (err?.name === "NotFoundError") log("Aucun appareil choisi.", "warn");
    else if (/user gesture|NotAllowedError|SecurityError/i.test(String(err?.message ?? err?.name ?? ""))) {
      log(
        "Chrome a besoin d’un nouveau clic. Reclique Connecter (imprimante appairée, appli Canon fermée).",
        "warn",
      );
    } else {
      log(err.message || String(err), "err");
      if (printer.linkOpen) log("Lien BT ouvert — tu peux relancer le handshake.", "warn");
    }
    setPrinterUi();
    renderStatus();
  } finally {
    els.connectBtn.disabled = false;
  }
}

async function retryHandshake() {
  try {
    log("Relance du handshake…");
    const info = await printer.handshake();
    renderStatus();
    setPrinterUi();
    log(
      `Handshake OK · batterie ${info.status.batteryLevel}% · FW ${info.setting.firmwareVersion}`,
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
  log("Déconnectée.");
}

async function refresh() {
  try {
    await printer.getStatus();
    await printer.getSetting();
    renderStatus();
    log("Statut rafraîchi.", "ok");
  } catch (err) {
    log(err.message || String(err), "err");
  }
}

async function printNow() {
  if (!printer.connected) {
    log("Connecte d'abord l'imprimante (Bluetooth).", "warn");
    return;
  }
  if (!studio.slots.some((s) => s.bitmap) && studio.stickers.length === 0) {
    log("Ajoute au moins une photo ou un sticker.", "warn");
    return;
  }

  els.printBtn.disabled = true;
  setProgress(0, "Préparation…");
  try {
    log("Rendu de la composition…");
    const stage = await studio.renderExport();
    const { jpeg } = await prepareStageCanvas(stage, { quality: 0.92 });
    log(`Envoi (${Math.round(jpeg.byteLength / 1024)} Ko)…`);
    await printer.printJpeg(jpeg, {
      onProgress: (pct) =>
        setProgress(pct, pct < 100 ? `Envoi ${pct}%` : "Impression…"),
    });
    setProgress(100, "C'est parti !");
    log("Transfert OK — impression en cours.", "ok");
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

async function boot() {
  wireTabs();
  buildCollages();
  wireOrientation();
  wireAdjustments();
  buildTextTools();
  wirePhotoTools();

  if (!serialSupported()) {
    els.support.hidden = false;
    els.connectBtn.disabled = true;
    log("Web Serial indisponible — création OK, impression Chrome/Edge seulement.", "warn");
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
    const t = prompt("Ton texte :", "Hello !");
    if (t) studio.addText(t);
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
    log("Chargement des stickers & cadres Canon…");
    const catalog = await studio.loadCatalog();
    buildEmojis(catalog);
    buildStickerCats(catalog);
    renderCanonStickers(catalog);
    buildFrames(catalog);
    buildEffects(catalog);
    buildPatterns(catalog);
    await studio.render();
    log(
      `Atelier prêt ✨ ${catalog.frames.length} cadres · ${catalog.stickers.length} stickers · ${catalog.effects.length} effets`,
      "ok",
    );
  } catch (err) {
    log(`Catalogue Canon: ${err.message}`, "err");
    await studio.render();
  }
}

boot();
