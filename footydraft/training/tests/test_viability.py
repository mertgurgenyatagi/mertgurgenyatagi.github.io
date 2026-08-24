import numpy as np
import pytest

from footydraft_sim.viability import FORMATS, MAX_SEATS, MIN_SEATS, is_config_viable, sample_random_config


def test_known_viable_and_non_viable_points():
    assert is_config_viable("auction", "all", None, "na", 5) is True
    assert is_config_viable("auction", "all", None, "na", 6) is False
    assert is_config_viable("auction", "league", "bundesliga", "na", 2) is True
    assert is_config_viable("auction", "league", "bundesliga", "na", 3) is False


def test_ligue_1_never_viable_for_any_format():
    for fmt in FORMATS:
        for size in range(MIN_SEATS, MAX_SEATS + 1):
            assert is_config_viable(fmt, "league", "ligue-1", "na", size) is False
            assert is_config_viable(fmt, "league", "ligue-1", "club-1", size) is False


def test_free_pick_bundesliga_only_none_up_to_two():
    assert is_config_viable("free-pick", "league", "bundesliga", "none", 2) is True
    assert is_config_viable("free-pick", "league", "bundesliga", "none", 3) is False
    assert is_config_viable("free-pick", "league", "bundesliga", "club-1", 2) is False


@pytest.mark.parametrize("fmt", FORMATS)
def test_sampled_configs_are_always_viable(fmt):
    rng = np.random.default_rng(123)
    for _ in range(500):
        cfg = sample_random_config(rng, fmt)
        assert cfg.format == fmt
        assert MIN_SEATS <= cfg.seat_count <= MAX_SEATS
        constraint_id = cfg.constraint if cfg.constraint is not None else ("none" if fmt == "free-pick" else "na")
        assert is_config_viable(fmt, cfg.scope, cfg.league, constraint_id, cfg.seat_count)


def test_sample_covers_more_than_one_scope_over_many_draws():
    rng = np.random.default_rng(7)
    scopes = {sample_random_config(rng, "free-pick").scope for _ in range(200)}
    assert len(scopes) > 1
