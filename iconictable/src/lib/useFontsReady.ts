import { useEffect, useState } from "react";

/**
 * The standard signal for "the page's web font has actually finished
 * loading" — used to gate first paint sitewide (via ProfileGate) so no page
 * ever renders in a fallback font and then visibly snaps to the real one.
 * Returns `true` synchronously in any environment without `document.fonts`
 * (jsdom in tests included), so no test-only mocking is needed for it.
 */
export function useFontsReady(): boolean {
  const [ready, setReady] = useState(
    () => typeof document === "undefined" || !("fonts" in document) || document.fonts.status === "loaded"
  );
  useEffect(() => {
    if (ready || typeof document === "undefined" || !("fonts" in document)) return;
    let cancelled = false;
    document.fonts.ready.then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [ready]);
  return ready;
}
