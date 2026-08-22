"""
Import club and league crests from an external Wikipedia-sourced logo dump
into public/clubs/{slug}.svg and public/leagues/{slug}.svg -- the paths
PROJECT.md's Art assets section already describes as the eventual crest
location, with the generated SVG stand-in as the fallback until a slug
lands here.

Source layout expected (see --source):
    leagues/{premier_league,la_liga,serie_a,bundesliga,ligue_1}.svg
    teams/{same 5 folder names}/{Wikipedia article title}.svg

Only clubs that are 1) in player_data.csv's five top-league rows and 2) have
a matching source file get a crest -- every other club (lower leagues, data
noise like River Plate showing up under "Premier Division") is left on the
placeholder on purpose. The CSV <-> source-file mapping was worked out by
hand once (CLUB_FILES below) since Wikipedia's article-title filenames
don't slugify cleanly from the CSV's club names.

Two-stage compression, since these are Wikipedia SVG exports and a handful
wrap a multi-megapixel embedded PNG/JPEG instead of real vector paths:
  1. any embedded raster wider or taller than --max-raster is downsampled
     (LANCZOS) and re-saved optimized -- lossless vector paths are untouched.
  2. svgo (--multipass --precision=1) cleans up editor cruft (Inkscape/
     Sodipodi namespaces, RDF metadata) and rounds path coordinates -- one
     decimal place is indistinguishable from the original at crest display
     sizes (checked by eye against a couple of the worst offenders).

Usage:
    python scripts/images/process_club_logos.py
    python scripts/images/process_club_logos.py --dry-run
"""

import argparse
import base64
import io
import re
import subprocess
import sys
import unicodedata
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent.parent
DEFAULT_SOURCE = Path(r"C:\Users\Mert\Desktop\repos\imagesearchbot\logos")
CLUBS_OUT = ROOT / "public" / "clubs"
LEAGUES_OUT = ROOT / "public" / "leagues"

MAX_RASTER = 400

# CSV League column -> (source leagues/ file, source teams/ folder, league slug).
# Slugs are the competition's stable identity, not the CSV's sponsor-suffixed
# string (e.g. "Ligue 1 Uber Eats"), since sponsors change and the crest doesn't.
LEAGUES = {
    "Premier Division": ("premier_league.svg", "premier_league", "premier-league"),
    "Serie A": ("serie_a.svg", "serie_a", "serie-a"),
    "First Division": ("la_liga.svg", "la_liga", "la-liga"),
    "Bundesliga": ("bundesliga.svg", "bundesliga", "bundesliga"),
    "Ligue 1 Uber Eats": ("ligue_1.svg", "ligue_1", "ligue-1"),
}

