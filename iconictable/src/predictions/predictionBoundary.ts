import { OFF_BY_ONE_POINTS, tablePointsFor } from "@/data/scoring";

/**
 * How far either side of a slot still scores something — derived from the
 * rulebook rather than restated. The parent hard-codes 2 because its rule is
 * "within 2 places"; irishtable pays 6 for exact and 4 for off-by-one and
 * nothing beyond, so the band is one row wide.
 *
 * Computed from `tablePointsFor` so that changing the rule changes the
 * bracket automatically. Positions are 1-based there, hence the offset pair
 * rather than a bare gap.
 */
function widestScoringGap(): number {
  let gap = 0;
  // A safe upper bound: no scoring rule in this app pays past a handful of
  // places, and stopping at 10 keeps this a constant-time module-load cost.
  for (let candidate = 1; candidate <= 10; candidate++) {
    if (tablePointsFor(1, 1 + candidate) > 0) gap = candidate;
  }
  return gap;
}

export const BOUNDARY_SPAN = widestScoringGap();

/** Sanity anchor for the derivation above: off-by-one has to be worth
 *  something for the band to be a band at all. */
export const BOUNDARY_IS_MEANINGFUL = OFF_BY_ONE_POINTS > 0;

/** 0-based [start, end] row-index band around `index`, clamped to the list. */
export function boundaryBand(index: number, total: number): [number, number] {
  return [Math.max(0, index - BOUNDARY_SPAN), Math.min(total - 1, index + BOUNDARY_SPAN)];
}

export type BoundaryBandRole = "none" | "top" | "middle" | "bottom";

/** Where `rowIndex` sits relative to the band hovered around `hoveredIndex` —
 *  "top"/"bottom" are the band's two capping rows (where the bracket's
 *  closing strokes go), "middle" is everything between them. */
export function boundaryBandRole(rowIndex: number, hoveredIndex: number, total: number): BoundaryBandRole {
  const [start, end] = boundaryBand(hoveredIndex, total);
  if (rowIndex < start || rowIndex > end) return "none";
  if (rowIndex === start) return "top";
  if (rowIndex === end) return "bottom";
  return "middle";
}
