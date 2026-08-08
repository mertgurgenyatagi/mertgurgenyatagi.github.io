import { Team } from "./teams";
import { BOUNDARY_SPAN } from "./predictionBoundary";

/** Wide enough to show the scoring band with a non-scoring row on each side,
 *  so the diagram illustrates a boundary rather than a solid block. */
const WINDOW_SIZE = BOUNDARY_SPAN * 2 + 3;
const HALF = Math.floor(WINDOW_SIZE / 2);

export interface ScoringExampleWindow {
  teams: Team[];
  /** Index within `teams` of the club the example is actually centred on —
   *  usually dead centre, but shifts if `centerTeamId` sits too close to
   *  either end of the real club list to stay perfectly centred. */
  centerIndex: number;
}

/** A slice of the real club list, centred as closely as possible on
 *  `centerTeamId` — the scoring-example diagram shown in the intro. */
export function buildScoringExampleWindow(teams: Team[], centerTeamId: string): ScoringExampleWindow {
  const idx = teams.findIndex((t) => t.id === centerTeamId);
  if (idx === -1) {
    return { teams: teams.slice(0, WINDOW_SIZE), centerIndex: 0 };
  }
  const start = Math.max(0, Math.min(idx - HALF, teams.length - WINDOW_SIZE));
  return { teams: teams.slice(start, start + WINDOW_SIZE), centerIndex: idx - start };
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** A stable stand-in for when someone's quiz answer wasn't a real club (they
 *  picked "Another club" or "No one in particular") — hashed off their uid
 *  rather than truly random, so the example doesn't reshuffle every visit. */
export function pickFallbackTeam(teams: Team[], uid: string): Team {
  return teams[hashString(uid) % teams.length];
}
