/**
 * The scoring system, as data.
 *
 * No scoring *engine* exists yet — nothing has been played, so there is
 * nothing to score. What lives here is the rulebook in machine-readable form,
 * for two reasons:
 *
 *   1. The Scoring page renders from these constants rather than restating
 *      them in prose, so the page cannot drift from the rules.
 *   2. When a real engine is eventually written (league phase, out of scope
 *      today), it imports these same constants instead of hand-duplicating
 *      them — the exact maintenance risk the parent project carries, where
 *      functions/leaderboard holds a hand-copied duplicate of the client's
 *      scoring logic kept in sync by comment alone.
 *
 * The two pure functions below are the whole of the table rule and are unit
 * tested directly.
 */

import { CLUB_COUNT } from "./clubs";

/** Points for placing a club in exactly the right final position. */
export const EXACT_POSITION_POINTS = 6;

/** Points for missing by exactly one place, in either direction. */
export const OFF_BY_ONE_POINTS = 4;

/** Extra points for calling the champion, on top of that position's points. */
export const CHAMPION_BONUS = 8;

/** Extra points per correctly identified relegated club. */
export const RELEGATION_BONUS = 2;

/** The three relegation places. Order among them does not matter — naming
 *  all three in any arrangement scores the full bonus three times. */
export const RELEGATION_POSITIONS: readonly number[] = [18, 19, 20];

export const AWARD_POINTS = {
  faCup: 4,
  carabao: 4,
  playerOfSeason: 2,
  youngPlayerOfSeason: 3,
  managerOfSeason: 2,
  goldenBoot: 2,
  goldenGlove: 2,
  bestPlaymaker: 3,
} as const;

/**
 * Points for one club's placement.
 * Both arguments are 1-based finishing positions.
 */
export function tablePointsFor(predictedPosition: number, actualPosition: number): number {
  const gap = Math.abs(predictedPosition - actualPosition);
  if (gap === 0) return EXACT_POSITION_POINTS;
  if (gap === 1) return OFF_BY_ONE_POINTS;
  return 0;
}

/**
 * Whether a club predicted for a relegation place actually went down.
 * Deliberately order-insensitive within the bottom three.
 */
export function earnsRelegationBonus(
  predictedPosition: number,
  actualPosition: number
): boolean {
  return (
    RELEGATION_POSITIONS.includes(predictedPosition) &&
    RELEGATION_POSITIONS.includes(actualPosition)
  );
}

/**
 * The best score achievable with a flawless prediction:
 * every position exact, plus every bonus and every award.
 */
export const MAX_SCORE =
  CLUB_COUNT * EXACT_POSITION_POINTS +
  CHAMPION_BONUS +
  RELEGATION_POSITIONS.length * RELEGATION_BONUS +
  Object.values(AWARD_POINTS).reduce((sum, n) => sum + n, 0);

/**
 * The rulebook, in the order the Scoring page presents it. `points` is the
 * headline number; `note` carries the qualification that stops it being
 * misread.
 */
export type ScoringRule = {
  label: string;
  points: string;
  note?: string;
};

export const TABLE_RULES: readonly ScoringRule[] = [
  {
    label: "Exact position",
    points: `${EXACT_POSITION_POINTS}`,
    note: "The club finishes precisely where you put it.",
  },
  {
    label: "Off by one",
    points: `${OFF_BY_ONE_POINTS}`,
    note: "One place out either way — 5th predicted, 4th or 6th actual.",
  },
  {
    label: "Anything else",
    points: "0",
    note: "Two or more places out scores nothing for that club.",
  },
];

export const BONUS_RULES: readonly ScoringRule[] = [
  {
    label: "Champion bonus",
    points: `+${CHAMPION_BONUS}`,
    note: "For calling the title, on top of the points for that position.",
  },
  {
    label: "Relegation bonus",
    points: `+${RELEGATION_BONUS}`,
    note: "Per club, for naming a team that goes down. Order among the bottom three does not matter.",
  },
];

export const CUP_RULES: readonly ScoringRule[] = [
  { label: "FA Cup winner", points: `${AWARD_POINTS.faCup}` },
  { label: "Carabao Cup winner", points: `${AWARD_POINTS.carabao}` },
];

export const INDIVIDUAL_RULES: readonly ScoringRule[] = [
  { label: "Young Player of the Season", points: `${AWARD_POINTS.youngPlayerOfSeason}` },
  { label: "Best Playmaker", points: `${AWARD_POINTS.bestPlaymaker}` },
  { label: "Player of the Season", points: `${AWARD_POINTS.playerOfSeason}` },
  { label: "Manager of the Season", points: `${AWARD_POINTS.managerOfSeason}` },
  { label: "Golden Boot", points: `${AWARD_POINTS.goldenBoot}` },
  { label: "Golden Glove", points: `${AWARD_POINTS.goldenGlove}` },
];
