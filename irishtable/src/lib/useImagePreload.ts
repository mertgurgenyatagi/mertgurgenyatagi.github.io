import { useEffect, useReducer, useRef } from "react";

// Shared by every page/popup that gates its reveal on images being ready —
// originally private to HeroCarousel.tsx. Resolves each url via a detached
// Image(); both onload and onerror count as "settled" so one broken image
// (404, network failure) can never hang a page's reveal forever — it just
// falls through to that component's own fallback (e.g. AvatarFallback's
// shield/initials) once the page reveals. See
// docs/superpowers/specs/2026-08-03-sitewide-image-preload-gate-design.md.
//
// Settled urls are remembered process-wide, not per hook instance. Every
// image this app preloads is served from an immutable, timestamped path
// (storage.rules / compressImage.ts) or a static build asset, so "this url
// has loaded once" stays true for the life of the tab. Without this, every
// route change and every popup open re-ran the whole gate and re-showed a
// skeleton for images already sitting in the browser's cache — which is most
// of what made reopening a popup feel slow.
const settled = new Set<string>();

/** Test-only escape hatch — the module-level cache would otherwise leak
 *  between test cases in the same file. */
export function __resetImagePreloadCache() {
  settled.clear();
}

export function useImagePreload(urls: string[]): boolean {
  const [, bump] = useReducer((n: number) => n + 1, 0);

  // Derived during render, not stored in state and assigned from an effect.
  // The old version kept `ready` in state and only flipped it inside the
  // effect, so the render where `urls` first became non-empty (data having
  // just arrived) still saw the previous `ready === true` and painted
  // ungated content for a frame before the effect pulled it back to a
  // skeleton. That flash was the whole bug.
  const ready = urls.every((url) => settled.has(url));

  // The effect only ever needs to re-run when the *set* of urls changes.
  const key = urls.join("|");
  const keyRef = useRef(key);
  keyRef.current = key;

  useEffect(() => {
    if (ready) return;
    let cancelled = false;
    const pending = urls.filter((url) => !settled.has(url));
    if (pending.length === 0) return;

    Promise.all(
      pending.map(
        (url) =>
          new Promise<void>((resolve) => {
            const img = new Image();
            const done = () => {
              settled.add(url);
              resolve();
            };
            img.onload = done;
            img.onerror = done;
            img.src = url;
          })
      )
    ).then(() => {
      // Re-render so the derived `ready` above is recomputed. Guarded against
      // both unmount and the url set having moved on mid-flight.
      if (!cancelled && keyRef.current === key) bump();
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ready]);

  return ready;
}
