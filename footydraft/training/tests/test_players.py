import csv

import numpy as np
import pytest

from footydraft_sim.players import DEFAULT_CSV_PATH, LEAGUE_IDS, load_pool


@pytest.fixture(scope="module")
def pool():
    return load_pool()


def test_loads_and_arrays_agree_in_length(pool):
    assert pool.size > 0
    for arr in (pool.ability, pool.price, pool.opening_bid, pool.position_idx, pool.league_idx, pool.club_idx, pool.nation_idx):
        assert len(arr) == pool.size


def test_no_duplicate_name_club_pairs(pool):
    pairs = list(zip(pool.name, pool.club_slug))
    assert len(pairs) == len(set(pairs))


def test_position_and_league_indices_in_range(pool):
    assert pool.position_idx.min() >= 0
    assert pool.position_idx.max() <= 9
    assert pool.league_idx.min() >= -1
    assert pool.league_idx.max() < len(LEAGUE_IDS)
    assert pool.club_idx.max() < pool.n_clubs
    assert pool.nation_idx.max() < pool.n_nations


def test_ability_and_price_are_positive(pool):
    assert (pool.ability > 0).all()
    assert (pool.price > 0).all()


def test_dropped_rows_do_not_appear(pool):
    # Every row in the source CSV missing a name/club, or with a position outside the
    # 10 known codes, must be absent from the loaded pool. Spot check via raw count:
    # loaded size must be <= raw non-header row count (dedup/filtering only removes).
    with open(DEFAULT_CSV_PATH, encoding="utf-8-sig", newline="") as f:
        raw_rows = sum(1 for _ in csv.reader(f)) - 1
    assert pool.size <= raw_rows


def test_opening_bid_matches_csvs_own_precomputed_column():
    # The CSV carries an 'Opening Bid (EURm)' column the app itself never reads
    # (players.ts's loadPool only looks up 7 named columns). This cross-checks our
    # independently-derived formula (0.7x price, JS-rounded to nearest 5, floor 5)
    # against that column for every row, as a fidelity sanity check -- not because the
    # app depends on it, but because agreement here is strong evidence the formula and
    # its rounding convention were ported correctly.
    with open(DEFAULT_CSV_PATH, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        mismatches = []
        checked = 0
        for row in reader:
            if row["Position"] not in {"GK", "CB", "LB", "RB", "CDM", "CM", "AMF", "LW", "RW", "ST"}:
                continue
            price = float(row["Derived Price (EURm)"])
            expected = float(row["Opening Bid (EURm)"])
            from footydraft_sim.players import _opening_bid

            got = _opening_bid(price)
            checked += 1
            if abs(got - expected) > 1e-6:
                mismatches.append((row["Name"], price, expected, got))
    assert checked > 500
    assert mismatches == []


def test_in_scope_top5_excludes_null_league(pool):
    mask = pool.in_scope("top-5", None)
    assert (pool.league_idx[mask] >= 0).all()
    assert mask.sum() < pool.size or (pool.league_idx >= 0).all()


def test_in_scope_league_filters_to_one_league(pool):
    mask = pool.in_scope("league", "premier-league")
    idx = LEAGUE_IDS.index("premier-league")
    assert (pool.league_idx[mask] == idx).all()
    assert mask.sum() > 0


def test_in_scope_all_includes_everything(pool):
    assert pool.in_scope("all", None).all()
