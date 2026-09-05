#!/usr/bin/env python3
"""Planche de contrôle : composite des PNG sur damier + magenta.

Usage:
    python tools/contact_sheet.py out.png sticker1.png sticker2.png ...

Le damier montre la découpe, la bande magenta révèle les franges de chroma
key résiduelles (un liseré vert saute aux yeux sur du magenta).
"""

import sys
from pathlib import Path

from PIL import Image

CELL = 200
COLS = 6
MAGENTA = (255, 0, 200)


def checkerboard(size, square=10):
    board = Image.new("RGB", size, (255, 255, 255))
    grey = Image.new("RGB", (square, square), (200, 200, 200))
    for y in range(0, size[1], square):
        for x in range(0, size[0], square):
            if (x // square + y // square) % 2:
                board.paste(grey, (x, y))
    return board


def build(out_path, paths):
    rows = (len(paths) + COLS - 1) // COLS
    # Chaque sticker est rendu deux fois : damier en haut, magenta en bas.
    width, height = COLS * CELL, rows * CELL * 2
    sheet = checkerboard((width, height))
    for i in range(rows):
        sheet.paste(
            Image.new("RGB", (width, CELL), MAGENTA), (0, i * CELL * 2 + CELL)
        )

    for i, p in enumerate(paths):
        img = Image.open(p).convert("RGBA")
        img.thumbnail((CELL - 16, CELL - 16), Image.LANCZOS)
        col, row = i % COLS, i // COLS
        x = col * CELL + (CELL - img.width) // 2
        for band in (0, 1):
            y = row * CELL * 2 + band * CELL + (CELL - img.height) // 2
            sheet.paste(img, (x, y), img)

    sheet.save(out_path)
    print(f"{out_path}  {sheet.size[0]}x{sheet.size[1]}  {len(paths)} stickers")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    build(sys.argv[1], [Path(p) for p in sys.argv[2:]])