# CSV Club name -> source filename within its league's teams/ folder.
# Clubs with no entry here (e.g. River Plate under "Premier Division", a data
# quality artifact, or lower-league clubs mislabeled into a top-5 league row)
# are deliberately skipped -- see module docstring.
CLUB_FILES = {
    # Premier Division (England)
    "Arsenal": "Arsenal_F.C..svg",
    "Aston Villa": "Aston_Villa_F.C..svg",
    "Bournemouth": "AFC_Bournemouth.svg",
    "Brentford": "Brentford_F.C..svg",
    "Brighton": "Brighton_&_Hove_Albion_F.C..svg",
    "Chelsea": "Chelsea_F.C..svg",
    "Crystal Palace": "Crystal_Palace_F.C..svg",
    "Everton": "Everton_F.C..svg",
    "Fulham": "Fulham_F.C..svg",
    "Hull City": "Hull_City_A.F.C..svg",
    "Ipswich Town": "Ipswich_Town_F.C..svg",
    "Leeds United": "Leeds_United_F.C..svg",
    "Liverpool": "Liverpool_F.C..svg",
    "Manchester City": "Manchester_City_F.C..svg",
    "Manchester United": "Manchester_United_F.C..svg",
    "Newcastle United": "Newcastle_United_F.C..svg",
    "Nottingham Forest": "Nottingham_Forest_F.C..svg",
    "Sunderland": "Sunderland_A.F.C..svg",
    "Tottenham": "Tottenham_Hotspur.svg",
    # Serie A (Italy)
    "AC Milan": "AC_Milan.svg",
    "AS Roma": "AS_Roma.svg",
    "Atalanta": "Atalanta_BC.svg",
    "Bologna": "Bologna_FC_1909.svg",
    "Como": "Como_1907.svg",
    "Fiorentina": "ACF_Fiorentina.svg",
    "Genoa": "Genoa_CFC.svg",
    "Inter": "Inter_Milan.svg",
    "Juventus": "Juventus_FC.svg",
    "Lazio": "SS_Lazio.svg",
    "Monza": "AC_Monza.svg",
    "Napoli": "SSC_Napoli.svg",
    "Sassuolo": "US_Sassuolo_Calcio.svg",
    "Torino": "Torino_FC.svg",
    "Udinese": "Udinese_Calcio.svg",
    "Venezia": "Venezia_FC.svg",
    # First Division (Spain)
    "Alavés": "Deportivo_Alavés.svg",
    "Athletic Bilbao": "Athletic_Bilbao.svg",
    "Atletico Madrid": "Atlético_Madrid.svg",
    "Barcelona": "FC_Barcelona.svg",
    "Celta Vigo": "RC_Celta_de_Vigo.svg",
    "Getafe": "Getafe_CF.svg",
    "Osasuna": "CA_Osasuna.svg",
    "Racing Santander": "Racing_de_Santander.svg",
    "Rayo Vallecano": "Rayo_Vallecano.svg",
    "Real Betis": "Real_Betis.svg",
    "Real Madrid": "Real_Madrid_CF.svg",
    "Real Sociedad": "Real_Sociedad.svg",
    "Sevilla": "Sevilla_FC.svg",
    "Valencia": "Valencia_CF.svg",
    "Villarreal": "Villarreal_CF.svg",
    # Bundesliga (Germany)
    "Bayer Leverkusen": "Bayer_04_Leverkusen.svg",
    "Bayern Munich": "FC_Bayern_Munich.svg",
    "Borussia Dortmund": "Borussia_Dortmund.svg",
    "Eintracht Frankfurt": "Eintracht_Frankfurt.svg",
    "RB Leipzig": "RB_Leipzig.svg",
    "SC Freiburg": "SC_Freiburg.svg",
    "Schalke 04": "FC_Schalke_04.svg",
    "TSG Hoffenheim": "TSG_1899_Hoffenheim.svg",
    "VfB Stuttgart": "VfB_Stuttgart.svg",
    # Ligue 1 (France)
    "AS Monaco": "AS_Monaco_FC.svg",
    "Lille": "Lille_OSC.svg",
    "Lyon": "Olympique_Lyonnais.svg",
    "Marseille": "Olympique_de_Marseille.svg",
    "OGC Nice": "OGC_Nice.svg",
    "PSG": "Paris_Saint-Germain_FC.svg",
    "Paris FC": "Paris_FC.svg",
    "RC Lens": "RC_Lens.svg",
    "Rennes": "Stade_Rennais_FC.svg",
    "Strasbourg": "RC_Strasbourg_Alsace.svg",
}

# name -> (source league folder), so CLUB_FILES doesn't repeat it 69 times.
CLUB_LEAGUE_FOLDER = {
    **{c: "premier_league" for c in [
        "Arsenal", "Aston Villa", "Bournemouth", "Brentford", "Brighton",
        "Chelsea", "Crystal Palace", "Everton", "Fulham", "Hull City",
        "Ipswich Town", "Leeds United", "Liverpool", "Manchester City",
        "Manchester United", "Newcastle United", "Nottingham Forest",
        "Sunderland", "Tottenham",
    ]},
    **{c: "serie_a" for c in [
        "AC Milan", "AS Roma", "Atalanta", "Bologna", "Como", "Fiorentina",
        "Genoa", "Inter", "Juventus", "Lazio", "Monza", "Napoli",
        "Sassuolo", "Torino", "Udinese", "Venezia",
    ]},
    **{c: "la_liga" for c in [
        "Alavés", "Athletic Bilbao", "Atletico Madrid", "Barcelona",
        "Celta Vigo", "Getafe", "Osasuna", "Racing Santander",
        "Rayo Vallecano", "Real Betis", "Real Madrid", "Real Sociedad",
        "Sevilla", "Valencia", "Villarreal",
    ]},
    **{c: "bundesliga" for c in [
        "Bayer Leverkusen", "Bayern Munich", "Borussia Dortmund",
        "Eintracht Frankfurt", "RB Leipzig", "SC Freiburg", "Schalke 04",
        "TSG Hoffenheim", "VfB Stuttgart",
    ]},
    **{c: "ligue_1" for c in [
        "AS Monaco", "Lille", "Lyon", "Marseille", "OGC Nice", "PSG",
        "Paris FC", "RC Lens", "Rennes", "Strasbourg",
    ]},
}

