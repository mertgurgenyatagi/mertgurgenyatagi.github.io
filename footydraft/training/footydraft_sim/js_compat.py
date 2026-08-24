"""JS-semantics helpers, for porting formulas that must match Math.round() exactly.

Python's round() is banker's rounding (round-half-to-even); JS's Math.round() always
rounds .5 up. Every ported formula from the TS engines that uses Math.round must go
through js_round instead of the builtin, or values land wrong exactly on .5 ties.
"""

import math


def js_round(x: float) -> float:
    return math.floor(x + 0.5)
