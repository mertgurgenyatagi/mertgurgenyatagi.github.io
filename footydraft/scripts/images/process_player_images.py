"""
Turn the raw fetched photos in assets/ into the site's real player art at
public/players/{slug}.webp -- the path every PlayerImage already points at
and silently falls back from (src/lib/placeholderImage.ts), so dropping
files there needs no other code change.

For each CSV player:
  1. find its source image in assets/ (root only -- assets/wikipedia/ is
     a separate, no-longer-used set and is never read here)
  2. save as webp under a slug derived from the player's full name, at
     full original resolution and framing

Deliberately no cropping and no resizing here -- an earlier version of
this script force-cropped every photo to the one aspect ratio the home
page's marquee card happens to use today, which is a decision this script
has no business making once and for all for every future consumer of
these photos. Whatever crop a given UI needs belongs at the point that UI
renders the image, not baked in permanently at ingest time.

A source is matched to its CSV row by exact name first, then by an
accent-folded fallback -- a handful of files lost their diacritics when
Windows' save dialog wrote them (e.g. "Hector Bellerin.webp" for the CSV's
"Héctor Bellerín"), and an exact match alone would report those as missing.
If a player has more than one file (a leftover duplicate save), the one
with more pixels wins.

Usage:
    python scripts/images/process_player_images.py                  # process all
    python scripts/images/process_player_images.py --limit 5         # test run
    python scripts/images/process_player_images.py --dry-run          # report only
"""

import argparse
import csv
import sys
import unicodedata
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent.parent
CSV_PATH = ROOT / "data" / "player_data.csv"
ASSETS_DIR = ROOT / "assets"
OUT_DIR = ROOT / "public" / "players"

WEBP_QUALITY = 82

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".avif", ".jfif"}

# Letters NFD will not take apart, because the mark is baked into the glyph
# rather than being a combining character -- plain accent-stripping leaves
# these as literal non-ASCII bytes in the slug (e.g. "rasmus-højlund").
UNDECOMPOSABLE = str.maketrans({
    "ø": "o", "Ø": "o", "đ": "d", "Đ": "d", "ð": "d", "Ð": "d", "ł": "l", "Ł": "l",
    "þ": "th", "Þ": "th", "ß": "ss", "æ": "ae", "Æ": "ae", "œ": "oe", "Œ": "oe",
    "ı": "i", "İ": "i",
})


def slugify(name):
    name = name.translate(UNDECOMPOSABLE)
    decomposed = unicodedata.normalize("NFD", name)
    stripped = "".join(c for c in decomposed if not unicodedata.combining(c))
    lowered = stripped.lower()
    parts = []
    current = []
    for ch in lowered:
        if ch.isalnum():
            current.append(ch)
        elif current:
            parts.append("".join(current))
            current = []
    if current:
        parts.append("".join(current))
    return "-".join(parts)


def fold_key(name):
    decomposed = unicodedata.normalize("NFD", name.casefold())
    return "".join(c for c in decomposed if not unicodedata.combining(c))


def load_players(csv_path):
    with csv_path.open(encoding="utf-8-sig", newline="") as handle:
        return [(row["Name"].strip(), row.get("Club", "").strip())
                for row in csv.DictReader(handle)
                if row.get("Name", "").strip()]


def assign_slugs(players):
    """name -> unique slug, disambiguating same-name players by club.

    The CSV has two separate players both named "Ederson" (a Fenerbahçe
    keeper and an Atalanta midfielder) -- slugify(name) alone collides them
    onto the same output file, silently dropping one. Any name shared by
    more than one row gets its club folded into the slug instead; if even
    that repeats (same name *and* same club -- not expected in this data)
    an index is appended so no player is ever silently overwritten.
    """
    base_counts = {}
    for name, _ in players:
        base = slugify(name)
        base_counts[base] = base_counts.get(base, 0) + 1

    slugs = {}
    seen = set()
    for name, club in players:
        base = slugify(name)
        slug = base if base_counts[base] == 1 else f"{base}-{slugify(club)}"
        if slug in seen:
            n = 2
            while f"{slug}-{n}" in seen:
                n += 1
            slug = f"{slug}-{n}"
        seen.add(slug)
        slugs[(name, club)] = slug
    return slugs


