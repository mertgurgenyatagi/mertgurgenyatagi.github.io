import { useEffect, type ReactNode } from "react";

/** Wraps a step that dismisses itself on a timer rather than a click — the
 *  welcome message and both bounce-checkmark moments. */
export function AutoAdvance({
  delayMs,
  onDone,
  children,
}: {
  delayMs: number;
  onDone: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const id = setTimeout(onDone, delayMs);
    return () => clearTimeout(id);
    // Keyed on delayMs alone — onDone is a fresh closure every render in the
    // callers below, and re-keying on it would restart the timer each time.
  }, [delayMs]);

  return <>{children}</>;
}
