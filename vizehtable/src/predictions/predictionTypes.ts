import { CLUB_COUNT, isClubId } from "@/data/clubs";
import { AWARD_IDS, type AwardId } from "@/data/awards";

/**
 * One participant's full entry: the 20-club table plus the eight side picks.
 *
 * `table` is a strict full ordering — array position *is* the predicted
 * finishing position, so there's no separate rank field to keep in step.
 */
export type Prediction = {
  /** Exactly CLUB_COUNT club ids, no duplicates. Index 0 = predicted champion. */
  table: string[];
  faCup: string;
  carabao: string;
  playerOfSeason: string;
  youngPlayerOfSeason: string;
  managerOfSeason: string;
  goldenBoot: string;
  goldenGlove: string;
  bestPlaymaker: string;
  submittedAt: number;
  updatedAt: number;
};

/** The award half of a prediction, as the flow builds it up. */
export type AwardPicks = Partial<Record<AwardId, string>>;

export type PredictionDraft = {
  table: string[];
  awards: AwardPicks;
};

export type ValidationResult =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Whether a draft is complete and internally consistent. Mirrors what the
 * Firestore rules enforce server-side, so a rejected write is something the
 * UI already prevented rather than a surprise.
 */
export function validateDraft(draft: PredictionDraft): ValidationResult {
  const { table, awards } = draft;

  if (table.length !== CLUB_COUNT) {
    return { ok: false, reason: `The table needs all ${CLUB_COUNT} clubs.` };
  }
  if (new Set(table).size !== table.length) {
    return { ok: false, reason: "A club appears twice in the table." };
  }
  if (!table.every(isClubId)) {
    return { ok: false, reason: "The table contains a club we don't recognise." };
  }

  const missing = AWARD_IDS.filter((id) => !awards[id]);
  if (missing.length > 0) {
    return {
      ok: false,
      reason:
        missing.length === 1
          ? "One award pick is still empty."
          : `${missing.length} award picks are still empty.`,
    };
  }

  return { ok: true };
}

/** Predicted finishing position (1-based) for a club, or undefined. */
export function positionOf(table: readonly string[], clubId: string): number | undefined {
  const index = table.indexOf(clubId);
  return index === -1 ? undefined : index + 1;
}

/** Pull the eight award picks off a stored prediction, for seeding an edit. */
export function awardsFrom(prediction: Prediction | null | undefined): AwardPicks {
  if (!prediction) return {};
  const picks: AwardPicks = {};
  for (const id of AWARD_IDS) {
    const value = prediction[id];
    if (typeof value === "string" && value) picks[id] = value;
  }
  return picks;
}
