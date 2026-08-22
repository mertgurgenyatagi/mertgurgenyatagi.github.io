"""Generate face-anchored thumbnails for the home page's player wall.

PROJECT.md keeps `public/players/*.webp` deliberately uncropped and full-resolution
— the crop is "a decision for whatever UI is doing the displaying". This is that
decision, made once for the home page: read each player's hand-marked face box out
of `face_coordinates.json`, cut a 4:5 portrait around it so every face lands at the
same fraction of the frame, and write a small derivative to `public/faces/`.

The originals average ~250 KB each; these land around 10 KB, which is what makes a
wall of a dozen of them affordable on a page that has to paint immediately.

    python scripts/images/make_face_crops.py
"""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent.parent
SOURCE_DIR = ROOT / "public" / "players"
OUTPUT_DIR = ROOT / "public" / "faces"
FACE_DATA = ROOT / "data" / "face_coordinates.json"

# The roster the home page draws from. Spread across clubs and leagues on purpose —
# this is decoration, not the draft pool.
ROSTER = [
    "erling-haaland",
    "kylian-mbappe",
    "mohamed-salah",
    "jude-bellingham",
    "vinicius-junior",
    "harry-kane",
    "virgil-van-dijk",
    "bukayo-saka",
    "kevin-de-bruyne",
    "lautaro-martinez",
    "alexander-isak",
    "rodri",
]

OUT_W, OUT_H = 256, 320
ASPECT = OUT_W / OUT_H

# The whole point of the exercise: the marked face occupies this share of the crop's
# height for every player, so a row of them reads as one consistent set rather than
# a dozen photos that happen to contain a person.
FACE_SHARE = 0.42
# Faces sit a little above centre — leaves room for shoulders, which is what makes
# the crop read as a portrait instead of a mugshot.
FACE_ANCHOR_Y = 0.44


def crop_box(face: dict) -> tuple[int, int, int, int]:
    """A 4:5 box around the face, clamped to stay inside the source image."""
    img_w, img_h = face["imageWidth"], face["imageHeight"]

    crop_h = face["height"] / FACE_SHARE
    crop_w = crop_h * ASPECT

    # A tightly-marked face on a small source can ask for more pixels than exist.
    # Shrink to fit rather than letterboxing; the face just ends up slightly larger.
    scale = min(1.0, img_w / crop_w, img_h / crop_h)
    crop_w, crop_h = crop_w * scale, crop_h * scale

    centre_x = face["x"] + face["width"] / 2
    centre_y = face["y"] + face["height"] / 2

    left = centre_x - crop_w / 2
    top = centre_y - FACE_ANCHOR_Y * crop_h

    left = max(0, min(left, img_w - crop_w))
    top = max(0, min(top, img_h - crop_h))

    return round(left), round(top), round(left + crop_w), round(top + crop_h)


def main() -> None:
    faces = json.loads(FACE_DATA.read_text(encoding="utf-8"))
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    for slug in ROSTER:
        source = SOURCE_DIR / f"{slug}.webp"
        if not source.exists():
            print(f"  skip {slug}: no photo")
            continue
        if slug not in faces:
            print(f"  skip {slug}: no face box")
            continue

        with Image.open(source) as image:
            cropped = image.convert("RGB").crop(crop_box(faces[slug]))
            cropped = cropped.resize((OUT_W, OUT_H), Image.LANCZOS)
            destination = OUTPUT_DIR / f"{slug}.webp"
            cropped.save(destination, "WEBP", quality=82, method=6)

        print(f"  {slug}: {destination.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
