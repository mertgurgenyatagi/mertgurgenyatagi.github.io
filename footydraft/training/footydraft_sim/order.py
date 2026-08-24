"""Turn-order math. Two distinct, non-interchangeable orders (GAME-RULES.md §2) —
do not use one where the other belongs."""


def seat_at(overall: int, seat_count: int) -> int:
    """Snake order — Free Pick and Spin the Wheel share this (draftEngine.ts)."""
    round_ = overall // seat_count
    place = overall % seat_count
    return place if round_ % 2 == 0 else seat_count - 1 - place


def round_at(overall: int, seat_count: int) -> int:
    """1-indexed round number for snake order."""
    return overall // seat_count + 1


def seat_order(round_1indexed: int, seat_count: int) -> list:
    """Strict round-robin, never reverses — Deal or No Deal only (dondEngine.ts).
    seatAt is explicitly wrong for this format; do not substitute it here."""
    return [(round_1indexed - 1 + i) % seat_count for i in range(seat_count)]
