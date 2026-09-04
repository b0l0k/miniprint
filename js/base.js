/** Racine du site (`/miniprint/` sur GitHub Pages, `/` en local). */
export const BASE_URL = new URL("../", import.meta.url);

/**
 * Résout un chemin du site pour le sous-dossier GitHub Pages.
 * @param {string} path `/assets/...` ou URL déjà complète
 */
export function asset(path) {
  if (!path) return path;
  if (/^(https?:|data:|blob:)/i.test(path)) return path;
  return new URL(path.replace(/^\//, ""), BASE_URL).href;
}

const ASSET_KEYS = new Set(["src", "thumb", "base"]);

/** Réécrit les chemins d’assets du catalogue Canon. */
export function rebasePaths(value) {
  if (Array.isArray(value)) return value.map(rebasePaths);
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = ASSET_KEYS.has(k) && typeof v === "string" ? asset(v) : rebasePaths(v);
    }
    return out;
  }
  return value;
}
