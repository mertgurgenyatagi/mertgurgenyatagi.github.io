"""
Half-manual image saver: for each player it opens the search, then waits
for you to click the image you want. The save sequence runs on its own
once you click.

Per player, in the currently focused window:

     1. F8                                    -> 0.04s
     3. paste the search URL                  -> 0.04s
     5. Enter                                 -> 1.5s (results render)
        *** you click the image ***           -> 6.0s (details load)
     7. Tab x4, or x5 if the click landed
        outside the top-left region
        (0.04s apart)                        -> 0.04s
     9. Menu key                              -> 0.04s
    11. Down x9 (0.04s apart)                 -> 0.04s
    12. Enter                                 -> 1.5s
    14. paste the player's name               -> 0.04s
    16. Enter                                 -> 0.1s
        next player

tab_count_for() branches on where you actually clicked -- a click in the
top-left region (left 10% of the width, top half of the height) needs one
Tab fewer to reach the save option, empirically.

Players whose image is already sitting in assets/ are skipped, matched on
the filename stem regardless of extension -- so a rerun picks up only what
is still missing.

A background watcher samples a WATCH_SIZE square centred on
(WATCH_CENTER_X, WATCH_CENTER_Y) a few times a second. A blank/white page in
that spot -- a crash, a lost-focus dialog, Google running out of results --
means the automation is about to press keys into nothing, so the moment it
goes mostly white the run stops (no further keys for the current or any
later player) and a siren plays. The siren does not stop itself; it is
there so a run left unattended does not silently misfire for hours, so it
keeps going until you kill the script (Ctrl+C).

Abort at any time:
  * Ctrl+C in this terminal
  * slam the mouse into the top-left corner of the screen (pyautogui failsafe)

Usage:
    python save_player_images.py               # all players
    python save_player_images.py --dry-run     # print, don't press anything
    python save_player_images.py --start 120   # resume from player 120
    python save_player_images.py --limit 5     # only 5 players (test run)
    python save_player_images.py --no-skip     # redo players already in assets/
"""

import argparse
import csv
import sys
import threading
import time
import unicodedata
import winsound
from pathlib import Path
from urllib.parse import quote_plus

import pyautogui
import pyperclip
from pynput import mouse

CSV_PATH = Path(__file__).parent / "data" / "player_data.csv"

# tbs: isz:lt,islt:6mp filters to images under 6MP, ift:jpg restricts the
# file type to JPEG (Google's tbs token for that -- itp:photo would restrict
# by subject instead, this is by format).
URL_TEMPLATE = (
    "https://www.google.com/search?q={query}"
    "&udm=2&tbs=isz:lt,islt:6mp,ift:jpg"
)


def build_url(name, club):
    query = quote_plus(f"{name} {club}")
    return URL_TEMPLATE.format(query=query)


def load_players(csv_path):
    """(name, club) pairs for every CSV row that has both."""
    with csv_path.open(encoding="utf-8-sig", newline="") as handle:
        return [
            (row["Name"].strip(), row["Club"].strip())
            for row in csv.DictReader(handle)
            if row.get("Name", "").strip() and row.get("Club", "").strip()
        ]


# --------------------------------------------------------------------------
# Timing knobs (seconds), named for the step they follow.
# --------------------------------------------------------------------------
AFTER_F8 = 0.04
AFTER_URL_PASTE = 0.04
AFTER_ENTER = 1.5       # time for Google Images search results to render
AFTER_CLICK = 6.0
TAB_INTERVAL = 0.04
AFTER_TABS = 0.04
AFTER_MENU = 0.04
DOWN_INTERVAL = 0.04
BEFORE_SAVE_ENTER = 0.04
AFTER_SAVE_ENTER = 1.5
AFTER_NAME_PASTE = 0.04
AFTER_FINAL_ENTER = 0.8

TAB_COUNT = 5
TAB_COUNT_TOPLEFT = 4      # used when the click lands in the region below
TOPLEFT_MAX_X = 0.10       # left 10% of the screen width
TOPLEFT_MAX_Y = 0.50       # top half of the screen height

DOWN_PRESSES = 10

COUNTDOWN = 5  # seconds to go focus the browser before the loop starts

ASSETS_DIR = Path(__file__).with_name("assets")

# The "something's wrong" watch square, and what counts as white enough to
# trip it. WATCH_WHITE_FRACTION < 1.0 to tolerate the odd stray pixel (a
# cursor, a scrollbar sliver) rather than demanding a literally perfect square.
WATCH_CENTER_X = 1550
WATCH_CENTER_Y = 700
WATCH_SIZE = 100
WATCH_WHITE_THRESHOLD = 250  # a channel counts as white at/above this (0-255)
WATCH_WHITE_FRACTION = 0.95  # fraction of the square that must be that white
WATCH_POLL_INTERVAL = 0.5    # seconds between samples

