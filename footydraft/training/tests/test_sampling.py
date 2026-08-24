import numpy as np

from footydraft_sim.sampling import draw_skewed


def test_returns_distinct_indices_no_replacement():
    rng = np.random.default_rng(0)
    ability = np.array([10.0, 20.0, 30.0, 40.0, 50.0], dtype=np.float32)
    candidates = np.array([0, 1, 2, 3, 4])
    chosen = draw_skewed(rng, candidates, ability, count=3)
    assert len(chosen) == 3
    assert len(set(chosen.tolist())) == 3
    assert set(chosen.tolist()).issubset(set(candidates.tolist()))


def test_count_exceeding_candidates_returns_all():
    rng = np.random.default_rng(0)
    ability = np.array([10.0, 20.0], dtype=np.float32)
    candidates = np.array([0, 1])
    chosen = draw_skewed(rng, candidates, ability, count=5)
    assert sorted(chosen.tolist()) == [0, 1]


def test_zero_count_returns_empty():
    rng = np.random.default_rng(0)
    ability = np.array([10.0, 20.0], dtype=np.float32)
    chosen = draw_skewed(rng, np.array([0, 1]), ability, count=0)
    assert len(chosen) == 0


def test_skewed_toward_higher_ability():
    # Over many independent single-draws from the same pool, the highest-ability
    # candidate should be picked first far more often than the lowest — softmax
    # weight(p) = exp((ability[p]-best)/10) makes a 50-point gap a ~150x weight ratio.
    rng = np.random.default_rng(42)
    ability = np.array([0.0, 50.0, 100.0], dtype=np.float32)  # low, mid, best
    candidates = np.array([0, 1, 2])
    counts = {0: 0, 1: 0, 2: 0}
    trials = 2000
    for _ in range(trials):
        chosen = draw_skewed(rng, candidates, ability, count=1)
        counts[int(chosen[0])] += 1
    assert counts[2] > counts[1] > counts[0]
    assert counts[2] / trials > 0.85  # best-of-3 at a 100-point gap should dominate


def test_equal_ability_is_roughly_uniform():
    rng = np.random.default_rng(1)
    ability = np.array([10.0, 10.0, 10.0], dtype=np.float32)
    candidates = np.array([0, 1, 2])
    counts = {0: 0, 1: 0, 2: 0}
    trials = 3000
    for _ in range(trials):
        chosen = draw_skewed(rng, candidates, ability, count=1)
        counts[int(chosen[0])] += 1
    for c in counts.values():
        assert abs(c / trials - 1 / 3) < 0.05
