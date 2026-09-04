import { PRINT_START_HEIGHT, PRINT_START_WIDTH } from "./image.js";
import { asset, rebasePaths } from "./base.js";
import {
  applyCanonEffect,
  drawAdjusted,
  drawFitted,
  loadImage,
  pathRoundRect,
} from "./filters.js";

export const COLLAGES = [
  { id: "single", label: "1 photo", slots: [{ x: 0, y: 0, w: 1, h: 1 }] },
  {
    id: "split-v",
    label: "2 haut/bas",
    slots: [
      { x: 0, y: 0, w: 1, h: 0.5 },
      { x: 0, y: 0.5, w: 1, h: 0.5 },
    ],
  },
  {
    id: "split-h",
    label: "2 côte à côte",
    slots: [
      { x: 0, y: 0, w: 0.5, h: 1 },
      { x: 0.5, y: 0, w: 0.5, h: 1 },
    ],
  },
  {
    id: "feature",
    label: "1 grande + 2",
    slots: [
      { x: 0, y: 0, w: 1, h: 0.62 },
      { x: 0, y: 0.62, w: 0.5, h: 0.38 },
      { x: 0.5, y: 0.62, w: 0.5, h: 0.38 },
    ],
  },
  {
    id: "grid4",
    label: "Grille 4",
    slots: [
      { x: 0, y: 0, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0, w: 0.5, h: 0.5 },
      { x: 0, y: 0.5, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
    ],
  },
  {
    id: "strip3",
    label: "Bande 3",
    slots: [
      { x: 0, y: 0, w: 1, h: 1 / 3 },
      { x: 0, y: 1 / 3, w: 1, h: 1 / 3 },
      { x: 0, y: 2 / 3, w: 1, h: 1 / 3 },
    ],
  },
];

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

  collageId = "single";
  /** @type {number|null} id cadre Canon */
  frameId = 110;
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

  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.canvas.width = this.W;
    this.canvas.height = this.H;
    this.#fileInput = opts.fileInput ?? null;
    this.setCollage("single");
    this.#bindPointer();
    if (this.#fileInput) {
      this.#fileInput.addEventListener("change", () => this.#onFilePicked());
    }
  }

  async loadCatalog(url = asset("assets/canon/catalog.json")) {
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

  setCollage(id) {
    this.collageId = id;
    const n = this.collage.slots.length;
    while (this.slots.length < n) this.slots.push(emptySlot());
    if (this.slots.length > n) {
      for (let i = n; i < this.slots.length; i++) this.slots[i].bitmap?.close?.();
      this.slots.length = n;
    }
    this.selection = null;
    this.queueRender();
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

  addEmojiSticker(emoji) {
    this.stickers.push({
      id: uid(),
      type: "emoji",
      emoji,
      x: this.W * (0.35 + Math.random() * 0.3),
      y: this.H * (0.35 + Math.random() * 0.3),
      scale: 1,
      rotation: (Math.random() - 0.5) * 0.35,
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
      x: this.W * (0.35 + Math.random() * 0.3),
      y: this.H * (0.35 + Math.random() * 0.3),
      scale: 0.85,
      rotation: (Math.random() - 0.5) * 0.3,
    });
    this.selection = { kind: "sticker", index: this.stickers.length - 1 };
    loadImage(sticker.src).then(() => this.queueRender());
    this.queueRender();
  }

  addText(text = "Hello !") {
    this.texts.push({
      id: uid(),
      text,
      x: this.W / 2,
      y: this.H * 0.82,
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
      slot.panX = (slot.panX || 0) + dx / this.W;
      slot.panY = (slot.panY || 0) + dy / this.H;
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
    const item = this.#selectedItem();
    if (!item || this.selection?.kind === "slot") return;
    item.rotation += delta;
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
    this.slots[index] = { bitmap, fit: "contain", panX: 0, panY: 0, zoom: 1 };
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
        ctx.drawImage(img, 0, 0, W, H);
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
    pctx.fillStyle = this.bgColor;
    pctx.fillRect(0, 0, W, H);

    const gap = this.gap;
    const layout = this.collage.slots;
    layout.forEach((slot, i) => {
      const x = slot.x * W + gap / 2;
      const y = slot.y * H + gap / 2;
      const w = slot.w * W - gap;
      const h = slot.h * H - gap;
      this.#drawSlot(pctx, this.slots[i], x, y, w, h, false, false);
    });

    // Ajustements lumière sur la couche photo
    const adjLayer = document.createElement("canvas");
    adjLayer.width = W;
    adjLayer.height = H;
    const actx = adjLayer.getContext("2d");
    drawAdjusted(actx, photoLayer, 0, 0, W, H, this.adjustments);

    // Effet Canon
    await applyCanonEffect(actx, this.selectedEffect, 0, 0, W, H);

    ctx.drawImage(adjLayer, 0, 0);

    // Cadre Canon par-dessus
    const frame = this.selectedFrame;
    if (frame) {
      try {
        const img = await loadImage(frame.src);
        ctx.drawImage(img, 0, 0, W, H);
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
        ctx.strokeStyle = "#ff6b9d";
        ctx.lineWidth = 5;
        ctx.setLineDash([12, 8]);
        ctx.strokeRect(-size / 2 - 10, -size / 2 - 10, size + 20, size + 20);
        ctx.setLineDash([]);
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
        const tw = ctx.measureText(t.text).width;
        ctx.strokeStyle = "#ff6b9d";
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 6]);
        ctx.strokeRect(-tw / 2 - 14, -t.size / 2 - 12, tw + 28, t.size + 24);
        ctx.setLineDash([]);
      }
      ctx.restore();
    });

    // UI slots (contours) par-dessus pour l’édition
    if (showUi) {
      layout.forEach((slot, i) => {
        const x = slot.x * W + gap / 2;
        const y = slot.y * H + gap / 2;
        const w = slot.w * W - gap;
        const h = slot.h * H - gap;
        const selected =
          this.selection?.kind === "slot" && this.selection.index === i;
        if (!this.slots[i]?.bitmap) {
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

  #drawSlot(ctx, slot, x, y, w, h) {
    ctx.save();
    pathRoundRect(ctx, x, y, w, h, 8);
    ctx.clip();
    if (slot?.bitmap) {
      drawFitted(ctx, slot.bitmap, x, y, w, h, {
        fit: slot.fit || "contain",
        zoom: slot.zoom ?? 1,
        panX: slot.panX ?? 0,
        panY: slot.panY ?? 0,
      });
    } else {
      ctx.fillStyle = "#f3e6dc";
      ctx.fillRect(x, y, w, h);
    }
    ctx.restore();
  }

  #selectedItem() {
    if (!this.selection) return null;
    if (this.selection.kind === "sticker") return this.stickers[this.selection.index];
    if (this.selection.kind === "text") return this.texts[this.selection.index];
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

    el.addEventListener("pointerdown", (e) => {
      el.setPointerCapture(e.pointerId);
      const p = pos(e);
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
      } else if (hit?.kind === "slot") {
        const slot = this.slots[hit.index];
        if (!slot?.bitmap) {
          this.pickPhotoForSlot(hit.index);
          this.#drag = null;
        } else if (slot.fit !== "stretch") {
          // Recadrage : glisser la photo (surtout utile en mode Remplir).
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
        const hit = this.#hitTest(p.x, p.y);
        const slot = hit?.kind === "slot" ? this.slots[hit.index] : null;
        el.style.cursor =
          slot?.bitmap && slot.fit !== "stretch" ? "grab" : "grab";
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
        slot.panX = (slot.panX || 0) + dx / this.W;
        slot.panY = (slot.panY || 0) + dy / this.H;
        this.#clampSlotPan(this.#drag.index);
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
      this.#drag = null;
      el.style.cursor = "grab";
      this.onChange();
    });

    el.addEventListener("dblclick", (e) => {
      const p = pos(e);
      const hit = this.#hitTest(p.x, p.y);
      if (hit?.kind === "slot") this.pickPhotoForSlot(hit.index);
      if (hit?.kind === "text") {
        const next = prompt("Texte :", this.texts[hit.index].text);
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
    const layout = this.collage.slots[index];
    if (!slot?.bitmap || !layout || slot.fit === "stretch") return;

    const gap = this.gap;
    const w = layout.w * this.W - gap;
    const h = layout.h * this.H - gap;
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
    for (let i = this.stickers.length - 1; i >= 0; i--) {
      const s = this.stickers[i];
      if (Math.hypot(x - s.x, y - s.y) <= 110 * s.scale) {
        return { kind: "sticker", index: i };
      }
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      if (Math.hypot(x - t.x, y - t.y) <= t.size * 1.2) {
        return { kind: "text", index: i };
      }
    }
    const gap = this.gap;
    for (let i = 0; i < this.collage.slots.length; i++) {
      const slot = this.collage.slots[i];
      const sx = slot.x * this.W + gap / 2;
      const sy = slot.y * this.H + gap / 2;
      const sw = slot.w * this.W - gap;
      const sh = slot.h * this.H - gap;
      if (x >= sx && x <= sx + sw && y >= sy && y <= sy + sh) {
        return { kind: "slot", index: i };
      }
    }
    return null;
  }
}

function emptySlot() {
  return { bitmap: null, fit: "contain", panX: 0, panY: 0, zoom: 1 };
}
function uid() {
  return Math.random().toString(36).slice(2, 9);
}
function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}