def index_assets(assets_dir):
    """name-key -> list of candidate files, keyed both exactly and folded."""
    exact, folded = {}, {}
    for p in assets_dir.glob("*"):
        if not p.is_file() or p.name.startswith("_"):
            continue
        if p.suffix.lower() not in IMAGE_EXTS:
            continue
        exact.setdefault(unicodedata.normalize("NFC", p.stem).casefold(), []).append(p)
        folded.setdefault(fold_key(p.stem), []).append(p)
    return exact, folded


def pick_best(candidates):
    """When a player has more than one source file, keep the highest-resolution one."""
    if len(candidates) == 1:
        return candidates[0]
    best, best_pixels = None, -1
    for p in candidates:
        try:
            with Image.open(p) as img:
                pixels = img.size[0] * img.size[1]
        except Exception:
            continue
        if pixels > best_pixels:
            best, best_pixels = p, pixels
    return best or candidates[0]


def find_source(name, exact, folded):
    key = unicodedata.normalize("NFC", name).casefold()
    candidates = exact.get(key)
    if not candidates:
        candidates = folded.get(fold_key(name))
    if not candidates:
        return None
    return pick_best(candidates)


def process_image(src_path, dest_path):
    with Image.open(src_path) as img:
        if img.mode != "RGB":
            img = img.convert("RGB")
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        img.save(dest_path, "WEBP", quality=WEBP_QUALITY, method=6)


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, OSError):
        pass

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--csv", type=Path, default=CSV_PATH)
    parser.add_argument("--assets", type=Path, default=ASSETS_DIR)
    parser.add_argument("--out", type=Path, default=OUT_DIR)
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--dry-run", action="store_true",
                        help="report matches/misses, write nothing")
    args = parser.parse_args()

    players = load_players(args.csv)
    exact, folded = index_assets(args.assets)
    slugs = assign_slugs(players)

    if args.limit is not None:
        players = players[:args.limit]

    # Resolve every row's source first, so a same-name collision (two
    # different players sharing a name, e.g. the CSV's two "Ederson"s) can
    # be caught before any writing happens -- if both rows resolve to the
    # *same* file, there is only one real photo for two different people,
    # and guessing which one it actually depicts would risk showing a
    # goalkeeper's face on a midfielder's card. Safer to skip both and say so.
    resolved = [(name, club, find_source(name, exact, folded)) for name, club in players]
    src_use_count = {}
    for name, club, src in resolved:
        if src is not None:
            src_use_count[src] = src_use_count.get(src, 0) + 1

    processed, missing, ambiguous, failed = 0, [], [], []
    for i, (name, club, src) in enumerate(resolved, start=1):
        if src is None:
            missing.append(name)
            continue
        if src_use_count[src] > 1:
            ambiguous.append((name, club, src.name))
            continue

        slug = slugs[(name, club)]
        dest = args.out / f"{slug}.webp"

        if args.dry_run:
            print(f"[{i}/{len(players)}] {name} -> {src.name} -> {dest.relative_to(ROOT)}")
            processed += 1
            continue

        try:
            process_image(src, dest)
            processed += 1
        except Exception as exc:
            failed.append((name, str(exc)))
            print(f"[{i}/{len(players)}] FAILED {name}: {exc}")

    print(f"\nProcessed {processed}/{len(players)}.")
    if missing:
        print(f"{len(missing)} with no source image:")
        for name in missing:
            print(f"  {name}")
    if ambiguous:
        print(f"{len(ambiguous)} skipped -- same name as another player, "
              f"same source file, could not tell them apart:")
        for name, club, src_name in ambiguous:
            print(f"  {name} ({club}) -> {src_name}")
    if failed:
        print(f"{len(failed)} failed to process:")
        for name, err in failed:
            print(f"  {name}: {err}")


if __name__ == "__main__":
    main()