# Set by the watcher thread the moment the square trips; checked everywhere
# a wait happens so the run stops mid-player rather than finishing the step.
_white_detected = threading.Event()
# Tells the watcher thread to quit -- set once the run ends for any reason,
# so it does not linger after the main loop has moved on to alarm_forever()
# or exited normally.
_watch_stop = threading.Event()

pyautogui.FAILSAFE = True
pyautogui.PAUSE = 0.0  # all pacing is explicit below


def _match_key(name):
    """Normalise a name so CSV text and a filename compare equal.

    NFC because an accented character can be stored either pre-composed or as
    letter + combining mark, and casefold because Windows filenames are
    case-insensitive.
    """
    return unicodedata.normalize("NFC", name).strip().casefold()


def saved_players(assets_dir):
    """Names already saved in `assets_dir`, keyed for comparison.

    The extension is ignored -- what comes back from Google may be .webp,
    .jpg or .png, and any of them means the player is done.
    """
    if not assets_dir.is_dir():
        return set()
    return {_match_key(p.stem) for p in assets_dir.iterdir() if p.is_file()}


def press_burst(key, times, interval):
    """Press `key` `times` times, with `interval` strictly between presses."""
    for i in range(times):
        if i:
            time.sleep(interval)
        pyautogui.press(key)


def tab_count_for(x, y):
    """Tabs to press, given where the click landed.

    A click in the top-left region -- left 10% of the width, top half of the
    height -- needs one Tab fewer than anywhere else. Empirical: that region
    leaves the focus one stop further along.
    """
    width, height = pyautogui.size()
    if x < width * TOPLEFT_MAX_X and y < height * TOPLEFT_MAX_Y:
        return TAB_COUNT_TOPLEFT
    return TAB_COUNT


def _watch_box():
    half = WATCH_SIZE // 2
    return (WATCH_CENTER_X - half, WATCH_CENTER_Y - half, WATCH_SIZE, WATCH_SIZE)


def square_is_white():
    shot = pyautogui.screenshot(region=_watch_box()).convert("RGB")
    pixels = shot.getdata()
    white = sum(
        1 for r, g, b in pixels
        if r >= WATCH_WHITE_THRESHOLD
        and g >= WATCH_WHITE_THRESHOLD
        and b >= WATCH_WHITE_THRESHOLD
    )
    return white / len(pixels) >= WATCH_WHITE_FRACTION


def watch_for_white():
    """Background loop: trips `_white_detected` the moment the square whites out.

    Runs on its own thread so it keeps sampling regardless of what run_player
    is doing between its pyautogui calls. A failed screenshot (e.g. the
    display briefly locked) is swallowed rather than crashing the watcher --
    missing one sample is fine, dying silently and never catching a real
    trip is not.
    """
    while not _watch_stop.is_set():
        try:
            if square_is_white():
                _white_detected.set()
                return
        except Exception:
            pass
        _watch_stop.wait(WATCH_POLL_INTERVAL)


def wait_for_click():
    """Block until the next left click, and return its (x, y).

    Returns None if the run was aborted (white-square trip) while waiting
    -- there is no click to report in that case, and the caller should
    stop rather than act on a stale/absent position.
    """
    clicked_at = {}

    def on_click(x, y, button, pressed):
        if pressed and button == mouse.Button.left:
            clicked_at["pos"] = (x, y)
            return False  # stop the listener

    with mouse.Listener(on_click=on_click) as listener:
        while listener.is_alive():
            if _white_detected.is_set():
                listener.stop()
                return None
            listener.join(0.1)

    return clicked_at.get("pos")


def alarm_forever(resume_index):
    """Siren that only stops when you kill the script.

    Deliberately not time-limited or auto-silenced: the point is that a run
    left unattended cannot fail silently, so this stays loud until someone
    notices and hits Ctrl+C.
    """
    print("\n" + "!" * 60)
    print(f"WHITE SQUARE at ({WATCH_CENTER_X},{WATCH_CENTER_Y}) -- stopped.")
    print(f"Resume with: --start {resume_index}")
    print("Alarm is playing. Ctrl+C to silence it.")
    print("!" * 60)
    try:
        while True:
            for freq in (900, 1400):
                winsound.Beep(freq, 300)
    except KeyboardInterrupt:
        print("\nAlarm stopped.")


