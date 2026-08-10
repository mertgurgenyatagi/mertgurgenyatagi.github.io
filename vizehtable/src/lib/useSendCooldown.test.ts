import { act, renderHook } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { useSendCooldown } from "./useSendCooldown";

describe("useSendCooldown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts not cooling down", () => {
    const { result } = renderHook(() => useSendCooldown(1000));
    expect(result.current.isCoolingDown).toBe(false);
  });

  it("is cooling down immediately after trigger", () => {
    const { result } = renderHook(() => useSendCooldown(1000));
    act(() => result.current.trigger());
    expect(result.current.isCoolingDown).toBe(true);
  });

  it("stops cooling down once the duration elapses", () => {
    const { result } = renderHook(() => useSendCooldown(1000));
    act(() => result.current.trigger());
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.isCoolingDown).toBe(false);
  });

  it("restarts the cooldown window if triggered again mid-cooldown", () => {
    const { result } = renderHook(() => useSendCooldown(1000));
    act(() => result.current.trigger());
    act(() => vi.advanceTimersByTime(700));
    act(() => result.current.trigger());
    act(() => vi.advanceTimersByTime(700));
    expect(result.current.isCoolingDown).toBe(true);
    act(() => vi.advanceTimersByTime(300));
    expect(result.current.isCoolingDown).toBe(false);
  });
});
