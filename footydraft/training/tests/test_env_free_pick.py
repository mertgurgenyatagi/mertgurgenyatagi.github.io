import numpy as np
import pytest

from footydraft_sim.constraints import cap_for
from footydraft_sim.env_free_pick import FreePickEnv
from footydraft_sim.players import load_pool
from footydraft_sim.viability import sample_random_config


@pytest.fixture(scope="module")
def pool():
    return load_pool()


def run_random_episode(pool, rng, config=None):
    env = FreePickEnv(pool)
    env.reset(rng, config=config)
    steps = 0
    max_steps = env.total_picks + 10
    while not env.done():
        seat = env.acting_seat()
        mask = env.legal_action_mask()
        assert mask.any()
        legal = np.nonzero(mask)[0]
        action = legal[rng.integers(len(legal))]
        env.step(int(action))
        steps += 1
        assert steps <= max_steps, "episode did not terminate"
    return env


def test_many_random_episodes_terminate_and_squads_are_valid(pool):
    rng = np.random.default_rng(0)
    for _ in range(30):
        env = run_random_episode(pool, rng)
        assert env.done()
        for seat in range(env.seat_count):
            squad = env.squads[seat]
            if env.finalized[seat] and len(squad.slot_occupant) < 11:
                continue  # a genuine stalled dead-end -- allowed, see env docstring
            assert squad.is_full()


def test_no_player_drafted_twice(pool):
    rng = np.random.default_rng(1)
    env = run_random_episode(pool, rng)
    all_picks = [p for squad in env.squads for p in squad.slot_occupant.values()]
    assert len(all_picks) == len(set(all_picks))
    assert env.taken.sum() == len(all_picks)


def test_constraint_cap_never_exceeded_in_final_squads(pool):
    rng = np.random.default_rng(2)
    for _ in range(20):
        config = sample_random_config(rng, "free-pick")
        if config.constraint is None:
            continue
        env = run_random_episode(pool, rng, config=config)
        cap = cap_for(config.constraint)
        key, limit = cap
        counts = env.spend.club_count if key == "club" else env.spend.nation_count
        assert counts.max() <= limit


def test_reward_matches_squad_score_at_finalization(pool):
    rng = np.random.default_rng(3)
    env = FreePickEnv(pool)
    env.reset(rng)
    total_reward_seen = {}
    while not env.done():
        seat = env.acting_seat()
        mask = env.legal_action_mask()
        legal = np.nonzero(mask)[0]
        action = int(legal[rng.integers(len(legal))])
        rewards = env.step(action)
        for s, r in rewards.items():
            assert s not in total_reward_seen  # exactly one terminal payout per seat
            total_reward_seen[s] = r
    assert len(total_reward_seen) == env.seat_count
    for seat in range(env.seat_count):
        assert abs(total_reward_seen[seat] - env.squads[seat].score(pool)) < 1e-6


def test_observation_shapes_are_consistent(pool):
    rng = np.random.default_rng(4)
    env = FreePickEnv(pool)
    env.reset(rng)
    seat = env.acting_seat()
    obs = env.observe(seat)
    assert obs["candidate_features"].shape[0] == len(obs["candidate_indices"])
    from footydraft_sim.observation import CANDIDATE_FEATURE_LEN, CONTEXT_LEN

    assert obs["context"].shape == (CONTEXT_LEN,)
    assert obs["candidate_features"].shape[1] == CANDIDATE_FEATURE_LEN


def test_stalled_dead_ends_are_rare_across_many_episodes(pool):
    rng = np.random.default_rng(5)
    total_seats = 0
    total_stalls = 0
    for _ in range(200):
        env = run_random_episode(pool, rng)
        total_seats += env.seat_count
        total_stalls += env.stalled_dead_ends
    # Not a hard game-logic invariant (the real app documents Free Pick as capable of
    # ending incomplete), just a sanity bound: viable configs shouldn't stall often
    # under uniform-random play.
    assert total_stalls / total_seats < 0.05
