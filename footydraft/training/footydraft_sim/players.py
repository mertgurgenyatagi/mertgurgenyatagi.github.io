"""Ported from src/lib/players.ts's loadPool(). Loads data/player_data.csv into a
struct-of-arrays PlayerPool (numpy), matching the app's exact filter/dedup rules and
its column selection — including the two columns the app itself never reads
('League', 'Opening Bid (EURm)'): both are ignored here too, for fidelity. League is
re-derived from clubs_data.CLUB_LEAGUES (the club's real division), and opening bid is
re-derived at draft time from price via auctionEngine.ts's formula, not read from the
CSV's precomputed column.
"""

import csv
from dataclasses import dataclass
from pathlib import Path

import numpy as np

from .clubs_data import league_of_club
from .formation import POSITION_CODES
from .js_compat import js_round
from .slugify import slugify

DEFAULT_CSV_PATH = Path(__file__).resolve().parents[2] / "data" / "player_data.csv"

LEAGUE_IDS = ["premier-league", "la-liga", "serie-a", "bundesliga", "ligue-1"]
_LEAGUE_INDEX = {lid: i for i, lid in enumerate(LEAGUE_IDS)}
_POSITION_SET = set(POSITION_CODES)
_POSITION_INDEX = {p: i for i, p in enumerate(POSITION_CODES)}


@dataclass
class PlayerPool:
    name: list  # str[P] — debugging/inspection only, not read by any rule
    club_slug: list  # str[P]
    nation: list  # str[P]
    ability: np.ndarray  # float32[P]
    price: np.ndarray  # float32[P]
    opening_bid: np.ndarray  # float32[P] — derived, see module docstring
    position_idx: np.ndarray  # int8[P], index into formation.POSITION_CODES
    league_idx: np.ndarray  # int8[P], index into LEAGUE_IDS, -1 if out of top-5
    club_idx: np.ndarray  # int32[P], index into club_names — for vectorized constraint tallying
    nation_idx: np.ndarray  # int32[P], index into nation_names
    club_names: list  # str[C], index-aligned with club_idx
    nation_names: list  # str[Na], index-aligned with nation_idx

    @property
    def size(self) -> int:
        return len(self.name)

    @property
    def n_clubs(self) -> int:
        return len(self.club_names)

    @property
    def n_nations(self) -> int:
        return len(self.nation_names)

    def in_scope(self, scope: str, league: str | None) -> np.ndarray:
        """Vectorized port of players.ts's inScope()."""
        if scope == "league":
            return self.league_idx == _LEAGUE_INDEX[league]
        if scope == "top-5":
            return self.league_idx >= 0
        return np.ones(self.size, dtype=bool)  # 'all'

    def position_mask(self, position: str) -> np.ndarray:
        return self.position_idx == _POSITION_INDEX[position]


def _opening_bid(price: float) -> float:
    # auctionEngine.ts: Math.max(5, Math.round((price * 0.7) / 5) * 5)
    return max(5.0, js_round((price * 0.7) / 5.0) * 5.0)


def load_pool(csv_path: Path | None = None) -> PlayerPool:
    path = csv_path or DEFAULT_CSV_PATH
    with open(path, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.reader(f)
        header = next(reader)
        col = {name.strip(): i for i, name in enumerate(header)}

        name_at = col["Name"]
        nation_at = col["Nation"]
        club_at = col["Club"]
        position_at = col["Position"]
        ability_at = col["Current Ability"]
        price_at = col["Derived Price (EURm)"]

        seen = set()
        names, clubs, nations = [], [], []
        abilities, prices, positions, leagues = [], [], [], []

        for row in reader:
            if not row:
                continue
            name = row[name_at].strip() if name_at < len(row) else ""
            club = row[club_at].strip() if club_at < len(row) else ""
            position = row[position_at].strip() if position_at < len(row) else ""
            if not name or not club or position not in _POSITION_SET:
                continue

            club_slug = slugify(club)
            name_slug = slugify(name)
            dedup_key = f"{name_slug}|{club_slug}"
            if dedup_key in seen:
                continue
            seen.add(dedup_key)

            ability = float(row[ability_at]) if row[ability_at].strip() else 0.0
            price = float(row[price_at]) if row[price_at].strip() else 0.0
            league = league_of_club(club_slug)

            names.append(name)
            clubs.append(club_slug)
            nations.append(row[nation_at].strip() if nation_at < len(row) else "")
            abilities.append(ability)
            prices.append(price)
            positions.append(_POSITION_INDEX[position])
            leagues.append(_LEAGUE_INDEX[league] if league is not None else -1)

    ability_arr = np.asarray(abilities, dtype=np.float32)
    price_arr = np.asarray(prices, dtype=np.float32)
    opening_bid_arr = np.asarray([_opening_bid(p) for p in prices], dtype=np.float32)

    club_names = sorted(set(clubs))
    club_name_to_idx = {c: i for i, c in enumerate(club_names)}
    nation_names = sorted(set(nations))
    nation_name_to_idx = {n: i for i, n in enumerate(nation_names)}

    return PlayerPool(
        name=names,
        club_slug=clubs,
        nation=nations,
        ability=ability_arr,
        price=price_arr,
        opening_bid=opening_bid_arr,
        position_idx=np.asarray(positions, dtype=np.int8),
        league_idx=np.asarray(leagues, dtype=np.int8),
        club_idx=np.asarray([club_name_to_idx[c] for c in clubs], dtype=np.int32),
        nation_idx=np.asarray([nation_name_to_idx[n] for n in nations], dtype=np.int32),
        club_names=club_names,
        nation_names=nation_names,
    )
