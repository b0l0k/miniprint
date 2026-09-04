/** Dimensions du pipeline ivy2 (Pillow → Canvas). */
export const PRINT_START_WIDTH = 1280;
export const PRINT_START_HEIGHT = 1920;
export const PRINT_FINAL_WIDTH = 640;
export const PRINT_FINAL_HEIGHT = 1616;

/**
 * @param {Blob | HTMLImageElement | ImageBitmap | HTMLCanvasElement} source
 * @param {{ autoCrop?: boolean, quality?: number, preview?: boolean }} [opts]
 * @returns {Promise<{ jpeg: Uint8Array, previewUrl: string }>}
 */
export async function prepareImage(source, opts = {}) {
  const { autoCrop = true, quality = 1, preview = false } = opts;

  let bitmap;
  if (source instanceof HTMLCanvasElement) {
    bitmap = await createImageBitmap(source);
  } else if (source instanceof ImageBitmap) {
    bitmap = source;
  } else {
    bitmap = await createImageBitmap(source);
  }

  const { width, height } = bitmap;
  const scale = autoCrop
    ? Math.max(PRINT_START_WIDTH / width, PRINT_START_HEIGHT / height)
    : Math.min(PRINT_START_WIDTH / width, PRINT_START_HEIGHT / height);

  const scaledW = Math.round(width * scale);
  const scaledH = Math.round(height * scale);
  const offsetX = Math.floor((PRINT_START_WIDTH - scaledW) / 2);
  const offsetY = Math.floor((PRINT_START_HEIGHT - scaledH) / 2);

  const stage = document.createElement("canvas");
  stage.width = PRINT_START_WIDTH;
  stage.height = PRINT_START_HEIGHT;
  const sctx = stage.getContext("2d");
  sctx.fillStyle = "#ffffff";
  sctx.fillRect(0, 0, stage.width, stage.height);
  sctx.drawImage(bitmap, offsetX, offsetY, scaledW, scaledH);
  bitmap.close?.();

  return finalizeStage(stage, { quality, preview });
}

/**
 * Canvas déjà au format 1280×1920 (éditeur) → JPEG imprimante.
 * @param {HTMLCanvasElement} stage
 */
export async function prepareStageCanvas(stage, opts = {}) {
  const { quality = 0.92, preview = false } = opts;
  return finalizeStage(stage, { quality, preview });
}

async function finalizeStage(stage, { quality, preview }) {
  let outCanvas = stage;
  if (!preview) {
    const final = document.createElement("canvas");
    final.width = PRINT_FINAL_WIDTH;
    final.height = PRINT_FINAL_HEIGHT;
    const fctx = final.getContext("2d");
    fctx.translate(PRINT_FINAL_WIDTH, PRINT_FINAL_HEIGHT);
    fctx.rotate(Math.PI);
    fctx.drawImage(
      stage,
      0,
      0,
      PRINT_START_WIDTH,
      PRINT_START_HEIGHT,
      0,
      0,
      PRINT_FINAL_WIDTH,
      PRINT_FINAL_HEIGHT,
    );
    outCanvas = final;
  }

  const blob = await canvasToJpeg(outCanvas, quality);
  const jpeg = new Uint8Array(await blob.arrayBuffer());

  const previewCanvas = document.createElement("canvas");
  previewCanvas.width = PRINT_START_WIDTH;
  previewCanvas.height = PRINT_START_HEIGHT;
  previewCanvas.getContext("2d").drawImage(stage, 0, 0);
  const previewBlob = await canvasToJpeg(previewCanvas, 0.85);
  const previewUrl = URL.createObjectURL(previewBlob);

  return { jpeg, previewUrl };
}

export async function makeTestPattern() {
  const canvas = document.createElement("canvas");
  canvas.width = PRINT_START_WIDTH;
  canvas.height = PRINT_START_HEIGHT;
  const ctx = canvas.getContext("2d");

  const g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  g.addColorStop(0, "#1a6b5c");
  g.addColorStop(0.45, "#f0a56f");
  g.addColorStop(1, "#2d3a5a");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(255,255,255,0.92)";
  const m = 80;
  ctx.fillRect(m, m, canvas.width - m * 2, canvas.height - m * 2 - 160);

  const ig = ctx.createLinearGradient(m, m, canvas.width - m, canvas.height - m);
  ig.addColorStop(0, "#ff6b6b");
  ig.addColorStop(0.33, "#ffd93d");
  ig.addColorStop(0.66, "#6bcb77");
  ig.addColorStop(1, "#4d96ff");
  ctx.fillStyle = ig;
  ctx.fillRect(m + 40, m + 40, canvas.width - m * 2 - 80, canvas.height - m * 2 - 280);

  ctx.fillStyle = "#1c2438";
  ctx.font = "700 96px Fraunces, Georgia, serif";
  ctx.textAlign = "center";
  ctx.fillText("MiniPrint", canvas.width / 2, canvas.height - m - 70);
  ctx.font = "500 42px Manrope, sans-serif";
  ctx.fillStyle = "#4a5568";
  ctx.fillText("test · zoemini 2", canvas.width / 2, canvas.height - m - 10);

  return prepareImage(canvas);
}

function canvasToJpeg(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("JPEG encode failed"))),
      "image/jpeg",
      quality,
    );
  });
}
