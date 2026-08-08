import { act, renderHook } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { useBoundaryHover } from "./useBoundaryHover";

describe("useBoundaryHover", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts with nothing active", () => {
    const { result } = renderHook(() => useBoundaryHover());
    expect(result.current.activeIndex).toBeNull();
  });

  it("does not activate before the dwell time passes", () => {
    const { result } = renderHook(() => useBoundaryHover());
    act(() => result.current.handleMouseEnter(5));
    act(() => vi.advanceTimersByTime(1999));
    expect(result.current.activeIndex).toBeNull();
  });

  it("activates once the dwell time passes", () => {
    const { result } = renderHook(() => useBoundaryHover());
    act(() => result.current.handleMouseEnter(5));
    act(() => vi.advanceTimersByTime(2000));
    expect(result.current.activeIndex).toBe(5);
  });

  it("clears immediately on mouse leave, even mid-dwell", () => {
    const { result } = renderHook(() => useBoundaryHover());
    act(() => result.current.handleMouseEnter(5));
    act(() => vi.advanceTimersByTime(1000));
    act(() => result.current.handleMouseLeave());
    act(() => vi.advanceTimersByTime(2000));
    expect(result.current.activeIndex).toBeNull();
  });

  it("restarts the dwell timer when moving to a different row before it fires", () => {
    const { result } = renderHook(() => useBoundaryHover());
    act(() => result.current.handleMouseEnter(5));
    act(() => vi.advanceTimersByTime(1500));
    act(() => result.current.handleMouseEnter(6));
    act(() => vi.advanceTimersByTime(1500));
    expect(result.current.activeIndex).toBeNull();
    act(() => vi.advanceTimersByTime(500));
    expect(result.current.activeIndex).toBe(6);
  });
});
