"""Shared feature encoding for the two 'pick a player from a pool' formats (Free Pick,
Spin the Wheel, and Auction's swap phase). Exposes true game state to the network —
own/opponent squad shape, table-wide scarcity, progress — never a hint about which of
those facts matters; that's for training to discover.

Everything is fixed-size regardless of actual seat_count, so one network handles every
table size from MIN_SEATS..MAX_SEATS: opponent context is always padded/masked out to
MAX_SEATS-1 slots, ordered relative to the observing seat (opponent[0] = next to act
after me), never by raw absolute seat index, which carries no consistent meaning
across differently-sized tables.
"""

import numpy as np

from .constraints import TableSpend, cap_for
from .formation import POSITION_CODES, SLOTS_FOR_POSITION
from .viability import MAX_SEATS

ABILITY_SCALE = 200.0
PRICE_SCALE = 200.0
MAX_OPPONENTS = MAX_SEATS - 1

N_POSITIONS = len(POSITION_CODES)
SQUAD_SUMMARY_LEN = N_POSITIONS * 3  # (filled, open, best_ability) per position
CONTEXT_LEN = SQUAD_SUMMARY_LEN + MAX_OPPONENTS * (SQUAD_SUMMARY_LEN + 1) + 4
CANDIDATE_FEATURE_LEN = 3 + N_POSITIONS + 1  # ability, price, top5-flag, position one-hot, scarcity


def _squad_summary(pool, squad) -> list:
    out = []
    for pos in POSITION_CODES:
        slots = SLOTS_FOR_POSITION[pos]
        filled_idx = [squad.slot_occupant[s] for s in slots if s in squad.slot_occupant]
        best = max((float(pool.ability[i]) for i in filled_idx), default=0.0)
        out += [len(filled_idx), len(slots) - len(filled_idx), best / ABILITY_SCALE]
    return out


def encode_context(
    pool,
    seat: int,
    squads: list,
    seat_count: int,
    overall: int,
    total_picks: int,
    constraint,
) -> np.ndarray:
    features = list(_squad_summary(pool, squads[seat]))

    turn_order_after_me = [(seat + 1 + k) % seat_count for k in range(seat_count - 1)]
    for k in range(MAX_OPPONENTS):
        if k < len(turn_order_after_me):
            opp = squads[turn_order_after_me[k]]
            features += _squad_summary(pool, opp)
            features.append(1.0)
        else:
            features += [0.0] * SQUAD_SUMMARY_LEN
            features.append(0.0)

    features.append(overall / max(total_picks, 1))
    features.append(seat_count / MAX_SEATS)
    cap = cap_for(constraint) if constraint else None
    features.append(1.0 if cap else 0.0)
    features.append((cap[1] if cap else 0.0) / 3.0)

    arr = np.asarray(features, dtype=np.float32)
    assert arr.shape == (CONTEXT_LEN,)
    return arr


def encode_candidates(
    pool,
    candidate_indices: np.ndarray,
    constraint,
    spend: TableSpend | None,
) -> np.ndarray:
    idx = candidate_indices
    n = len(idx)
    ability = (pool.ability[idx] / ABILITY_SCALE).astype(np.float32)
    price = (pool.price[idx] / PRICE_SCALE).astype(np.float32)
    top5 = (pool.league_idx[idx] >= 0).astype(np.float32)
    position_onehot = np.eye(N_POSITIONS, dtype=np.float32)[pool.position_idx[idx]]

    cap = cap_for(constraint) if constraint else None
    if cap is not None and spend is not None:
        key, limit = cap
        counts = spend.club_count[pool.club_idx[idx]] if key == "club" else spend.nation_count[pool.nation_idx[idx]]
        scarcity = (counts.astype(np.float32) / limit)[:, None]
    else:
        scarcity = np.zeros((n, 1), dtype=np.float32)

    out = np.concatenate([ability[:, None], price[:, None], top5[:, None], position_onehot, scarcity], axis=1)
    assert out.shape == (n, CANDIDATE_FEATURE_LEN)
    return out
