import { useSyncExternalStore } from "react";

/**
 * The one breakpoint that decides which component tree a page renders.
 *
 * 1024px is not an arbitrary pick: it is the exact boundary
 * `src/styles/index.css` already uses to switch the app between its two
 * layout models — at and above it, `html/body/#root` are pinned to
 * `height:100%; overflow:hidden` and every region owns an internal scroll
 * container; below it, the document scrolls normally. Reusing the same line
 * here means there is never a width at which a fixed-viewport desktop
 * composition renders inside a scrolling document, which is what happens
 * today and is most of why the current sub-1024 experience is bad.
 *
 * `useSyncExternalStore` rather than `useState` + an effect, deliberately.
 * The effect version reads the *previous* value on the render where it
 * matters most (the first one), paints the wrong tree, and corrects itself a
 * frame later — precisely the bug class `useImagePreload` shipped and sat on
 * for three days (HANDOVER.md, 2026-08-06). Subscribing to the media query
 * means the very first render already knows the width.
 *
 * There is no SSR here (pure SPA on HashRouter), so a layout read during
 * render is safe and needs no hydration-mismatch dance.
 */

const MOBILE_QUERY = "(max-width: 1023px)";

function subscribe(onChange: () => void): () => void {
  // jsdom's polyfilled matchMedia (test/setup.ts) has no real listener
  // support; guard so tests get the static `false` snapshot rather than a
  // crash. Every existing test therefore keeps exercising the desktop tree.
  const mql = window.matchMedia?.(MOBILE_QUERY);
  if (!mql?.addEventListener) return () => {};
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

function getSnapshot(): boolean {
  return window.matchMedia?.(MOBILE_QUERY).matches ?? false;
}

export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
