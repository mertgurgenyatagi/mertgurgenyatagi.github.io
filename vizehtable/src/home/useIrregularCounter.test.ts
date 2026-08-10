import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useIrregularCounter } from "./useIrregularCounter";

// random() = 0 makes both the delay (120 + 0*0*2200 = 120ms) and the step
// (r < 0.7 branch = +1) fully deterministic.
const zero = () => 0;

describe("useIrregularCounter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts at the base value", () => {
    const { result } = renderHook(() => useIrregularCounter(10, { random: zero }));
    expect(result.current).toBe(10);
  });

  it("climbs by whole steps over time", () => {
    const { result } = renderHook(() => useIrregularCounter(10, { random: zero }));
    act(() => {
      vi.advanceTimersByTime(120);
    });
    expect(result.current).toBe(11);
    act(() => {
      vi.advanceTimersByTime(120);
    });
    expect(result.current).toBe(12);
  });

  it("rolls back to base once it reaches 1.5x base", () => {
    const { result } = renderHook(() => useIrregularCounter(10, { random: zero }));
    // ceiling = round(10 * 1.5) = 15 — five +1 ticks from 10 reaches it.
    act(() => {
      vi.advanceTimersByTime(120 * 5);
    });
    expect(result.current).toBe(15);

    act(() => {
      vi.advanceTimersByTime(120);
    });
    expect(result.current).toBe(10);
  });

  it("does nothing when base is 0", () => {
    const { result } = renderHook(() => useIrregularCounter(0, { random: zero }));
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current).toBe(0);
  });

  it("resets immediately if base changes", () => {
    const { result, rerender } = renderHook(({ base }) => useIrregularCounter(base, { random: zero }), {
      initialProps: { base: 10 },
    });
    act(() => {
      vi.advanceTimersByTime(120 * 2);
    });
    expect(result.current).toBe(12);

    rerender({ base: 20 });
    expect(result.current).toBe(20);
  });
});