def run_player(name, club, dry_run):
    url = build_url(name, club)

    if dry_run:
        print(f"    would paste url:  {url}")
        print(f"    would paste name: {name}")
        return

    if _white_detected.is_set():   # tripped between players
        return

    pyautogui.press("f8")                              # 1
    if _white_detected.wait(AFTER_F8):                  # 2
        return

    pyperclip.copy(url)                                # 3
    pyautogui.hotkey("ctrl", "v")
    if _white_detected.wait(AFTER_URL_PASTE):           # 4
        return

    pyautogui.press("enter")                           # 5
    if _white_detected.wait(AFTER_ENTER):               # wait for results to load
        return

    click_pos = wait_for_click()                       # 6  -- blocks for you
    if click_pos is None:
        return
    tabs = tab_count_for(*click_pos)
    if _white_detected.wait(AFTER_CLICK):
        return

    press_burst("tab", tabs, TAB_INTERVAL)             # 7
    if _white_detected.wait(AFTER_TABS):                # 8
        return

    pyautogui.press("apps")                            # 9  (Menu key)
    if _white_detected.wait(AFTER_MENU):                # 10
        return

    press_burst("down", DOWN_PRESSES, DOWN_INTERVAL)   # 11
    if _white_detected.wait(BEFORE_SAVE_ENTER):
        return

    pyautogui.press("enter")                           # 12
    if _white_detected.wait(AFTER_SAVE_ENTER):          # 13
        return

    pyperclip.copy(name)                               # 14
    pyautogui.hotkey("ctrl", "v")
    if _white_detected.wait(AFTER_NAME_PASTE):          # 15
        return

    pyautogui.press("enter")                           # 16
    _white_detected.wait(AFTER_FINAL_ENTER)             # 17


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--csv", type=Path, default=CSV_PATH,
                        help="path to player_data.csv")
    parser.add_argument("--start", type=int, default=1,
                        help="1-based player number to start from (resume)")
    parser.add_argument("--limit", type=int, default=None,
                        help="stop after this many players")
    parser.add_argument("--dry-run", action="store_true",
                        help="print the URLs and names without pressing keys")
    parser.add_argument("--assets", type=Path, default=ASSETS_DIR,
                        help="folder of already-saved images to skip over")
    parser.add_argument("--no-skip", action="store_true",
                        help="do every player, even ones already in assets/")
    args = parser.parse_args()

    if not args.csv.exists():
        sys.exit(f"CSV not found: {args.csv}")

    players = load_players(args.csv)
    if not players:
        sys.exit(f"No usable rows (need 'Name' and 'Club') in {args.csv}")

    # Carry the CSV position along, so skipping players does not throw off
    # the numbering the --start resume hint relies on.
    selected = [(i, name, club)
                for i, (name, club) in enumerate(players, start=1)
                if i >= args.start]
    if not selected:
        sys.exit(f"--start {args.start} is past the last player ({len(players)})")

    skipped = 0
    if not args.no_skip:
        already = saved_players(args.assets)
        before = len(selected)
        selected = [row for row in selected if _match_key(row[1]) not in already]
        skipped = before - len(selected)

    if args.limit is not None:
        selected = selected[:args.limit]

    if not selected:
        print(f"Nothing to do -- all {skipped} remaining players already have "
              f"an image in {args.assets}.")
        return

    summary = f"{len(players)} players in CSV, running {len(selected)}"
    if skipped:
        summary += f" ({skipped} skipped, already in {args.assets.name}/)"
    print(summary)

    if not args.dry_run:
        print("Half-manual -- the search opens for each player, then waits "
              "for you to click the image you want.")
        print("Focus the browser window now. Abort with Ctrl+C here, or by "
              "throwing the mouse into the top-left screen corner.")
        for remaining in range(COUNTDOWN, 0, -1):
            print(f"  starting in {remaining}...", end="\r", flush=True)
            time.sleep(1)
        print(" " * 32, end="\r")

    if not args.dry_run:
        threading.Thread(target=watch_for_white, daemon=True).start()

    index = selected[0][0]  # so an abort before the first player still reports
    try:
        for index, name, club in selected:
            if _white_detected.is_set():
                break
            print(f"[{index}/{len(players)}] {name} - {club}", flush=True)
            run_player(name, club, args.dry_run)
            if _white_detected.is_set():
                break
    except KeyboardInterrupt:
        print(f"\nStopped. Resume with: --start {index}")
        return
    except pyautogui.FailSafeException:
        print(f"\nFailsafe triggered. Resume with: --start {index}")
        return
    finally:
        _watch_stop.set()

    if _white_detected.is_set():
        alarm_forever(index)
        return

    print("Done.")


if __name__ == "__main__":
    main()
