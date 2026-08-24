import numpy as np
import pytest

from footydraft_sim.clubs_data import TOP_WHEEL_CLUBS
from footydraft_sim.env_spin_wheel import SpinWheelEnv, _category_for
from footydraft_sim.players import load_pool
from footydraft_sim.viability import sample_random_config


@pytest.fixture(scope="module")
def pool():
    return load_pool()


def run_random_episode(pool, rng, config=None):
    env = SpinWheelEnv(pool)
    env.reset(rng, config=config)
    steps = 0
    max_steps = env.total_picks + 10
    while not env.done():
        mask = env.legal_action_mask()
        assert mask.any()
        legal = np.nonzero(mask)[0]
        action = int(legal[rng.integers(len(legal))])
        env.step(action)
        steps += 1
        assert steps <= max_steps
    return env


def test_category_fixed_by_scope_and_preference():
    assert _category_for("league", "club") == "club"
    assert _category_for("league", "league") == "club"  # scope=league forces club wheel
    assert _category_for("all", "club") == "club"
    assert _category_for("all", "league") == "league"
    assert _category_for("all", None) == "league"  # unset preference falls back to league


def test_many_random_episodes_terminate_and_squads_are_valid(pool):
    rng = np.random.default_rng(0)
    for _ in range(30):
        env = run_random_episode(pool, rng)
        assert env.done()
        for seat in range(env.seat_count):
            squad = env.squads[seat]
            if env.finalized[seat] and len(squad.slot_occupant) < 11:
                continue
            assert squad.is_full()


def test_no_player_drafted_twice(pool):
    rng = np.random.default_rng(1)
    env = run_random_episode(pool, rng)
    all_picks = [p for squad in env.squads for p in squad.slot_occupant.values()]
    assert len(all_picks) == len(set(all_picks))


def test_club_wheel_never_offers_outside_top15(pool):
    rng = np.random.default_rng(2)
    top15_idx = {pool.club_names.index(s) for s in TOP_WHEEL_CLUBS if s in pool.club_names}
    for _ in range(30):
        config = sample_random_config(rng, "spin-the-wheel")
        env = SpinWheelEnv(pool)
        env.reset(rng, config=config)
        if env.category != "club":
            continue
        while not env.done():
            mask = env.legal_action_mask()
            legal = np.nonzero(mask)[0]
            for player_idx in legal:
                assert pool.club_idx[player_idx] in top15_idx
            action = int(legal[rng.integers(len(legal))])
            env.step(action)


def test_other_league_entity_only_reachable_under_scope_all(pool):
    from footydraft_sim.env_spin_wheel import OTHER_LEAGUE_ENTITY

    rng = np.random.default_rng(3)
    for _ in range(30):
        config = sample_random_config(rng, "spin-the-wheel")
        env = SpinWheelEnv(pool)
        env.reset(rng, config=config)
        if env.category != "league":
            continue
        if config.scope != "all":
            assert not (env.entity_key[env.scoped] == OTHER_LEAGUE_ENTITY).any()


def test_reward_matches_squad_score_at_finalization(pool):
    rng = np.random.default_rng(4)
    env = SpinWheelEnv(pool)
    env.reset(rng)
    seen = {}
    while not env.done():
        mask = env.legal_action_mask()
        legal = np.nonzero(mask)[0]
        action = int(legal[rng.integers(len(legal))])
        rewards = env.step(action)
        for s, r in rewards.items():
            assert s not in seen
            seen[s] = r
    assert len(seen) == env.seat_count  # every seat finalized exactly once (normal or dead-end)
    for seat in range(env.seat_count):
        assert abs(seen[seat] - env.squads[seat].score(pool)) < 1e-6
