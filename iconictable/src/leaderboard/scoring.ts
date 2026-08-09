import { tablePointsFor } from "@/data/scoring";

/**
 * Whether a table pick is landing, for the "is this one right?" accent used
 * across the popups and any standings widget.
 *
 * **Derived from the rulebook, never restated.** The parent hard-codes its own
 * rule here (`Math.abs(predicted - actual) < 3`) and keeps a second hand-copied
 * duplicate inside its Cloud Function — which is exactly the drift irishtable's
 * rules-as-data shape exists to prevent. irishtable's rule is tiered (6 exact,
 * 4 off-by-one, 0 beyond), so "correct" means `tablePointsFor` returned
 * anything at all.
 */
export function isPickCorrect(predictedPosition: number, actualPosition: number): boolean {
  return tablePointsFor(predictedPosition, actualPosition) > 0;
}

/** Exact / near / miss, for a three-way accent where a boolean is too blunt. */
export type PickAccuracy = "exact" | "near" | "miss";

export function pickAccuracy(
  predictedPosition: number,
  actualPosition: number
): PickAccuracy {
  if (predictedPosition === actualPosition) return "exact";
  return isPickCorrect(predictedPosition, actualPosition) ? "near" : "miss";
}
