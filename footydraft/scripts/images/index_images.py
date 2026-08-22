import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
ASSETS_DIR = ROOT / "assets"
OUT_PATH = ROOT / "scripts" / "player_images.json"

image_map = {}
for f in ASSETS_DIR.iterdir():
    if f.is_file() and f.suffix.lower() in [".webp", ".jpg", ".jpeg", ".png", ".avif", ".jfif"]:
        name = f.stem
        image_map[name] = f.name

with open(OUT_PATH, "w", encoding="utf-8") as f:
    json.dump(image_map, f, indent=2, ensure_ascii=False)

print(f"Mapped {len(image_map)} player images to {OUT_PATH}")
