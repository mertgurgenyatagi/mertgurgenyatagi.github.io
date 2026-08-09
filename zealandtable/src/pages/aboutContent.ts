import { PREDICTIONS_CLOSE_ISO, SEASON_START_ISO, formatDeadline } from "@/data/deadlines";
import { CLUB_COUNT } from "@/data/clubs";
import { AWARDS } from "@/data/awards";
import { MAX_SCORE } from "@/data/scoring";
import { CHANNEL_NAME, SITE_NAME } from "@/data/site";

/**
 * /about's content and date logic, shared by the desktop poster layout and
 * the mobile stack. The timeline runs horizontally on desktop and vertically
 * on a phone, but "which node is the current one" is the same question
 * either way.
 */

/**
 * Encyclopedic, not dramatic — one paragraph that assumes no prior knowledge:
 * what the site is, who it's for, exactly how scoring works, and what else is
 * here beyond the prediction itself.
 *
 * Every number is interpolated from the rulebook. The standing rule for this
 * project is that no scoring figure is ever restated in copy.
 */
export const ESSENCE_TEXT =
  `${SITE_NAME} is a season-long Premier League prediction game. Before a ball is kicked you rank all ${CLUB_COUNT} clubs from champions to relegated, call both domestic cups, and name the six individual award winners. A club placed in exactly the right position scores full marks, one place out still scores, and anything further out scores nothing; naming the champion and each relegated club adds a bonus on top, so a flawless entry is worth ${MAX_SCORE} points across the table and its ${AWARDS.length} side picks. Entries close on ${formatDeadline()} and cannot be changed afterwards. Alongside the prediction the site carries a forum, a live chat room, and a dossier for every club and every participant. It was built for ${CHANNEL_NAME}'s audience.`;

export const CONTACT_EMAIL = "thisisfootballstuff@gmail.com";

/**
 * Four nodes, not the parent's six — irishtable has one phase, so there is no
 * knockout-prediction window to open and close.
 *
 * `granularity` exists because the last two dates genuinely are not known to
 * the day: the Premier League's final matchday and the award ceremonies land
 * somewhere in May 2027 and the fixture list for 2026-27 is not out. Marking
 * them rather than inventing a day is deliberate — the parent's equivalent
 * file carries a placeholder date with a comment saying it's a placeholder,
 * which is exactly the thing that later gets read as real.
 */
export type DateGranularity = "day" | "month";

export type KeyDate = {
  label: string;
  date: Date;
  granularity: DateGranularity;
};

export const KEY_DATES: KeyDate[] = [
  {
    label: "Entries Close",
    date: new Date(PREDICTIONS_CLOSE_ISO),
    granularity: "day",
  },
  {
    label: "Season Starts",
    date: new Date(SEASON_START_ISO),
    granularity: "day",
  },
  {
    label: "Final Matchday",
    date: new Date("2027-05-01T00:00:00+01:00"),
    granularity: "month",
  },
  {
    label: "Awards Decided",
    date: new Date("2027-05-31T00:00:00+01:00"),
    granularity: "month",
  },
];

/**
 * Every date here is anchored to UK time, because that is what the fixture
 * list and the deadline are anchored to.
 *
 * Formatting them with `getDate()`/`getMonth()` reads the *viewer's* timezone
 * instead, and the entries-close instant — 23:59:59 on the 21st, BST — is one
 * second short of midnight. Anywhere east of the UK that renders as the 22nd,
 * which is how the timeline came to show "22 Aug" for both entries-close and
 * season-start: two different instants collapsing onto one label. Mert is in
 * UTC+3, so he would have been the first to see it and the last to be able to
 * explain it.
 *
 * `formatDeadline()` in deadlines.ts already pins Europe/London for the same
 * reason. This matches it.
 */
const UK = "Europe/London";

const dayFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  timeZone: UK,
});

const monthFormatter = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  year: "numeric",
  timeZone: UK,
});

/** "21 Aug" for a known day; "May 2027" for the two that are only known to
 *  the month. Rendering a made-up day would be a lie the layout can't undo. */
export function formatChipDate(item: KeyDate): string {
  const formatted =
    item.granularity === "month"
      ? monthFormatter.format(item.date)
      : dayFormatter.format(item.date);
  // en-GB emits "21 Aug" / "May 2027" already; strip any stray comma some
  // ICU builds insert between month and year.
  return formatted.replace(",", "");
}

export type DateStatus = "past" | "current" | "future";

export function getDateStatus(
  date: Date,
  now: number,
  currentThreshold: number | null
): DateStatus {
  if (date.getTime() < now) return "past";
  if (currentThreshold !== null && date.getTime() === currentThreshold) return "current";
  return "future";
}

/** The timestamp of the next date that hasn't passed — the node the timeline
 *  marks as "current". Null once every date is in the past. */
export function currentThresholdFor(now: number): number | null {
  const upcoming = KEY_DATES.find((item) => item.date.getTime() >= now);
  return upcoming ? upcoming.date.getTime() : null;
}
