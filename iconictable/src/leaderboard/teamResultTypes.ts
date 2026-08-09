/**
 * A club's actual finishing record.
 *
 * Nothing writes one of these yet — there is no results ingestion, by design
 * (the league phase is deliberately unbuilt until the pitch lands). Every
 * widget that would show one is gated on `tournamentStarted` and renders a
 * "not viewable yet" placeholder instead.
 */
export interface TeamResult {
  position: number;
  points: number;
  goalDifference: number;
  goalsFor: number;
  goalsAgainst: number;
  matchesPlayed?: number;
}
