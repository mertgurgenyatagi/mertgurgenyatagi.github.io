import { useEffect, useState } from "react";

interface IrregularCounterOptions {
  /** Injectable for tests — defaults to Math.random. */
  random?: () => number;
}

// Skewed toward short gaps with an occasional long pause (random() twice,
// multiplied, biases toward zero) — averages to roughly 0.75 ticks/sec while
// reading as "extremely irregular" rather than a metronome (Mert's spec).
function nextDelayMs(random: () => number): number {
  return 120 + random() * random() * 4850;
}

function nextStep(random: () => number): number {
  const r = random();
  if (r < 0.7) return 1;
  if (r < 0.9) return 2;
  return 3;
}

/**
 * A "slot machine" counter for the hero headline's live-feeling participant
 * count: climbs irregularly from `base`, and once it would pass 1.5x `base`,
 * snaps back to `base` and starts over — a perpetual, restless loop rather
 * than an accurate live readout (the real count is `base` itself; this is
 * decoration on top of it, not a second data source).
 */
export function useIrregularCounter(base: number, options: IrregularCounterOptions = {}): number {
  const random = options.random ?? Math.random;
  const [value, setValue] = useState(base);

  useEffect(() => {
    setValue(base);
    if (base <= 0) return;

    const ceiling = Math.round(base * 1.5);
    let current = base;
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    function tick() {
      current = current >= ceiling ? base : current + nextStep(random);
      setValue(current);
      if (!cancelled) {
        timeoutId = setTimeout(tick, nextDelayMs(random));
      }
    }

    timeoutId = setTimeout(tick, nextDelayMs(random));
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
    // Deliberately keyed on `base` alone — `random` is only ever swapped in
    // tests (a stable reference there), and re-keying on it in production
    // would restart the climb on every render for no reason.
  }, [base]);

  return value;
}
