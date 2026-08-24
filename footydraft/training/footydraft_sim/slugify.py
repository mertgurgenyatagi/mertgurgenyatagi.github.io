"""Ported verbatim from src/lib/players.ts's slugify(). Only used for CSV dedup keys
and club-name -> club-slug resolution (to look up clubs_data.CLUB_LEAGUES); nothing in
training reproduces the app's portrait/id rendering, so slugify is the only piece needed."""

import unicodedata
import re

FOLD = {
    "ø": "o",
    "ß": "ss",
    "ð": "d",
    "đ": "d",
    "ł": "l",
    "æ": "ae",
    "œ": "oe",
    "þ": "th",
    "ı": "i",
}

_FOLD_RE = re.compile("[" + "".join(FOLD.keys()) + "]")
_NON_ALNUM_RE = re.compile(r"[^a-z0-9]+")


def slugify(value: str) -> str:
    value = value.lower()
    value = _FOLD_RE.sub(lambda m: FOLD[m.group(0)], value)
    value = unicodedata.normalize("NFKD", value)
    value = "".join(c for c in value if not unicodedata.combining(c))
    value = _NON_ALNUM_RE.sub("-", value)
    return value.strip("-")
