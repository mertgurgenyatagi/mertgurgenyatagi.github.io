"""Crop every public/players/*.webp to a fixed 4:5 aspect ratio, targeting a
canonical vertical placement of the marked face box within the crop:

    face top      at 15%  down the crop
    face centre   at 27.5% down the crop
    face bottom   at 40%  down the crop
    (face height  = 25% of crop height)

That triple is the unique point inside the ranges Mert set (top 10-15%, centre
25-30%, bottom 35-40%) whose centre sits at the exact midpoint of its own
range (27.5%) -- picked as the canonical target rather than any of the other
valid combinations, which is why it lands at the edge of the top/bottom
ranges (15% / 40%) rather than their middle.

Not every source photo has enough margin above or below the face to hit that
target without the crop running past the image edge (75.23% do; see the
feasibility check this script's target was derived from). For the rest, the
crop keeps the same target crop height and slides vertically only as far as
the source image allows -- same clamp mechanism scripts/make_face_crops.py
already uses -- so the face lands as close to 15%/27.5%/40% as the photo
permits rather than being forced off the edge. Horizontally the crop is
centred on the face and clamped the same way.

No resize: the crop keeps whatever native resolution the source photo gives
it at this aspect ratio and framing -- per the standing "uncropped and
unresized at ingest" rule, this crop is a decision for this specific
downstream use (the dot-grid corpus), not a new universal derivative.

    python scripts/images/crop_players_4x5.py
"""

from __future__ import annotations

import csv
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent.parent
SOURCE_DIR = ROOT / "public" / "players"
OUTPUT_DIR = ROOT / "public" / "players-4x5"
FACE_DATA = ROOT / "data" / "face_coordinates.json"
REPORT_CSV = ROOT / "data" / "crop_4x5_report.csv"

OUT_ASPECT = 4 / 5  # width / height

# The canonical target: face height is 25% of the crop's height, positioned
# so the face's top edge sits at 15% down the crop (which puts the centre at
# 27.5% and the bottom at 40%, per the docstring above).
FACE_SHARE = 0.25
FACE_ANCHOR_TOP = 0.15


def crop_box(face: dict) -> tuple[tuple[int, int, int, int], bool]:
    """Returns (crop box, whether the ideal placement had to be clamped)."""
    img_w, img_h = face["imageWidth"], face["imageHeight"]
    face_top = face["y"]
    face_h = face["height"]
    face_centre_x = face["x"] + face["width"] / 2

    crop_h = face_h / FACE_SHARE
    crop_w = crop_h * OUT_ASPECT

    # Crop bigger than the source in either axis: shrink both dimensions
    # together so the 4:5 shape survives, at the cost of a larger face share.
    scale = min(1.0, img_w / crop_w, img_h / crop_h)
    crop_w, crop_h = crop_w * scale, crop_h * scale

    ideal_left = face_centre_x - crop_w / 2
    ideal_top = face_top - FACE_ANCHOR_TOP * crop_h

    left = max(0, min(ideal_left, img_w - crop_w))
    top = max(0, min(ideal_top, img_h - crop_h))

    clamped = abs(left - ideal_left) > 0.5 or abs(top - ideal_top) > 0.5 or scale < 1.0

    return (round(left), round(top), round(left + crop_w), round(top + crop_h)), clamped


def main() -> None:
    faces = json.loads(FACE_DATA.read_text(encoding="utf-8"))
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    report_rows = []
    written = 0
    clamped_count = 0
    skipped = []

    for slug, face in sorted(faces.items()):
        source = SOURCE_DIR / f"{slug}.webp"
        if not source.exists():
            skipped.append(slug)
            continue

        box, clamped = crop_box(face)

        with Image.open(source) as image:
            cropped = image.convert("RGB").crop(box)
            destination = OUTPUT_DIR / f"{slug}.webp"
            cropped.save(destination, "WEBP", quality=90, method=6)

        left, top, right, bottom = box
        crop_h = bottom - top
        face_top_frac = (face["y"] - top) / crop_h
        face_centre_frac = (face["y"] + face["height"] / 2 - top) / crop_h
        face_bottom_frac = (face["y"] + face["height"] - top) / crop_h

        report_rows.append(
            [
                slug,
                left,
                top,
                right,
                bottom,
                round(face_top_frac, 4),
                round(face_centre_frac, 4),
                round(face_bottom_frac, 4),
                clamped,
            ]
        )
        written += 1
        clamped_count += clamped

    with open(REPORT_CSV, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(
            [
                "slug",
                "left",
                "top",
                "right",
                "bottom",
                "face_top_frac",
                "face_centre_frac",
                "face_bottom_frac",
                "clamped",
            ]
        )
        w.writerows(report_rows)

    print(f"Wrote {written} crops to {OUTPUT_DIR}")
    print(f"On target (15% / 27.5% / 40%, unclamped): {written - clamped_count}")
    print(f"Clamped to fit the source image: {clamped_count}")
    if skipped:
        print(f"Skipped (no source photo): {len(skipped)} -> {skipped}")
    print(f"Report: {REPORT_CSV}")


if __name__ == "__main__":
    main()
