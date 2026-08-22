"""Generate the tiny per-player colour grids the CSS-mask dot-grid technique
reads as its background image -- see PROJECT.md's Art assets section.

Each output is a flat, box-filter-averaged colour per grid cell, matching the
4:5 aspect of players-4x5/ exactly (cols:rows == 4:5, so no distortion).
Frame-specific cropping and the circular mask that turns each cell into a dot
both happen later, in Dotgrid.tsx / index.css's `.dotgrid` -- this script
only produces the colour layer.

One resolution no longer serves every frame: tuning against the real screens
(`/dotgrid-tuner`) settled on a different source density per frame -- a hero
surface like the Auction block wants more columns than a 16-66px avatar,
which pushes cells below the ~3px floor where the CSS circle mask loses
precision at anything close to the old flat 80. So this generates one file
per player *per density any `FRAME_CROPS` entry in Dotgrid.tsx actually
uses*, named `{slug}--{cols}.webp`, rather than one flat set.

    python scripts/images/make_dotgrid_cells.py
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent.parent
SOURCE_DIR = ROOT / "public" / "players-4x5"
OUTPUT_DIR = ROOT / "public" / "players-cells"

# The distinct `density` values across Dotgrid.tsx's FRAME_CROPS. Keep in
# sync by hand -- there are only ever a handful of frames, so a shared
# constants module felt like more ceremony than the two files warranted.
DENSITIES = [16, 48, 64, 96]


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    sources = sorted(SOURCE_DIR.glob("*.webp"))

    written = 0
    for source in sources:
        with Image.open(source) as image:
            rgb = image.convert("RGB")
            for cols in DENSITIES:
                rows = round(cols * 1.25)
                grid = rgb.resize((cols, rows), Image.BOX)
                grid.save(OUTPUT_DIR / f"{source.stem}--{cols}.webp", "WEBP", lossless=True, method=6)
                written += 1

    print(f"Wrote {written} cell grids ({len(sources)} players x {len(DENSITIES)} densities) to {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
