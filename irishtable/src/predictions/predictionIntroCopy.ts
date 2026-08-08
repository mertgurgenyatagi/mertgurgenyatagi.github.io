import { CLUB_COUNT } from "@/data/clubs";
import { AWARDS } from "@/data/awards";
import { EXACT_POSITION_POINTS, OFF_BY_ONE_POINTS } from "@/data/scoring";

// The "movie intro" beats shown once, before the ranker — user-advanced, a
// few short lines rather than one dense paragraph. The middle beat also
// carries a live scoring-example visual (see ScoringExampleDiagram.tsx),
// hence boldTerms: the two numbers that actually matter in that sentence.
//
// Every number here is interpolated from the rulebook. The project's standing
// rule is that no scoring figure is ever restated in copy — the parent's
// equivalent file hard-codes "3" and drifts the moment the rule changes.
export interface PredictionIntroBeat {
  text: string;
  boldTerms?: string[];
}

export const PREDICTION_INTRO_BEATS: PredictionIntroBeat[] = [
  { text: `Rank all ${CLUB_COUNT} clubs, from champions down to the drop.` },
  {
    text: `Put a club exactly where it finishes and you get ${EXACT_POSITION_POINTS} points. Miss by one place either way and you still get ${OFF_BY_ONE_POINTS}.`,
    boldTerms: [String(EXACT_POSITION_POINTS), String(OFF_BY_ONE_POINTS)],
  },
  {
    text: `Then ${AWARDS.length} more calls: both cups and the six individual awards.`,
    boldTerms: [String(AWARDS.length)],
  },
];
