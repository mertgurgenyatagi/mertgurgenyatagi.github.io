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

  // Derive readiness from settled set or fallback timeout
  const allSettled = urls.every((url) => settled.has(url));

  // The effect only ever needs to re-run when the *set* of urls changes.
  const key = urls.join("|");
  const keyRef = useRef(key);
  keyRef.current = key;

  useEffect(() => {
    if (allSettled) return;
    let cancelled = false;
    const pending = urls.filter((url) => !settled.has(url));
    if (pending.length === 0) return;

    // Safety timeout: if images take more than 400ms to load/fail, unblock render anyway
    const timer = setTimeout(() => {
      if (!cancelled) {
        pending.forEach((url) => settled.add(url));
        bump();
      }
    }, 400);

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
      clearTimeout(timer);
      if (!cancelled && keyRef.current === key) bump();
    });

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, allSettled]);

  return allSettled;
}
