import { RELEGATION_POSITIONS } from "@/data/scoring";

/**
 * Premier League table bands, as a quiet accent on any standings list.
 *
 * The parent encodes the Champions League's 2024/25 league-phase structure
 * (1–8 direct, 9–24 playoff, 25–36 out). That has no meaning in a 20-team
 * domestic league, so this is the equivalent for this competition.
 *
 * Deliberately derived from `src/data/scoring.ts` rather than restated: the
 * only positions irishtable's rulebook actually singles out are first place
 * (which carries the champion bonus) and the three relegation places (which
 * carry the relegation bonus). European qualification places are **not**
 * included, because how many Premier League clubs qualify for which European
 * competition varies season to season and is not something this project has a
 * source for — inventing a cutoff would put a wrong fact on a real standings
 * widget.
 */
export type QualificationBand = "champion" | "mid" | "relegation";

export function qualificationBand(position: number): QualificationBand {
  if (position === 1) return "champion";
  if (RELEGATION_POSITIONS.includes(position)) return "relegation";
  return "mid";
}
