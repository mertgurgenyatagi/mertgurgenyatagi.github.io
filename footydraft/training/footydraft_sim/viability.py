"""Lobby configuration space + the Monte-Carlo-simulated viability table
(src/data/draftViability.ts, transcribed in full in GAME-RULES.md §7.3 — the
generator script and its input no longer exist in the repo, so this table is only
ever hand-transcribed, not regenerated).

`sample_random_config` is how every training env picks its table at reset(): uniform
over every (scope, constraint) combination the real lobby considers viable for that
format, then uniform over every seat count that combination supports. Nothing here
biases toward any particular config — the whole point is to cover the same
distribution of real games a human host could actually create.
"""

from dataclasses import dataclass

import numpy as np

MIN_SEATS = 2
MAX_SEATS = 5

LEAGUES = ["premier-league", "la-liga", "serie-a", "bundesliga", "ligue-1"]
CONSTRAINTS = ["club-1", "club-3", "nation-1", "nation-3"]  # Free Pick only
WHEELS = ["league", "club"]  # Spin the Wheel only

# (format_id, scope_key, constraint_id) -> max viable seat count.
# scope_key: 'all' | 'top-5' | 'league:<id>'. constraint_id: one of CONSTRAINTS,
# 'none' (Free Pick's no-constraint option), or 'na' (formats with no constraint at all).
# A key's absence means that configuration never works, at any size — viability is
# monotonic in seat count (verified at generation time per the source file's header),
# so "works at N" implies "works at every size from MIN_SEATS..N".
VIABILITY = {
    ("auction", "all", "na"): 5,
    ("auction", "league:bundesliga", "na"): 2,
    ("auction", "league:la-liga", "na"): 4,
    ("auction", "league:premier-league", "na"): 5,
    ("auction", "league:serie-a", "na"): 5,
    ("auction", "top-5", "na"): 5,
    ("deal-or-no-deal", "all", "na"): 5,
    ("deal-or-no-deal", "league:la-liga", "na"): 2,
    ("deal-or-no-deal", "league:premier-league", "na"): 3,
    ("deal-or-no-deal", "league:serie-a", "na"): 2,
    ("deal-or-no-deal", "top-5", "na"): 5,
    ("spin-the-wheel", "all", "na"): 5,
    ("spin-the-wheel", "league:bundesliga", "na"): 2,
    ("spin-the-wheel", "league:la-liga", "na"): 4,
    ("spin-the-wheel", "league:premier-league", "na"): 5,
    ("spin-the-wheel", "league:serie-a", "na"): 5,
    ("spin-the-wheel", "top-5", "na"): 5,
    ("free-pick", "all", "club-1"): 5,
    ("free-pick", "all", "club-3"): 5,
    ("free-pick", "all", "nation-1"): 3,
    ("free-pick", "all", "nation-3"): 5,
    ("free-pick", "all", "none"): 5,
    ("free-pick", "top-5", "club-1"): 3,
    ("free-pick", "top-5", "club-3"): 5,
    ("free-pick", "top-5", "nation-3"): 5,
    ("free-pick", "top-5", "none"): 5,
    ("free-pick", "league:bundesliga", "none"): 2,
    ("free-pick", "league:la-liga", "none"): 4,
    ("free-pick", "league:premier-league", "club-3"): 2,
    ("free-pick", "league:premier-league", "nation-3"): 2,
    ("free-pick", "league:premier-league", "none"): 5,
    ("free-pick", "league:serie-a", "none"): 5,
}

FORMATS = ["auction", "deal-or-no-deal", "free-pick", "spin-the-wheel"]


@dataclass(frozen=True)
class DraftConfig:
    format: str
    scope: str  # 'all' | 'top-5' | 'league'
    league: str | None  # only meaningful when scope == 'league'
    constraint: str | None  # Free Pick only; None == 'none'
    wheel: str | None  # Spin the Wheel only, 'league' | 'club'
    seat_count: int


def _scope_key(scope: str, league: str | None) -> str:
    return f"league:{league}" if scope == "league" else scope


def is_config_viable(format_id: str, scope: str, league: str | None, constraint_id: str, seat_count: int) -> bool:
    ceiling = VIABILITY.get((format_id, _scope_key(scope, league), constraint_id))
    return ceiling is not None and MIN_SEATS <= seat_count <= ceiling


def sample_random_config(rng: np.random.Generator, format_id: str) -> DraftConfig:
    """Uniform over every viable (scope, constraint) combo for this format, then
    uniform over every seat count that combo supports."""
    keys = [k for k in VIABILITY if k[0] == format_id]
    scope_key, constraint_id = keys[int(rng.integers(len(keys)))][1:]
    ceiling = VIABILITY[(format_id, scope_key, constraint_id)]
    seat_count = int(rng.integers(MIN_SEATS, ceiling + 1))

    if scope_key.startswith("league:"):
        scope, league = "league", scope_key.split(":", 1)[1]
    else:
        scope, league = scope_key, None

    constraint = None if constraint_id in ("na", "none") else constraint_id
    wheel = WHEELS[int(rng.integers(2))] if format_id == "spin-the-wheel" else None

    return DraftConfig(
        format=format_id,
        scope=scope,
        league=league,
        constraint=constraint,
        wheel=wheel,
        seat_count=seat_count,
    )
