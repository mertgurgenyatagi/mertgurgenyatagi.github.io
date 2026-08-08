import { useEffect, useState } from "react";
import { countdownTo, type Countdown } from "@/data/deadlines";

/**
 * Ticking countdown to a fixed instant.
 *
 * One interval per mounted countdown, cleared on unmount. Stops ticking once
 * the target has passed rather than running a timer forever for a display
 * that can no longer change.
 */
export function useCountdown(target: number): Countdown {
  const [value, setValue] = useState(() => countdownTo(target));

  useEffect(() => {
    if (value.expired) return;
    const id = window.setInterval(() => setValue(countdownTo(target)), 1000);
    return () => window.clearInterval(id);
  }, [target, value.expired]);

  return value;
}
