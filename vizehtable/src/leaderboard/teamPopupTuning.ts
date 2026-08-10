/**
 * Every numeric/color value in TeamPopup.tsx that's been fought over in
 * chat-based pixel adjustments, pulled out into one tunable set instead of
 * being hardcoded inline. `DEFAULT_TEAM_POPUP_TUNING` is the exact current
 * shipped look — TeamPopup falls back to it when no `tuning` prop is
 * passed, so ordinary app usage is byte-for-byte unaffected by this
 * existing. TeamPopupTuner.tsx (the dev-only tuning page) renders the same
 * real `TeamPopup` component with a live-editable version of this object —
 * that's what makes the tuner and the live app guaranteed identical at
 * defaults: it's the same component, not a re-built lookalike.
 */
export interface TeamPopupTuning {
  /** Grid column widths, as `fr` units — pitch / stat-lists / rightmost. */
  col1: number;
  col2: number;
  col3: number;
  /** Gap between the three columns, in rem. */
  gridGap: number;
  /** Header crest size, in rem (square). */
  crestSize: number;
  /** Gap between the name block and the rank/points numerals, in rem. */
  headerGap: number;
  /** Rank/points numeral font size, in rem. */
  rankPtsSize: number;
  /** Pitch marker circle radius, in SVG units (viewBox is 380×560). */
  markerRadius: number;
  /** Pitch marker name-label font size, in SVG units. */
  markerFontSize: number;
  /** Pitch fill color. */
  pitchFill: string;
  /** Shared row "constant" — stat lists, "who predicted this team", and
   *  match-row crests all read from these same five values. */
  rowAvatar: number;
  rowPy: number;
  rowGap: number;
  fsName: number;
  fsValue: number;
  /** Match-row height, in rem. */
  matchRowHeight: number;
}

// Tuned live via TeamPopupTuner.tsx and pasted back in — see that file's
// "Copy values" export.
export const DEFAULT_TEAM_POPUP_TUNING: TeamPopupTuning = {
  col1: 2.2,
  col2: 1.65,
  col3: 1.45,
  gridGap: 1.4,
  crestSize: 4.7,
  headerGap: 3.8,
  rankPtsSize: 2.3,
  markerRadius: 22,
  markerFontSize: 15,
  pitchFill: "var(--color_pitch)",
  rowAvatar: 1.9,
  rowPy: 0.281,
  rowGap: 0.76,
  fsName: 0.8,
  fsValue: 0.92,
  matchRowHeight: 5.3,
};
