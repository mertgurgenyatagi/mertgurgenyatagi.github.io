import { LeaderboardEntry } from "./leaderboardTypes";

export interface RankedEntry {
  entry: LeaderboardEntry;
  /** 1-based, competition-style: equal points share a rank and the next rank
   *  skips accordingly (1, 2, 2, 4). */
  rank: number;
}

/**
 * Sorts entries and assigns competition ranks.
 *
 * Ties break on `submittedAt` — whoever locked their table in first is listed
 * above someone on the same points — but they still share a rank number,
 * because being earlier is a display order, not a better prediction.
 *
 * Nothing produces populated entries yet (there is no scoring engine); this is
 * here because the ported popups are typed against it.
 */
export function assignRanks(entries: LeaderboardEntry[]): RankedEntry[] {
  const sorted = [...entries].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return (a.submittedAt ?? Infinity) - (b.submittedAt ?? Infinity);
  });

  let lastPoints: number | null = null;
  let lastRank = 0;

  return sorted.map((entry, index) => {
    if (lastPoints === null || entry.points !== lastPoints) {
      lastRank = index + 1;
      lastPoints = entry.points;
    }
    return { entry, rank: lastRank };
  });
}
