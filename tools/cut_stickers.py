#!/usr/bin/env python3
"""Découpe une planche de stickers générée sur fond vert en PNG transparents.

Usage:
    python tools/cut_stickers.py planche.png assets/extra/stickers prefix

L'alpha vient de la distance colorimétrique au fond mesuré, pas de l'excès de
vert : sinon les éléments verts des dessins (feuille, livre, couverture) sont
partiellement détourés. Le fond chroma étant très saturé, il reste à distance
< 20 alors que le vert le plus proche dessiné est à ~135, d'où une rampe
étroite qui ne touche que les pixels réellement anti-aliasés. La couleur de
ces pixels est ensuite reconstruite par unpremultiply, sans quoi les contours
blancs de découpe gardent un liseré vert.
"""

import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

# Un sticker plus petit que ça est un artefact de génération, pas un dessin.
MIN_AREA_RATIO = 0.002
PAD = 6
MAX_SIZE = 512
# Aligné sur les vignettes du catalogue Canon (assets/canon/stickers/thumb).
THUMB_SIZE = 128
# La palette divise le poids des vignettes par cinq. Elle n'est pas appliquée
# aux pleines tailles : elle quantifie aussi l'alpha, ce qui crénèle les bords
# de découpe une fois le sticker agrandi sur la composition.
THUMB_COLORS = 128

# Bornes de la rampe d'alpha, en distance RGB au fond mesuré.
DIST_BG = 45
DIST_FG = 120


def alpha_from_chroma(rgb, bg):
    """Alpha dans [0,1] : 0 sur le fond pur, 1 sur le sujet opaque."""
    dist = np.linalg.norm(rgb - bg, axis=-1)
    return np.clip((dist - DIST_BG) / (DIST_FG - DIST_BG), 0.0, 1.0)


def unpremultiply(rgb, alpha, bg):
    """Retire la contamination du fond sur les pixels semi-transparents."""
    safe = np.maximum(alpha, 1e-3)[..., None]
    out = (rgb - (1.0 - alpha)[..., None] * bg) / safe
    return np.clip(out, 0, 255)


def cut(sheet_path, out_dir, prefix):
    img = Image.open(sheet_path).convert("RGB")
    rgb = np.asarray(img).astype(np.float32)
    h, w = rgb.shape[:2]

    # Le fond est mesuré sur les coins plutôt que codé en dur : le générateur
    # ne rend jamais exactement le vert demandé.
    corners = np.concatenate(
        [rgb[:12, :12].reshape(-1, 3), rgb[:12, -12:].reshape(-1, 3),
         rgb[-12:, :12].reshape(-1, 3), rgb[-12:, -12:].reshape(-1, 3)]
    )
    bg = np.median(corners, axis=0)
    if bg[1] - max(bg[0], bg[2]) < 40:
        raise SystemExit(f"{sheet_path}: coins non verts (fond mesuré {bg}), planche inutilisable")

    alpha = alpha_from_chroma(rgb, bg)
    color = unpremultiply(rgb, alpha, bg)

    # Les seuls pixels semi-transparents attendus sont les bords anti-aliasés.
    # Une proportion élevée signalerait un aplat du dessin pris pour du fond.
    partial = float(((alpha > 0.05) & (alpha < 0.95)).mean())
    if partial > 0.02:
        print(f"  ATTENTION {sheet_path.name}: {partial:.1%} de pixels semi-transparents")

    solid = ndimage.binary_fill_holes(alpha > 0.5)
    labels, n = ndimage.label(solid)
    min_area = MIN_AREA_RATIO * h * w

    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    thumb_dir = out_dir / "thumb"
    thumb_dir.mkdir(exist_ok=True)
    written = []

    for label in range(1, n + 1):
        ys, xs = np.where(labels == label)
        if ys.size < min_area:
            continue

        y0, y1 = max(0, ys.min() - PAD), min(h, ys.max() + 1 + PAD)
        x0, x1 = max(0, xs.min() - PAD), min(w, xs.max() + 1 + PAD)

        # Masquer les voisins : deux stickers proches peuvent partager une bbox.
        own = (labels[y0:y1, x0:x1] == label) | (labels[y0:y1, x0:x1] == 0)
        a = alpha[y0:y1, x0:x1] * own
        rgba = np.dstack([color[y0:y1, x0:x1], a * 255.0]).astype(np.uint8)

        sticker = Image.fromarray(rgba, "RGBA")
        sticker = sticker.crop(sticker.getbbox())
        if max(sticker.size) > MAX_SIZE:
            scale = MAX_SIZE / max(sticker.size)
            sticker = sticker.resize(
                (round(sticker.width * scale), round(sticker.height * scale)),
                Image.LANCZOS,
            )

        name = f"{prefix}-{len(written) + 1:02d}.png"
        path = out_dir / name
        sticker.save(path, optimize=True)

        thumb = sticker.copy()
        thumb.thumbnail((THUMB_SIZE, THUMB_SIZE), Image.LANCZOS)
        # FASTOCTREE, seule méthode de quantize qui préserve le canal alpha.
        thumb = thumb.quantize(colors=THUMB_COLORS, method=Image.FASTOCTREE)
        thumb.save(thumb_dir / name, optimize=True)

        written.append((path, sticker.size, ys.size))

    for path, size, area in written:
        print(f"{path}  {size[0]}x{size[1]}  aire={area}")
    print(f"-> {len(written)} stickers depuis {sheet_path} ({n} composantes brutes)")
    return written


if __name__ == "__main__":
    if len(sys.argv) != 4:
        raise SystemExit(__doc__)
    cut(sys.argv[1], sys.argv[2], sys.argv[3])
