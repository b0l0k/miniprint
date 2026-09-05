import { PRINT_START_HEIGHT, PRINT_START_WIDTH } from "./image.js?v=3";
import { asset, rebasePaths } from "./base.js?v=3";
import {
  applyCanonEffect,
  drawAdjusted,
  drawFitted,
  loadImage,
  pathRoundRect,
} from "./filters.js?v=3";
import { t } from "./i18n.js?v=6";

export const COLLAGES = [
  { id: "single", labelKey: "collage.single", slots: [{ x: 0, y: 0, w: 1, h: 1 }] },
  {
    id: "split-v",
    labelKey: "collage.split-v",
    slots: [
      { x: 0, y: 0, w: 1, h: 0.5 },
      { x: 0, y: 0.5, w: 1, h: 0.5 },
    ],
  },
  {
    id: "split-h",
    labelKey: "collage.split-h",
    slots: [
      { x: 0, y: 0, w: 0.5, h: 1 },
      { x: 0.5, y: 0, w: 0.5, h: 1 },
    ],
  },
  {
    id: "feature",
    labelKey: "collage.feature",
    slots: [
      { x: 0, y: 0, w: 1, h: 0.62 },
      { x: 0, y: 0.62, w: 0.5, h: 0.38 },
      { x: 0.5, y: 0.62, w: 0.5, h: 0.38 },
    ],
  },
  {
    id: "grid4",
    labelKey: "collage.grid4",
    slots: [
      { x: 0, y: 0, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0, w: 0.5, h: 0.5 },
      { x: 0, y: 0.5, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
    ],
  },
  {
    id: "strip3",
    labelKey: "collage.strip3",
    slots: [
      { x: 0, y: 0, w: 1, h: 1 / 3 },
      { x: 0, y: 1 / 3, w: 1, h: 1 / 3 },
      { x: 0, y: 2 / 3, w: 1, h: 1 / 3 },
    ],
  },
];

/**
 * Papier sticker rond pré-découpé (mode « Pre-Cut Sticker » de l’appli Canon).
 * Deux pastilles empilées, cotes relatives à la hauteur de la feuille 1280×1920.
 * Ø 0.46326·H ≈ 890 px ≈ 35 mm, marge haute/basse 0.0269·H, entre-deux 0.0197·H.
 */
export const PRECUT = {
  centerX: 0.5,
  centersY: [0.25853, 0.74147],
  outerRadius: 0.23163,
  innerRadius: 0.19029,
  dashes: 45,
};

const emojiCache = new Map();
function emojiCanvas(emoji, size = 256) {
  const key = `${emoji}@${size}`;
  if (emojiCache.has(key)) return emojiCache.get(key);
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  ctx.font = `${Math.floor(size * 0.78)}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji, size / 2, size / 2 + size * 0.04);
  emojiCache.set(key, c);
  return c;
}

/**
 * Éditeur MiniPrint — collages, stickers Canon, cadres, effets, réglages.
 */
export class Studio {
  W = PRINT_START_WIDTH;
  H = PRINT_START_HEIGHT;
  /** @type {'portrait'|'landscape'|'round'} */
  orientation = "portrait";

  collageId = "single";
  /** @type {number|null} id cadre (null = aucun) */
  frameId = null;
  /** @type {number|null} */
  patternId = null;
  /** @type {number|null} */
  effectId = null;
  caption = "";
  gap = 16;
  bgColor = "#fff6ea";

  adjustments = {
    brightness: 0,
    contrast: 0,
    saturation: 0,
    warmth: 0,
    vignette: 0,
  };

  /** @type {any[]} */
  slots = [];
  /** @type {any[]} */
  stickers = [];
  /** @type {any[]} */
  texts = [];
  /** @type {null | { kind: string, index: number }} */
  selection = null;

  /** @type {any} */
  catalog = null;

  canvas;
  ctx;
  onChange = () => {};
  #drag = null;
  #fileInput;
  #pendingSlot = 0;
  #renderToken = 0;
  #lastFit = "";

  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.canvas.width = this.W;
    this.canvas.height = this.H;
    this.canvas.closest(".canvas-shell")?.setAttribute("data-orient", this.orientation);
    this.#fileInput = opts.fileInput ?? null;
    this.setCollage("single");
    this.#bindPointer();
    this.#bindResize();
    if (this.#fileInput) {
      this.#fileInput.addEventListener("change", () => this.#onFilePicked());
    }
  }

  /**
   * Fixe en pixels la zone canvas de la coque, au ratio exact du rendu.
   * `aspect-ratio` s’applique à la boîte de bordure : padding + bordure
   * décalaient le ratio de la zone utile, et un `100%` glissé dans une variable
   * CSS se résolvait sur la largeur d’un côté et sur la hauteur de l’autre.
   * Résultat : les ronds s’ovalisaient selon la taille de la fenêtre.
   */
  fitShell() {
    const shell = this.canvas.closest(".canvas-shell");
    const stage = shell?.parentElement;
    if (!shell || !stage) return;

    const shellStyle = getComputedStyle(shell);
    const num = (v) => {
      const n = parseFloat(v);
      return Number.isFinite(n) ? n : 0;
    };
    const chromeX =
      num(shellStyle.paddingLeft) +
      num(shellStyle.paddingRight) +
      num(shellStyle.borderLeftWidth) +
      num(shellStyle.borderRightWidth);
    const chromeY =
      num(shellStyle.paddingTop) +
      num(shellStyle.paddingBottom) +
      num(shellStyle.borderTopWidth) +
      num(shellStyle.borderBottomWidth);

    const stageStyle = getComputedStyle(stage);
    const limit = (v) => {
      const n = parseFloat(v);
      return Number.isFinite(n) && !String(v).includes("%") ? n : Infinity;
    };

    let maxW = limit(shellStyle.maxWidth);
    const innerW =
      stage.clientWidth - num(stageStyle.paddingLeft) - num(stageStyle.paddingRight);
    if (innerW > 0) maxW = Math.min(maxW, innerW);

    let maxH = limit(shellStyle.maxHeight);
    // En colonne unique la hauteur du stage dépend de son contenu : s’en servir
    // créerait une boucle de redimensionnement.
    if (stageStyle.getPropertyValue("--stage-fluid").trim() !== "1") {
      const hint = stage.querySelector(".stage-hint");
      const gap = num(stageStyle.rowGap);
      const innerH =
        stage.clientHeight -
        num(stageStyle.paddingTop) -
        num(stageStyle.paddingBottom) -
        (hint ? hint.offsetHeight + gap : 0);
      if (innerH > 0) maxH = Math.min(maxH, innerH);
    }

    const boxW = maxW - chromeX;
    const boxH = maxH - chromeY;
    if (!(boxW > 40)) return;

    const ratio = this.W / this.H;
    const w = Math.max(40, Math.min(boxW, boxH * ratio));
    const next = `${w + chromeX}px|${w / ratio + chromeY}px`;
    if (next === this.#lastFit) return;
    this.#lastFit = next;
    const [width, height] = next.split("|");
    shell.style.width = width;
    shell.style.height = height;
  }

  #bindResize() {
    const shell = this.canvas.closest(".canvas-shell");
    const stage = shell?.parentElement;
    this.fitShell();
    if (stage && typeof ResizeObserver !== "undefined") {
      new ResizeObserver(() => this.fitShell()).observe(stage);
    }
    window.addEventListener("resize", () => this.fitShell());
  }

  async loadCatalog(url = asset("assets/canon/catalog.json?v=7")) {
    const res = await fetch(url);
    this.catalog = rebasePaths(await res.json());
    // précharge cadre + thumbs utiles
    const frame = this.catalog.frames.find((f) => f.id === this.frameId);
    if (frame) loadImage(frame.src).catch(() => {});
    return this.catalog;
  }

  get collage() {
    return COLLAGES.find((c) => c.id === this.collageId) ?? COLLAGES[0];
  }

  get selectedEffect() {
    return this.catalog?.effects?.find((e) => e.id === this.effectId) ?? null;
  }

  get selectedFrame() {
    return this.catalog?.frames?.find((f) => f.id === this.frameId) ?? null;
  }

  get selectedPattern() {
    return this.catalog?.patterns?.find((p) => p.id === this.patternId) ?? null;
  }

  /** Le papier pré-découpé impose la mise en page (2 pastilles). */
  get isRound() {
    return this.orientation === "round";
  }

  setCollage(id) {
    if (this.isRound) return;
    this.collageId = id;
    this.#syncSlotCount();
    this.selection = null;
    this.queueRender();
  }

  /**
   * Emplacements photo du mode courant, en pixels canvas.
   * @returns {{ x: number, y: number, w: number, h: number, shape: 'rect'|'circle', cx?: number, cy?: number, r?: number }[]}
   */
  slotRects() {
    if (this.isRound) {
      const r = PRECUT.outerRadius * this.H;
      const cx = PRECUT.centerX * this.W;
      return PRECUT.centersY.map((ratio) => {
        const cy = ratio * this.H;
        return {
          x: cx - r,
          y: cy - r,
          w: r * 2,
          h: r * 2,
          shape: "circle",
          cx,
          cy,
          r,
        };
      });
    }
    const gap = this.gap;
    return this.collage.slots.map((s) => ({
      x: s.x * this.W + gap / 2,
      y: s.y * this.H + gap / 2,
      w: s.w * this.W - gap,
      h: s.h * this.H - gap,
      shape: "rect",
    }));
  }

  /**
   * Bascule portrait (1280×1920) / paysage (1920×1280) / rond (stickers pré-découpés).
   * @param {'portrait'|'landscape'|'round'} orient
   */
  setOrientation(orient) {
    if (orient !== "portrait" && orient !== "landscape" && orient !== "round") return;
    if (orient === this.orientation) return;

    const oldW = this.W;
    const oldH = this.H;
    this.orientation = orient;
    if (orient === "landscape") {
      this.W = PRINT_START_HEIGHT;
      this.H = PRINT_START_WIDTH;
    } else {
      this.W = PRINT_START_WIDTH;
      this.H = PRINT_START_HEIGHT;
    }

    for (const s of this.stickers) {
      s.x = (s.x / oldW) * this.W;
      s.y = (s.y / oldH) * this.H;
    }
    for (const t of this.texts) {
      t.x = (t.x / oldW) * this.W;
      t.y = (t.y / oldH) * this.H;
    }

    // Une photo « ajustée » perdrait ses coins dans la pastille : l’appli Canon
    // recadre au centre, on fait pareil.
    if (this.isRound) {
      for (const slot of this.slots) {
        if (slot.bitmap && (slot.fit ?? "contain") === "contain") {
          slot.fit = "cover";
          slot.panX = 0;
          slot.panY = 0;
        }
      }
    }

    this.#syncSlotCount();
    this.selection = null;
    this.canvas.width = this.W;
    this.canvas.height = this.H;
    this.canvas.closest(".canvas-shell")?.setAttribute("data-orient", orient);
    document.documentElement.dataset.orient = orient;
    this.#lastFit = "";
    this.fitShell();
    this.queueRender();
    this.onChange();
  }

  #syncSlotCount() {
    const n = this.slotRects().length;
    while (this.slots.length < n) this.slots.push(emptySlot());
    if (this.slots.length > n) {
      for (let i = n; i < this.slots.length; i++) this.slots[i].bitmap?.close?.();
      this.slots.length = n;
    }
  }

  setFrame(id) {
    this.frameId = id;
    this.queueRender();
  }

  setPattern(id) {
    this.patternId = id;
    this.queueRender();
  }

  setEffect(id) {
    this.effectId = id;
    this.queueRender();
  }

  setAdjustment(key, value) {
    this.adjustments[key] = Number(value);
    this.queueRender();
  }

  resetAdjustments() {
    this.adjustments = {
      brightness: 0,
      contrast: 0,
      saturation: 0,
      warmth: 0,
      vignette: 0,
    };
    this.queueRender();
  }

  /** Pastille visée par les ajouts : celle sélectionnée, sinon la première. */
  #activeSlotRect() {
    const rects = this.slotRects();
    const i = this.selection?.kind === "slot" ? this.selection.index : 0;
    return rects[i] ?? rects[0];
  }

  /**
   * Point d’apparition d’un sticker / texte. En rond, on vise la pastille
   * active : hors pastille l’élément serait masqué à l’impression.
   */
  #spawnPoint() {
    if (this.isRound) {
      const rect = this.#activeSlotRect();
      const angle = Math.random() * Math.PI * 2;
      const dist = rect.r * 0.4 * Math.random();
      return {
        x: rect.cx + Math.cos(angle) * dist,
        y: rect.cy + Math.sin(angle) * dist,
      };
    }
    return {
      x: this.W * (0.35 + Math.random() * 0.3),
      y: this.H * (0.35 + Math.random() * 0.3),
    };
  }

  addEmojiSticker(emoji) {
    this.stickers.push({
      id: uid(),
      type: "emoji",
      ...this.#spawnPoint(),
      emoji,
      scale: 1,
      rotation: (Math.random() - 0.5) * 0.35,
      flipX: false,
    });
    this.selection = { kind: "sticker", index: this.stickers.length - 1 };
    this.queueRender();
  }

  addCanonSticker(sticker) {
    this.stickers.push({
      id: uid(),
      type: "canon",
      src: sticker.src,
      stickerId: sticker.id,
      ...this.#spawnPoint(),
      scale: 0.85,
      rotation: (Math.random() - 0.5) * 0.3,
      flipX: false,
    });
    this.selection = { kind: "sticker", index: this.stickers.length - 1 };
    loadImage(sticker.src).then(() => this.queueRender());
    this.queueRender();
  }

  addText(text = "Hello !") {
    const anchor = this.isRound
      ? this.#activeSlotRect()
      : { cx: this.W / 2, cy: this.H * 0.82, r: 0 };
    this.texts.push({
      id: uid(),
      text,
      x: anchor.cx,
      y: anchor.cy + anchor.r * 0.55,
      size: 72,
      color: "#ff6b9d",
      font: "Mini Gochi",
      weight: "700",
      rotation: -0.05,
    });
    this.selection = { kind: "text", index: this.texts.length - 1 };
    this.queueRender();
  }

  /** @param {{ text?: string, font?: string, color?: string, size?: number, weight?: string }} props */
  updateSelectedText(props) {
    if (this.selection?.kind !== "text") return;
    const item = this.texts[this.selection.index];
    if (!item) return;
    Object.assign(item, props);
    this.queueRender();
  }

  deleteSelection() {
    if (!this.selection) return;
    const { kind, index } = this.selection;
    if (kind === "sticker") this.stickers.splice(index, 1);
    else if (kind === "text") this.texts.splice(index, 1);
    else if (kind === "slot") {
      this.slots[index]?.bitmap?.close?.();
      this.slots[index] = emptySlot();
    }
    this.selection = null;
    this.queueRender();
  }

  nudgeSelection(dx, dy) {
    if (this.selection?.kind === "slot") {
      const slot = this.slots[this.selection.index];
      if (!slot?.bitmap || slot.fit === "stretch") return;
      const local = this.#slotPanDelta(slot, dx, dy);
      slot.panX = (slot.panX || 0) + local.dx / this.W;
      slot.panY = (slot.panY || 0) + local.dy / this.H;
      this.#clampSlotPan(this.selection.index);
      this.queueRender();
      return;
    }
    const item = this.#selectedItem();
    if (!item) return;
    item.x += dx;
    item.y += dy;
    this.queueRender();
  }

  scaleSelection(factor) {
    const item = this.#selectedItem();
    if (this.selection?.kind === "slot") {
      const slot = this.slots[this.selection.index];
      if (!slot?.bitmap) return;
      slot.zoom = clamp((slot.zoom || 1) * factor, 0.4, 4);
      this.#clampSlotPan(this.selection.index);
      this.queueRender();
      return;
    }
    if (!item) return;
    if ("scale" in item) item.scale = clamp(item.scale * factor, 0.2, 4);
    if ("size" in item) item.size = clamp(item.size * factor, 24, 220);
    this.queueRender();
  }

  /**
   * @param {'contain'|'cover'|'stretch'} fit
   */
  setSlotFit(fit) {
    if (this.selection?.kind !== "slot") return;
    const slot = this.slots[this.selection.index];
    if (!slot?.bitmap) return;
    slot.fit = fit;
    if (fit === "stretch") {
      slot.panX = 0;
      slot.panY = 0;
      slot.zoom = 1;
    } else {
      this.#clampSlotPan(this.selection.index);
    }
    this.queueRender();
  }

  rotateSelection(delta) {
    const sel = this.selection;
    if (sel?.kind === "slot") {
      const slot = this.slots[sel.index];
      if (!slot?.bitmap) return;
      // Photos : quarts de tour (90°) — ↺/↻ pour mettre à l’envers, etc.
      const step = delta < 0 ? -1 : 1;
      slot.rotQuarters = (((slot.rotQuarters || 0) + step) % 4 + 4) % 4;
      this.queueRender();
      return;
    }
    const item = this.#selectedItem();
    if (!item) return;
    const { angle } = snapRotation(item.rotation + delta);
    item.rotation = angle;
    this.queueRender();
  }

  /** Miroir horizontal (photo, sticker, emoji). */
  flipSelection() {
    const sel = this.selection;
    if (!sel) return;
    if (sel.kind === "slot") {
      const slot = this.slots[sel.index];
      if (!slot?.bitmap) return;
      slot.flipX = !slot.flipX;
      // Le pan suit le miroir pour que le cadrage ne « saute » pas.
      slot.panX = -(slot.panX || 0);
      this.queueRender();
      return;
    }
    if (sel.kind === "sticker") {
      const s = this.stickers[sel.index];
      if (!s) return;
      s.flipX = !s.flipX;
      this.queueRender();
    }
  }

  /** Remet la rotation de la sélection à 0° (droit). */
  resetSelectionRotation() {
    const item = this.#selectedItem();
    if (!item || this.selection?.kind === "slot") return;
    item.rotation = 0;
    this.queueRender();
  }

  pickPhotoForSlot(index = null) {
    let i = index;
    if (i == null) {
      if (this.selection?.kind === "slot") i = this.selection.index;
      else i = this.slots.findIndex((s) => !s.bitmap);
      if (i < 0) i = 0;
    }
    this.selection = { kind: "slot", index: i };
    this.#pendingSlot = i;
    this.#fileInput?.click();
  }

  async #onFilePicked() {
    const file = this.#fileInput?.files?.[0];
    if (this.#fileInput) this.#fileInput.value = "";
    if (!file) return;
    await this.setSlotImage(this.#pendingSlot, file);
  }

  async setSlotImage(index, file) {
    const bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
    });
    this.slots[index]?.bitmap?.close?.();
    this.slots[index] = {
      bitmap,
      fit: this.isRound ? "cover" : "contain",
      panX: 0,
      panY: 0,
      zoom: 1,
      flipX: false,
      rotQuarters: 0,
    };
    this.selection = { kind: "slot", index };
    this.queueRender();
  }

  queueRender() {
    this.onChange();
    const token = ++this.#renderToken;
    // microtask + rAF pour regrouper
    Promise.resolve().then(() => {
      if (token !== this.#renderToken) return;
      requestAnimationFrame(() => {
        if (token !== this.#renderToken) return;
        this.render().catch((e) => console.error(e));
      });
    });
  }

  async renderExport() {
    const out = document.createElement("canvas");
    out.width = this.W;
    out.height = this.H;
    await this.#paint(out.getContext("2d"), { showUi: false });
    return out;
  }

  async render() {
    await this.#paint(this.ctx, { showUi: true });
  }

  async #paint(ctx, { showUi }) {
    const W = this.W;
    const H = this.H;
    ctx.clearRect(0, 0, W, H);

    // Fond / motif
    const pattern = this.selectedPattern;
    if (pattern) {
      try {
        const img = await loadImage(pattern.src);
        this.#drawPortraitAsset(ctx, img, W, H);
      } catch {
        ctx.fillStyle = this.bgColor;
        ctx.fillRect(0, 0, W, H);
      }
    } else {
      ctx.fillStyle = this.bgColor;
      ctx.fillRect(0, 0, W, H);
    }

    // Couche photos (plein format — le cadre Canon masque avec son alpha)
    const photoLayer = document.createElement("canvas");
    photoLayer.width = W;
    photoLayer.height = H;
    const pctx = photoLayer.getContext("2d");
    if (!pattern) {
      pctx.fillStyle = this.bgColor;
      pctx.fillRect(0, 0, W, H);
    }

    const rects = this.slotRects();
    rects.forEach((rect, i) => this.#drawSlot(pctx, this.slots[i], rect));

    // Ajustements lumière sur la couche photo
    const adjLayer = document.createElement("canvas");
    adjLayer.width = W;
    adjLayer.height = H;
    const actx = adjLayer.getContext("2d");
    drawAdjusted(actx, photoLayer, 0, 0, W, H, this.adjustments);

    // Effet Canon
    await applyCanonEffect(actx, this.selectedEffect, 0, 0, W, H);

    ctx.drawImage(adjLayer, 0, 0);

    // Cadre Canon par-dessus (assets portrait → rotés en paysage).
    // Sans objet en rond : le cadre borde la feuille, donc hors pastilles.
    const frame = this.isRound ? null : this.selectedFrame;
    if (frame) {
      try {
        const img = await loadImage(frame.src);
        this.#drawPortraitAsset(ctx, img, W, H);
      } catch {
        /* ignore */
      }
    }

    // Stickers
    for (let i = 0; i < this.stickers.length; i++) {
      const s = this.stickers[i];
      const size = 220 * s.scale;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.rotation);
      if (s.flipX) ctx.scale(-1, 1);
      if (s.type === "emoji") {
        const img = emojiCanvas(s.emoji, 256);
        ctx.drawImage(img, -size / 2, -size / 2, size, size);
      } else {
        try {
          const img = await loadImage(s.src);
          const ratio = img.width / img.height;
          let dw = size;
          let dh = size;
          if (ratio > 1) dh = size / ratio;
          else dw = size * ratio;
          ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
        } catch {
          /* ignore */
        }
      }
      if (showUi && this.selection?.kind === "sticker" && this.selection.index === i) {
        const b = this.#itemBounds(s, "sticker");
        this.#drawTransformHandles(ctx, b.halfW, b.halfH, {
          snapped: this.#drag?.kind === "rotate" && this.#drag.snapped,
        });
      }
      ctx.restore();
    }

    // Textes
    this.texts.forEach((t, i) => {
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.rotate(t.rotation);
      const family = t.font || "Mini Gochi";
      const weight = t.weight || "700";
      ctx.font = `${weight} ${t.size}px "${family}", "Nunito", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = Math.max(6, t.size * 0.1);
      ctx.strokeStyle = "rgba(255,255,255,0.92)";
      ctx.strokeText(t.text, 0, 0);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, 0, 0);
      if (showUi && this.selection?.kind === "text" && this.selection.index === i) {
        const b = this.#itemBounds(t, "text");
        this.#drawTransformHandles(ctx, b.halfW, b.halfH, {
          snapped: this.#drag?.kind === "rotate" && this.#drag.snapped,
        });
      }
      ctx.restore();
    });

    // Papier pré-découpé : hors pastilles, rien n’est imprimé.
    if (this.isRound) this.#maskPrecut(ctx, rects);

    // UI slots (contours) par-dessus pour l’édition
    if (showUi) {
      rects.forEach((rect, i) => {
        const { x, y, w, h } = rect;
        const selected =
          this.selection?.kind === "slot" && this.selection.index === i;
        const empty = !this.slots[i]?.bitmap;

        if (rect.shape === "circle") {
          if (empty) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(rect.cx, rect.cy, rect.r - 20, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(255,255,255,0.55)";
            ctx.fill();
            ctx.fillStyle = "#ff6b9d";
            ctx.font = `700 ${Math.min(48, w * 0.1)}px Manrope, sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("＋ Photo", rect.cx, rect.cy);
            ctx.restore();
          }
          // Doublé de blanc : les repères doivent rester lisibles sur une photo sombre.
          ctx.save();
          ctx.beginPath();
          ctx.arc(rect.cx, rect.cy, rect.r, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(255,255,255,0.9)";
          ctx.lineWidth = selected ? 14 : 10;
          ctx.stroke();
          ctx.strokeStyle = selected ? "#ff6b9d" : "rgba(255,107,157,0.7)";
          ctx.lineWidth = selected ? 8 : 4;
          ctx.stroke();

          // Repère intérieur pointillé, 45 tirets comme dans l’appli Canon.
          const guide = PRECUT.innerRadius * H;
          const dash = (Math.PI * guide) / PRECUT.dashes;
          ctx.setLineDash([dash, dash]);
          ctx.beginPath();
          ctx.arc(rect.cx, rect.cy, guide, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(255,255,255,0.9)";
          ctx.lineWidth = 10;
          ctx.stroke();
          ctx.strokeStyle = selected ? "#ff6b9d" : "rgba(255,107,157,0.65)";
          ctx.lineWidth = 4;
          ctx.stroke();
          ctx.restore();
          return;
        }

        if (empty) {
          ctx.save();
          pathRoundRect(ctx, x + 24, y + 24, w - 48, h - 48, 28);
          ctx.fillStyle = "rgba(255,255,255,0.55)";
          ctx.fill();
          ctx.fillStyle = "#ff6b9d";
          ctx.font = `700 ${Math.min(48, w * 0.07)}px Manrope, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("＋ Photo", x + w / 2, y + h / 2);
          ctx.restore();
        }
        ctx.strokeStyle = selected ? "#ff6b9d" : "rgba(255,107,157,0.25)";
        ctx.lineWidth = selected ? 6 : 2;
        pathRoundRect(ctx, x, y, w, h, 18);
        ctx.stroke();
      });
    }
  }

  /** Blanchit tout ce qui tombe hors des pastilles (cf. PrecutMask de l’appli). */
  #maskPrecut(ctx, rects) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, this.W, this.H);
    for (const rect of rects) {
      ctx.moveTo(rect.cx + rect.r, rect.cy);
      ctx.arc(rect.cx, rect.cy, rect.r, 0, Math.PI * 2);
    }
    ctx.fillStyle = "#ffffff";
    ctx.fill("evenodd");
    ctx.restore();
  }

  /**
   * Dessine un asset conçu en portrait (cadre / motif) dans le canvas courant.
   * En paysage : rotation 90° CW pour coller au format 1920×1280.
   */
  #drawPortraitAsset(ctx, img, W, H) {
    if (this.orientation !== "landscape") {
      ctx.drawImage(img, 0, 0, W, H);
      return;
    }
    ctx.save();
    ctx.translate(W, 0);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(img, 0, 0, H, W);
    ctx.restore();
  }

  #drawSlot(ctx, slot, rect) {
    const { x, y, w, h } = rect;
    ctx.save();
    if (rect.shape === "circle") {
      ctx.beginPath();
      ctx.arc(rect.cx, rect.cy, rect.r, 0, Math.PI * 2);
    } else {
      pathRoundRect(ctx, x, y, w, h, 8);
    }
    ctx.clip();
    if (slot?.bitmap) {
      const q = (((slot.rotQuarters || 0) % 4) + 4) % 4;
      const cx = x + w / 2;
      const cy = y + h / 2;
      ctx.translate(cx, cy);
      ctx.rotate((q * Math.PI) / 2);
      if (slot.flipX) ctx.scale(-1, 1);
      // À 90° / 270°, le rectangle local est tourné : on échange w/h.
      const fw = q % 2 === 1 ? h : w;
      const fh = q % 2 === 1 ? w : h;
      drawFitted(ctx, slot.bitmap, -fw / 2, -fh / 2, fw, fh, {
        fit: slot.fit || "contain",
        zoom: slot.zoom ?? 1,
        panX: slot.panX ?? 0,
        panY: slot.panY ?? 0,
      });
    } else if (!this.selectedPattern) {
      ctx.fillStyle = "#f3e6dc";
      ctx.fillRect(x, y, w, h);
    }
    ctx.restore();
  }

  /**
   * Delta écran → pan local (après rotQuarters + flipX).
   * @param {any} slot
   * @param {number} dx
   * @param {number} dy
   */
  #slotPanDelta(slot, dx, dy) {
    let lx = dx;
    let ly = dy;
    const q = (((slot.rotQuarters || 0) % 4) + 4) % 4;
    if (q === 1) [lx, ly] = [dy, -dx];
    else if (q === 2) [lx, ly] = [-dx, -dy];
    else if (q === 3) [lx, ly] = [-dy, dx];
    if (slot.flipX) lx = -lx;
    return { dx: lx, dy: ly };
  }

  #selectedItem() {
    if (!this.selection) return null;
    if (this.selection.kind === "sticker") return this.stickers[this.selection.index];
    if (this.selection.kind === "text") return this.texts[this.selection.index];
    return null;
  }

  /**
   * Demi-dimensions locales du cadre de sélection (après translate+rotate).
   * @param {any} item
   * @param {'sticker'|'text'} kind
   */
  #itemBounds(item, kind) {
    if (kind === "sticker") {
      const half = 220 * item.scale * 0.5 + 10;
      return { halfW: half, halfH: half };
    }
    const tw = this.#measureTextWidth(item);
    return {
      halfW: tw / 2 + 14,
      halfH: item.size / 2 + 12,
    };
  }

  #measureTextWidth(item) {
    const ctx = this.ctx;
    const family = item.font || "Mini Gochi";
    const weight = item.weight || "700";
    ctx.save();
    ctx.font = `${weight} ${item.size}px "${family}", "Nunito", sans-serif`;
    const w = ctx.measureText(item.text).width;
    ctx.restore();
    return w;
  }

  /**
   * Dessine cadre + 4 coins + poignée de rotation (espace local déjà transformé).
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} halfW
   * @param {number} halfH
   * @param {{ snapped?: boolean }} [opts]
   */
  #drawTransformHandles(ctx, halfW, halfH, opts = {}) {
    const hs = HANDLE_SIZE;
    const stem = ROTATE_STEM;
    const snapped = Boolean(opts.snapped);
    const corners = [
      [-halfW, -halfH],
      [halfW, -halfH],
      [halfW, halfH],
      [-halfW, halfH],
    ];

    ctx.save();
    ctx.setLineDash([]);

    // Cadre
    ctx.strokeStyle = snapped ? "#ff6b9d" : "rgba(255,107,157,0.95)";
    ctx.lineWidth = snapped ? 7 : 4;
    ctx.strokeRect(-halfW, -halfH, halfW * 2, halfH * 2);

    // Guide d’alignement quand aimanté
    if (snapped) {
      ctx.strokeStyle = "rgba(255,107,157,0.55)";
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.moveTo(-halfW - 24, 0);
      ctx.lineTo(halfW + 24, 0);
      ctx.moveTo(0, -halfH - 24);
      ctx.lineTo(0, halfH + 24);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Tige + poignée de rotation
    const ry = -halfH - stem;
    ctx.strokeStyle = "#ff6b9d";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -halfH);
    ctx.lineTo(0, ry);
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(0, ry, hs * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ff6b9d";
    ctx.lineWidth = 3;
    ctx.stroke();
    // Petite flèche courbe (suggestion rotation)
    ctx.beginPath();
    ctx.arc(0, ry, hs * 0.28, -0.8, Math.PI * 0.9);
    ctx.stroke();

    // Coins
    for (const [cx, cy] of corners) {
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#ff6b9d";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.rect(cx - hs / 2, cy - hs / 2, hs, hs);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  /** Point monde → local (centré, non tourné). */
  #toLocal(item, x, y) {
    const dx = x - item.x;
    const dy = y - item.y;
    const c = Math.cos(-item.rotation);
    const s = Math.sin(-item.rotation);
    let lx = dx * c - dy * s;
    const ly = dx * s + dy * c;
    if (item.flipX) lx = -lx;
    return { x: lx, y: ly };
  }

  /**
   * Poignée sous le pointeur pour un item sticker/texte.
   * @returns {null | { handle: 'rotate'|'nw'|'ne'|'se'|'sw' }}
   */
  #hitHandleOnItem(item, kind, x, y) {
    const b = this.#itemBounds(item, kind);
    const p = this.#toLocal(item, x, y);
    const hitR = HANDLE_SIZE * 0.75;
    const rotY = -b.halfH - ROTATE_STEM;
    if (Math.hypot(p.x - 0, p.y - rotY) <= hitR) return { handle: "rotate" };
    const corners = [
      ["nw", -b.halfW, -b.halfH],
      ["ne", b.halfW, -b.halfH],
      ["se", b.halfW, b.halfH],
      ["sw", -b.halfW, b.halfH],
    ];
    for (const [name, cx, cy] of corners) {
      if (Math.abs(p.x - cx) <= hitR && Math.abs(p.y - cy) <= hitR) {
        return { handle: name };
      }
    }
    return null;
  }

  #bindPointer() {
    const el = this.canvas;
    const pos = (e) => {
      const r = el.getBoundingClientRect();
      return {
        x: ((e.clientX - r.left) / r.width) * this.W,
        y: ((e.clientY - r.top) / r.height) * this.H,
      };
    };

    const cursorForHandle = (handle) => {
      if (handle === "rotate") return "grab";
      if (handle === "nw" || handle === "se") return "nwse-resize";
      if (handle === "ne" || handle === "sw") return "nesw-resize";
      return "move";
    };

    el.addEventListener("pointerdown", (e) => {
      el.setPointerCapture(e.pointerId);
      const p = pos(e);

      // Poignées de la sélection courante en priorité
      if (this.selection?.kind === "sticker" || this.selection?.kind === "text") {
        const item = this.#selectedItem();
        const h = item && this.#hitHandleOnItem(item, this.selection.kind, p.x, p.y);
        if (h?.handle === "rotate") {
          this.#drag = {
            kind: "rotate",
            index: this.selection.index,
            itemKind: this.selection.kind,
            startPointerAngle: Math.atan2(p.y - item.y, p.x - item.x),
            startRot: item.rotation,
            snapped: false,
          };
          el.style.cursor = "grabbing";
          this.queueRender();
          this.onChange();
          return;
        }
        if (h?.handle) {
          this.#drag = {
            kind: "scale",
            handle: h.handle,
            index: this.selection.index,
            itemKind: this.selection.kind,
            startDist: Math.max(8, Math.hypot(p.x - item.x, p.y - item.y)),
            startScale: item.scale ?? 1,
            startSize: item.size ?? 72,
          };
          el.style.cursor = cursorForHandle(h.handle);
          this.queueRender();
          this.onChange();
          return;
        }
      }

      const hit = this.#hitTest(p.x, p.y);
      this.selection = hit;
      if (hit?.kind === "sticker" || hit?.kind === "text") {
        const item = this.#selectedItem();
        this.#drag = {
          kind: hit.kind,
          index: hit.index,
          ox: p.x - item.x,
          oy: p.y - item.y,
        };
        el.style.cursor = "move";
      } else if (hit?.kind === "slot") {
        const slot = this.slots[hit.index];
        if (!slot?.bitmap) {
          this.pickPhotoForSlot(hit.index);
          this.#drag = null;
        } else if (slot.fit !== "stretch") {
          this.#drag = {
            kind: "slot-pan",
            index: hit.index,
            lastX: p.x,
            lastY: p.y,
          };
          el.style.cursor = "grabbing";
        } else {
          this.#drag = null;
        }
      } else {
        this.#drag = null;
      }
      this.queueRender();
      this.onChange();
    });

    el.addEventListener("pointermove", (e) => {
      if (!this.#drag) {
        const p = pos(e);
        if (this.selection?.kind === "sticker" || this.selection?.kind === "text") {
          const item = this.#selectedItem();
          const h = item && this.#hitHandleOnItem(item, this.selection.kind, p.x, p.y);
          if (h) {
            el.style.cursor = cursorForHandle(h.handle);
            return;
          }
        }
        const hit = this.#hitTest(p.x, p.y);
        const slot = hit?.kind === "slot" ? this.slots[hit.index] : null;
        if (hit?.kind === "sticker" || hit?.kind === "text") el.style.cursor = "move";
        else if (slot?.bitmap && slot.fit !== "stretch") el.style.cursor = "grab";
        else el.style.cursor = "default";
        return;
      }

      const p = pos(e);

      if (this.#drag.kind === "slot-pan") {
        const slot = this.slots[this.#drag.index];
        if (!slot?.bitmap) return;
        const dx = p.x - this.#drag.lastX;
        const dy = p.y - this.#drag.lastY;
        this.#drag.lastX = p.x;
        this.#drag.lastY = p.y;
        const local = this.#slotPanDelta(slot, dx, dy);
        slot.panX = (slot.panX || 0) + local.dx / this.W;
        slot.panY = (slot.panY || 0) + local.dy / this.H;
        this.#clampSlotPan(this.#drag.index);
        this.queueRender();
        return;
      }

      if (this.#drag.kind === "rotate") {
        const item =
          this.#drag.itemKind === "sticker"
            ? this.stickers[this.#drag.index]
            : this.texts[this.#drag.index];
        if (!item) return;
        const ang = Math.atan2(p.y - item.y, p.x - item.x);
        const raw = this.#drag.startRot + (ang - this.#drag.startPointerAngle);
        const { angle, snapped } = snapRotation(raw);
        item.rotation = angle;
        this.#drag.snapped = snapped;
        el.style.cursor = "grabbing";
        this.queueRender();
        return;
      }

      if (this.#drag.kind === "scale") {
        const item =
          this.#drag.itemKind === "sticker"
            ? this.stickers[this.#drag.index]
            : this.texts[this.#drag.index];
        if (!item) return;
        const dist = Math.max(8, Math.hypot(p.x - item.x, p.y - item.y));
        const factor = dist / this.#drag.startDist;
        if (this.#drag.itemKind === "sticker") {
          item.scale = clamp(this.#drag.startScale * factor, 0.2, 4);
        } else {
          item.size = clamp(this.#drag.startSize * factor, 24, 220);
        }
        this.queueRender();
        return;
      }

      const item =
        this.#drag.kind === "sticker"
          ? this.stickers[this.#drag.index]
          : this.texts[this.#drag.index];
      if (!item) return;
      item.x = p.x - this.#drag.ox;
      item.y = p.y - this.#drag.oy;
      this.queueRender();
    });

    el.addEventListener("pointerup", () => {
      if (this.#drag?.kind === "rotate" && this.#drag.snapped) {
        const item =
          this.#drag.itemKind === "sticker"
            ? this.stickers[this.#drag.index]
            : this.texts[this.#drag.index];
        if (item) {
          const { angle } = snapRotation(item.rotation);
          item.rotation = angle;
        }
      }
      this.#drag = null;
      el.style.cursor = "default";
      this.queueRender();
      this.onChange();
    });

    el.addEventListener("dblclick", (e) => {
      const p = pos(e);
      if (this.selection?.kind === "sticker" || this.selection?.kind === "text") {
        const item = this.#selectedItem();
        const h = item && this.#hitHandleOnItem(item, this.selection.kind, p.x, p.y);
        if (h?.handle === "rotate") {
          item.rotation = 0;
          this.queueRender();
          this.onChange();
          return;
        }
      }
      const hit = this.#hitTest(p.x, p.y);
      if (hit?.kind === "slot") this.pickPhotoForSlot(hit.index);
      if (hit?.kind === "text") {
        const next = prompt(t("prompt.text"), this.texts[hit.index].text);
        if (next != null) {
          this.texts[hit.index].text = next;
          this.queueRender();
        }
      }
    });
  }

  /**
   * Limite le pan pour que le mode Remplir reste plein cadre
   * (ou pour ne pas trop sortir en Ajuster + zoom).
   * @param {number} index
   */
  #clampSlotPan(index) {
    const slot = this.slots[index];
    const rect = this.slotRects()[index];
    if (!slot?.bitmap || !rect || slot.fit === "stretch") return;

    const q = (((slot.rotQuarters || 0) % 4) + 4) % 4;
    const w = q % 2 === 1 ? rect.h : rect.w;
    const h = q % 2 === 1 ? rect.w : rect.h;
    const iw = slot.bitmap.width;
    const ih = slot.bitmap.height;
    const zoom = slot.zoom ?? 1;
    const fit = slot.fit || "contain";
    const scale =
      (fit === "cover" ? Math.max(w / iw, h / ih) : Math.min(w / iw, h / ih)) *
      zoom;
    const dw = iw * scale;
    const dh = ih * scale;

    const maxPanX = Math.max(0, (dw - w) / (2 * w));
    const maxPanY = Math.max(0, (dh - h) / (2 * h));
    slot.panX = clamp(slot.panX || 0, -maxPanX, maxPanX);
    slot.panY = clamp(slot.panY || 0, -maxPanY, maxPanY);
  }

  #hitTest(x, y) {
    // Corps des stickers / textes (poignées déjà testées à part si sélectionnés)
    for (let i = this.stickers.length - 1; i >= 0; i--) {
      const s = this.stickers[i];
      const b = this.#itemBounds(s, "sticker");
      const p = this.#toLocal(s, x, y);
      if (Math.abs(p.x) <= b.halfW && Math.abs(p.y) <= b.halfH) {
        return { kind: "sticker", index: i };
      }
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      const b = this.#itemBounds(t, "text");
      const p = this.#toLocal(t, x, y);
      if (Math.abs(p.x) <= b.halfW && Math.abs(p.y) <= b.halfH) {
        return { kind: "text", index: i };
      }
    }
    const rects = this.slotRects();
    for (let i = 0; i < rects.length; i++) {
      const rect = rects[i];
      if (rect.shape === "circle") {
        if (Math.hypot(x - rect.cx, y - rect.cy) <= rect.r) {
          return { kind: "slot", index: i };
        }
        continue;
      }
      if (
        x >= rect.x &&
        x <= rect.x + rect.w &&
        y >= rect.y &&
        y <= rect.y + rect.h
      ) {
        return { kind: "slot", index: i };
      }
    }
    return null;
  }
}

function emptySlot() {
  return {
    bitmap: null,
    fit: "contain",
    panX: 0,
    panY: 0,
    zoom: 1,
    flipX: false,
    rotQuarters: 0,
  };
}
function uid() {
  return Math.random().toString(36).slice(2, 9);
}
function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

const HANDLE_SIZE = 36;
const ROTATE_STEM = 64;
const SNAP_THRESH = (6 * Math.PI) / 180;

/**
 * Aimante l’angle vers le multiple de 90° le plus proche.
 * @param {number} rad
 * @returns {{ angle: number, snapped: boolean }}
 */
function snapRotation(rad) {
  const step = Math.PI / 2;
  const nearest = Math.round(rad / step) * step;
  if (Math.abs(rad - nearest) <= SNAP_THRESH) {
    return { angle: nearest, snapped: true };
  }
  return { angle: rad, snapped: false };
}
