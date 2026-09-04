/** Chargement & cache d’images. */
const cache = new Map();

/**
 * @param {string} src
 * @returns {Promise<HTMLImageElement>}
 */
export function loadImage(src) {
  if (cache.has(src)) return cache.get(src);
  const p = new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Impossible de charger ${src}`));
    img.src = src;
  });
  cache.set(src, p);
  return p;
}

const BLEND_MAP = {
  colorburn: "color-burn",
  "color-burn": "color-burn",
  multiply: "multiply",
  divide: "color-dodge", // approx navigateur
  hue: "hue",
  saturation: "saturation",
  hardlight: "hard-light",
  "hard-light": "hard-light",
  softlight: "soft-light",
  "soft-light": "soft-light",
  overlay: "overlay",
  vividlight: "hard-light",
  "vivid-light": "hard-light",
  linearburn: "color-burn",
  "linear-burn": "color-burn",
  darken: "darken",
  lighten: "lighten",
  screen: "screen",
  color: "color",
  luminosity: "luminosity",
};

/**
 * Applique luminosité / contraste / saturation / chaleur sur un canvas source → dest.
 * @param {CanvasRenderingContext2D} ctx
 * @param {CanvasImageSource} source
 * @param {number} dx
 * @param {number} dy
 * @param {number} dw
 * @param {number} dh
 * @param {{ brightness: number, contrast: number, saturation: number, warmth: number, vignette: number }} adj
 */
export function drawAdjusted(ctx, source, dx, dy, dw, dh, adj) {
  const b = 1 + (adj.brightness ?? 0) / 100;
  const c = 1 + (adj.contrast ?? 0) / 100;
  const s = 1 + (adj.saturation ?? 0) / 100;
  ctx.save();
  ctx.filter = `brightness(${b}) contrast(${c}) saturate(${s})`;
  ctx.drawImage(source, dx, dy, dw, dh);
  ctx.filter = "none";

  const warmth = adj.warmth ?? 0;
  if (warmth !== 0) {
    ctx.globalCompositeOperation = "soft-light";
    ctx.fillStyle =
      warmth > 0
        ? `rgba(255, 160, 60, ${Math.min(0.55, Math.abs(warmth) / 160)})`
        : `rgba(60, 120, 255, ${Math.min(0.55, Math.abs(warmth) / 160)})`;
    ctx.fillRect(dx, dy, dw, dh);
    ctx.globalCompositeOperation = "source-over";
  }

  const vig = adj.vignette ?? 0;
  if (vig > 0) {
    const g = ctx.createRadialGradient(
      dx + dw / 2,
      dy + dh / 2,
      Math.min(dw, dh) * 0.25,
      dx + dw / 2,
      dy + dh / 2,
      Math.max(dw, dh) * 0.75,
    );
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, `rgba(0,0,0,${Math.min(0.75, vig / 100)})`);
    ctx.fillStyle = g;
    ctx.fillRect(dx, dy, dw, dh);
  }
  ctx.restore();
}

/**
 * Applique un effet Canon (color tone) sur la zone déjà dessinée.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ filters: any[], base: string } | null} effect
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 */
export async function applyCanonEffect(ctx, effect, x, y, w, h) {
  if (!effect?.filters?.length) return;

  for (const f of effect.filters) {
    const strength = Array.isArray(f.adjusts) ? (f.adjusts[0] ?? 100) / 100 : 1;

    if (f.type === "colorinvert") {
      // snapshot region, invert, redraw
      const snap = ctx.getImageData(x, y, w, h);
      const d = snap.data;
      for (let i = 0; i < d.length; i += 4) {
        d[i] = 255 - d[i];
        d[i + 1] = 255 - d[i + 1];
        d[i + 2] = 255 - d[i + 2];
      }
      ctx.putImageData(snap, x, y);
      continue;
    }

    if (f.type === "sketch" || f.type === "sketchcrayola") {
      ctx.save();
      ctx.filter = "grayscale(1) contrast(1.35) brightness(1.05)";
      const tmp = document.createElement("canvas");
      tmp.width = w;
      tmp.height = h;
      tmp.getContext("2d").drawImage(ctx.canvas, x, y, w, h, 0, 0, w, h);
      ctx.filter = "none";
      ctx.drawImage(tmp, x, y);
      ctx.restore();
      continue;
    }

    if (f.type === "blend" && f.texture) {
      const tex = await loadImage(effect.base + f.texture);
      ctx.save();
      ctx.globalAlpha = strength;
      ctx.globalCompositeOperation = BLEND_MAP[String(f.mode).toLowerCase()] || "overlay";
      ctx.drawImage(tex, x, y, w, h);
      ctx.restore();
    }
  }
}

/**
 * Dessine une image dans un rectangle sans (ou avec) déformation selon `fit`.
 * - contain : image entière visible (défaut) — scale = min
 * - cover   : remplit le cadre (rogne) — scale = max
 * - stretch : étire aux dimensions du cadre
 * @param {CanvasRenderingContext2D} ctx
 * @param {CanvasImageSource & { width: number, height: number }} img
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {{ fit?: 'contain'|'cover'|'stretch', zoom?: number, panX?: number, panY?: number }} [opts]
 */
export function drawFitted(ctx, img, x, y, w, h, opts = {}) {
  const fit = opts.fit ?? "contain";
  const zoom = opts.zoom ?? 1;
  const panX = opts.panX ?? 0;
  const panY = opts.panY ?? 0;
  const iw = img.width;
  const ih = img.height;
  if (!iw || !ih || w <= 0 || h <= 0) return;

  if (fit === "stretch") {
    ctx.drawImage(img, x, y, w, h);
    return;
  }

  const scale =
    (fit === "cover"
      ? Math.max(w / iw, h / ih)
      : Math.min(w / iw, h / ih)) * zoom;
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = x + (w - dw) / 2 + panX * w;
  const dy = y + (h - dh) / 2 + panY * h;
  ctx.drawImage(img, dx, dy, dw, dh);
}

/** @deprecated alias — préférer drawFitted */
export function drawCover(ctx, img, x, y, w, h, zoom = 1, panX = 0, panY = 0) {
  drawFitted(ctx, img, x, y, w, h, { fit: "cover", zoom, panX, panY });
}

export function pathRoundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
