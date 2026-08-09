import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useIsMobile } from "./useIsMobile";

/**
 * The breakpoint hook that decides which component tree the whole app runs.
 *
 * The first assertion is the one that matters most: **the very first render
 * already knows the width.** The obvious `useState` + `useEffect` version
 * reports desktop on the first render and corrects itself a frame later,
 * which on a phone means painting the entire desktop tree once before
 * replacing it. That is the same render-ordering bug `useImagePreload`
 * shipped and sat on for three days (HANDOVER.md, 2026-08-06), and it is
 * invisible to a test that only checks the settled value.
 */

const listeners = new Set<() => void>();

function stubMatchMedia(matches: boolean) {
  listeners.clear();
  window.matchMedia = ((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

const originalMatchMedia = window.matchMedia;
afterEach(() => {
  window.matchMedia = originalMatchMedia;
  listeners.clear();
  vi.restoreAllMocks();
});

describe("useIsMobile", () => {
  it("reports the real width on the very first render, with no correcting pass", () => {
    stubMatchMedia(true);
    const renders: boolean[] = [];
    renderHook(() => {
      const value = useIsMobile();
      renders.push(value);
      return value;
    });
    // Not just "ends up true" — never observed false at any point.
    expect(renders[0]).toBe(true);
    expect(renders).not.toContain(false);
  });

  it("reports false above the breakpoint", () => {
    stubMatchMedia(false);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it("subscribes to the media query and updates when it changes", () => {
    let matches = false;
    listeners.clear();
    window.matchMedia = ((query: string) => ({
      get matches() {
        return matches;
      },
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: (_: string, fn: () => void) => listeners.add(fn),
      removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    act(() => {
      matches = true;
      listeners.forEach((fn) => fn());
    });
    expect(result.current).toBe(true);
  });

  it("unsubscribes on unmount", () => {
    stubMatchMedia(true);
    const { unmount } = renderHook(() => useIsMobile());
    expect(listeners.size).toBeGreaterThan(0);
    unmount();
    expect(listeners.size).toBe(0);
  });

  // test/setup.ts's polyfill has no addEventListener at all. Every one of the
  // suite's other ~930 tests relies on this path returning false so they keep
  // exercising the desktop tree unchanged.
  it("falls back to desktop when matchMedia has no listener support", () => {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });
});