# Same slugify as scripts/process_player_images.py, kept in sync by hand --
# club slugs need to match however a future component derives them from
# player_data.csv's Club column.
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


RASTER_RE = re.compile(rb'(data:image/(png|jpeg);base64,)([A-Za-z0-9+/=\s]+?)(")')


def shrink_embedded_rasters(svg_bytes, max_dim):
    """Downsample any embedded PNG/JPEG wider or taller than max_dim in place."""

    def repl(m):
        prefix, fmt, b64, quote = m.groups()
        raw = base64.b64decode(b64)
        img = Image.open(io.BytesIO(raw))
        w, h = img.size
        if max(w, h) <= max_dim:
            return m.group(0)
        scale = max_dim / max(w, h)
        img = img.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
        buf = io.BytesIO()
        if fmt == b"png":
            img.save(buf, "PNG", optimize=True)
        else:
            img = img.convert("RGB")
            img.save(buf, "JPEG", quality=85, optimize=True, progressive=True)
        return prefix + base64.b64encode(buf.getvalue()) + quote

    return RASTER_RE.sub(repl, svg_bytes)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--max-raster", type=int, default=MAX_RASTER)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if not args.source.exists():
        sys.exit(f"Source directory not found: {args.source}")

    written = []

    for league_file, folder, slug in LEAGUES.values():
        src = args.source / "leagues" / league_file
        if not src.exists():
            print(f"MISSING league source: {src}")
            continue
        dest = LEAGUES_OUT / f"{slug}.svg"
        written.append((src, dest))

    for club, filename in CLUB_FILES.items():
        folder = CLUB_LEAGUE_FOLDER[club]
        src = args.source / "teams" / folder / filename
        if not src.exists():
            print(f"MISSING club source: {src}")
            continue
        dest = CLUBS_OUT / f"{slugify(club)}.svg"
        written.append((src, dest))

    if args.dry_run:
        for src, dest in written:
            print(f"{src.relative_to(args.source)} -> {dest.relative_to(ROOT)}")
        print(f"\n{len(written)} files would be written.")
        return

    CLUBS_OUT.mkdir(parents=True, exist_ok=True)
    LEAGUES_OUT.mkdir(parents=True, exist_ok=True)

    total_before, total_after = 0, 0
    for src, dest in written:
        raw = src.read_bytes()
        shrunk = shrink_embedded_rasters(raw, args.max_raster)
        dest.write_bytes(shrunk)
        total_before += len(raw)
        total_after += len(shrunk)

    print(f"Wrote {len(written)} files ({total_before/1024:.0f} KiB -> {total_after/1024:.0f} KiB before svgo).")

    # svgo's -f only honours the last occurrence when passed twice, so each
    # directory needs its own invocation rather than one combined command.
    for out_dir in (CLUBS_OUT, LEAGUES_OUT):
        result = subprocess.run(
            ["npx", "svgo", "-f", str(out_dir), "--multipass", "--precision=1"],
            cwd=ROOT, shell=True,
        )
        if result.returncode != 0:
            sys.exit("svgo failed")

    final_bytes = sum(p.stat().st_size for p in list(CLUBS_OUT.glob("*.svg")) + list(LEAGUES_OUT.glob("*.svg")))
    print(f"Final total: {final_bytes/1024:.0f} KiB across {len(written)} files.")


if __name__ == "__main__":
    main()
