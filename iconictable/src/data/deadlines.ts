/**
 * The one date the app cares about.
 *
 * irishtable has no tournament-phase machine — unlike the parent project's
 * four-phase enum and eight-state visibility matrix, there is exactly one
 * phase here (pre-season), and a single deadline gates the only thing that
 * closes: prediction submission.
 *
 * Mert's dates: the season starts 22 August 2026 and predictions close on the
 * 21st. That is read as end-of-day on the 21st, UK local time (BST, UTC+1),
 * which lands the cutoff ahead of the first fixture either way.
 */

export const PREDICTIONS_CLOSE_ISO = "2026-08-21T23:59:59+01:00";
export const SEASON_START_ISO = "2026-08-22T00:00:00+01:00";

export const PREDICTIONS_CLOSE_MS = Date.parse(PREDICTIONS_CLOSE_ISO);
export const SEASON_START_MS = Date.parse(SEASON_START_ISO);

/**
 * Injectable clock. Tests pass an explicit `now`; the app calls it bare.
 * Keeping the default in one place stops a stray `Date.now()` from making a
 * component untestable.
 */
export function predictionsAreOpen(now: number = Date.now()): boolean {
  return now <= PREDICTIONS_CLOSE_MS;
}

export type Countdown = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** True once the deadline has passed — every unit reads zero. */
  expired: boolean;
};

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Time left until predictions close, floored at zero. */
export function countdownTo(target: number, now: number = Date.now()): Countdown {
  const remaining = target - now;
  if (remaining <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  }
  return {
    days: Math.floor(remaining / DAY),
    hours: Math.floor((remaining % DAY) / HOUR),
    minutes: Math.floor((remaining % HOUR) / MINUTE),
    seconds: Math.floor((remaining % MINUTE) / SECOND),
    expired: false,
  };
}

/** e.g. "21 August 2026" — used in copy, not in the countdown. */
export function formatDeadline(iso: string = PREDICTIONS_CLOSE_ISO): string {
  return new Date(Date.parse(iso)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/London",
  });
}
