import { useCallback, useRef, useState } from "react";

// A deliberate dwell, not an instant hover — round-02 Q9: firing immediately
// would flash constantly as a cursor just passes over rows on its way
// somewhere else.
const HOVER_DELAY_MS = 2000;

/** Tracks which row (if any) has been hovered long enough to light up its
 *  scoring boundary — shared by TeamRanker (ranking) and RankingList (the
 *  locked view), since round-02 Q14 wants it in both places. */
export function useBoundaryHover() {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stable identities so the 36 memoized slot/row components that take these
  // as props aren't invalidated on every parent render.
  const handleMouseEnter = useCallback((index: number) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setActiveIndex(index), HOVER_DELAY_MS);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setActiveIndex(null);
  }, []);

  return { activeIndex, handleMouseEnter, handleMouseLeave };
}
