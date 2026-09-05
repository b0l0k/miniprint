#!/usr/bin/env python3
"""Reconstruit les catégories d'animaux du catalogue depuis les planches générées.

Usage:
    python tools/build_animal_stickers.py <dossier_des_planches>

Chaque planche est une grille 3x3 de stickers sur fond vert chroma (voir
tools/cut_stickers.py). Les planches sources ne sont pas versionnées : elles
pèsent 1,2 Mo pièce alors que seuls les stickers découpés servent à l'app.

Les animaux sont éclatés en plusieurs catégories d'une dizaine de stickers
pour rester cohérents avec les catégories existantes du catalogue Canon ; une
seule catégorie de 117 vignettes serait impraticable dans la grille.

Le script est idempotent : il purge les fichiers des catégories qu'il gère,
redécoupe, renumérote en continu par animal et réécrit le catalogue.
"""

import json
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from cut_stickers import cut  # noqa: E402

DEST = Path("assets/extra/stickers")
CATALOG = Path("assets/canon/catalog.json")
FIRST_ID = 910

# L'ordre définit l'ordre d'affichage, capybaras en tête. Les categoryId
# prolongent ceux du catalogue Canon, qui s'arrête à 13 ("Autre").
GROUPS = [
    ("Capybaras", 14, "capybara", ["capy-sheet-1.png", "capy-sheet-2.png", "capy-sheet-3.png"]),
    ("Chats", 15, "cat", ["cat-sheet-1.png", "cat-sheet-2.png"]),
    ("Chiens", 16, "dog", ["dog-sheet-1.png", "dog-sheet-2.png"]),
    ("Hamsters", 17, "hamster", ["hamster-sheet-1.png", "hamster-sheet-2.png"]),
    ("Lapins", 18, "bunny", ["bunny-sheet-1.png"]),
    ("Forêt", 19, "forest", ["forest-sheet-1.png"]),
    ("Ferme", 20, "farm", ["farm-sheet-1.png"]),
    ("Mer", 21, "sea", ["sea-sheet-1.png"]),
]
MANAGED = {name for name, _, _, _ in GROUPS} | {"Animaux"}  # "Animaux" = ancien nom


def purge_old(catalog):
    """Supprime les fichiers des catégories gérées, sans toucher aux autres."""
    n = 0
    for sticker in catalog["stickers"]:
        if sticker["category"] not in MANAGED:
            continue
        for key in ("src", "thumb"):
            path = Path(sticker[key].lstrip("/"))
            if path.exists():
                path.unlink()
                n += 1
    return n


def main(sheets_dir):
    sheets_dir = Path(sheets_dir)
    missing = [
        s for _, _, _, sheets in GROUPS for s in sheets if not (sheets_dir / s).exists()
    ]
    if missing:
        raise SystemExit(f"planches manquantes dans {sheets_dir}: {', '.join(missing)}")

    catalog = json.loads(CATALOG.read_text())
    print(f"anciens fichiers supprimés: {purge_old(catalog)}")

    (DEST / "thumb").mkdir(parents=True, exist_ok=True)
    scratch = DEST / "_scratch"
    entries = []

    for category, category_id, prefix, sheets in GROUPS:
        count = 0
        for sheet in sheets:
            shutil.rmtree(scratch, ignore_errors=True)
            for path, _, _ in cut(sheets_dir / sheet, scratch, "x"):
                count += 1
                name = f"{prefix}-{count:02d}.png"
                shutil.move(path, DEST / name)
                shutil.move(scratch / "thumb" / path.name, DEST / "thumb" / name)
                entries.append(
                    {
                        "id": FIRST_ID + len(entries),
                        "category": category,
                        "categoryId": category_id,
                        "src": f"/{DEST}/{name}",
                        "thumb": f"/{DEST}/thumb/{name}",
                    }
                )
        print(f"== {category}: {count} stickers ==")
    shutil.rmtree(scratch, ignore_errors=True)

    others = [s for s in catalog["stickers"] if s["category"] not in MANAGED]
    catalog["stickers"] = entries + others
    CATALOG.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n")
    print(f"catalogue: {len(entries)} animaux + {len(others)} autres")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    main(sys.argv[1])
