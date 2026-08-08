import { act, renderHook } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";

const mockRef = vi.fn((_db: unknown, path: string) => ({ path }));
const mockOnValue = vi.fn();
const mockSet = vi.fn();
const mockRemove = vi.fn();
const mockOnDisconnectRemove = vi.fn();
const mockOnDisconnect = vi.fn((_ref: unknown) => ({ remove: mockOnDisconnectRemove }));
const mockUnsubscribe = vi.fn();

vi.mock("firebase/database", () => ({
  ref: (...args: unknown[]) => mockRef(...(args as [unknown, string])),
  onValue: (...args: unknown[]) => mockOnValue(...args),
  set: (...args: unknown[]) => mockSet(...args),
  remove: (...args: unknown[]) => mockRemove(...args),
  onDisconnect: (...args: unknown[]) => mockOnDisconnect(...(args as [unknown])),
}));

vi.mock("../firebase", () => ({ rtdb: {} }));

import { usePresenceHeartbeat, useOnlineCount } from "./usePresence";

type ConnectedCallback = (snapshot: { val: () => unknown }) => void;
type PresenceCallback = (snapshot: { exists: () => boolean; val: () => unknown }) => void;
type ErrorCallback = (err: Error) => void;

describe("usePresenceHeartbeat", () => {
  let capturedConnectedCallback: ConnectedCallback;

  beforeEach(() => {
    mockRef.mockClear();
    mockOnValue.mockReset();
    mockSet.mockReset().mockResolvedValue(undefined);
    mockRemove.mockReset().mockResolvedValue(undefined);
    mockOnDisconnect.mockClear();
    mockOnDisconnectRemove.mockReset().mockResolvedValue(undefined);
    mockUnsubscribe.mockReset();
    mockOnValue.mockImplementation((_ref: unknown, onNext: ConnectedCallback) => {
      capturedConnectedCallback = onNext;
      return mockUnsubscribe;
    });
  });

  it("does nothing when there's no signed-in uid", () => {
    renderHook(() => usePresenceHeartbeat(null));
    expect(mockOnValue).not.toHaveBeenCalled();
  });

  it("registers a server-side onDisconnect cleanup and sets presence once connected", async () => {
    renderHook(() => usePresenceHeartbeat("uid1"));
    expect(mockRef).toHaveBeenCalledWith({}, "presence/uid1");

    await act(async () => {
      capturedConnectedCallback({ val: () => true });
      await Promise.resolve();
    });

    expect(mockOnDisconnect).toHaveBeenCalledWith({ path: "presence/uid1" });
    expect(mockOnDisconnectRemove).toHaveBeenCalledTimes(1);
    expect(mockSet).toHaveBeenCalledWith({ path: "presence/uid1" }, true);
  });

  it("does not set presence while not yet connected", () => {
    renderHook(() => usePresenceHeartbeat("uid1"));
    capturedConnectedCallback({ val: () => false });
    expect(mockOnDisconnect).not.toHaveBeenCalled();
    expect(mockSet).not.toHaveBeenCalled();
  });

  it("removes presence and unsubscribes on unmount", () => {
    const { unmount } = renderHook(() => usePresenceHeartbeat("uid1"));
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    expect(mockRemove).toHaveBeenCalledWith({ path: "presence/uid1" });
  });
});

describe("useOnlineCount", () => {
  let capturedOnNext: PresenceCallback;
  let capturedOnError: ErrorCallback;

  beforeEach(() => {
    mockOnValue.mockReset();
    mockUnsubscribe.mockReset();
    mockOnValue.mockImplementation((_ref: unknown, onNext: PresenceCallback, onError: ErrorCallback) => {
      capturedOnNext = onNext;
      capturedOnError = onError;
      return mockUnsubscribe;
    });
  });

  it("starts at zero", () => {
    const { result } = renderHook(() => useOnlineCount());
    expect(result.current).toBe(0);
  });

  it("counts every uid present in the snapshot", () => {
    const { result } = renderHook(() => useOnlineCount());
    act(() => {
      capturedOnNext({ exists: () => true, val: () => ({ uid1: true, uid2: true }) });
    });
    expect(result.current).toBe(2);
  });

  it("returns zero when the snapshot doesn't exist (nobody online)", () => {
    const { result } = renderHook(() => useOnlineCount());
    act(() => {
      capturedOnNext({ exists: () => false, val: () => null });
    });
    expect(result.current).toBe(0);
  });

  it("logs and stays at zero when the listener errors", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { result } = renderHook(() => useOnlineCount());
    act(() => capturedOnError(new Error("permission-denied")));
    expect(result.current).toBe(0);
    expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to load presence", expect.any(Error));
    consoleErrorSpy.mockRestore();
  });

  it("unsubscribes on unmount", () => {
    const { unmount } = renderHook(() => useOnlineCount());
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });
});
