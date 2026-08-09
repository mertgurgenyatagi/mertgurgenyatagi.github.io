import { act, renderHook } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

const mockRef = vi.fn((_db: unknown, path: string) => ({ path }));
const mockSet = vi.fn();
const mockRemove = vi.fn();
const mockOnDisconnectRemove = vi.fn();
const mockOnDisconnect = vi.fn((_ref: unknown) => ({ remove: mockOnDisconnectRemove }));
const mockOnValue = vi.fn();
const mockUnsubscribe = vi.fn();

vi.mock("firebase/database", () => ({
  ref: (...args: unknown[]) => mockRef(...(args as [unknown, string])),
  set: (...args: unknown[]) => mockSet(...args),
  remove: (...args: unknown[]) => mockRemove(...args),
  onDisconnect: (...args: unknown[]) => mockOnDisconnect(...(args as [unknown])),
  onValue: (...args: unknown[]) => mockOnValue(...args),
}));

vi.mock("../firebase", () => ({ rtdb: {} }));

import { setTypingStatus, useTypingUsers } from "./useTypingStatus";

type TypingCallback = (snapshot: { val: () => unknown }) => void;
type ErrorCallback = (err: Error) => void;

describe("setTypingStatus", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockSet.mockReset().mockResolvedValue(undefined);
    mockRemove.mockReset().mockResolvedValue(undefined);
    mockOnDisconnect.mockClear();
    mockOnDisconnectRemove.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("writes an updatedAt timestamp when typing starts", async () => {
    await setTypingStatus("uid-a", true);
    expect(mockRef).toHaveBeenCalledWith({}, "typingStatus/uid-a");
    const [, written] = mockSet.mock.calls[0];
    expect(typeof written.updatedAt).toBe("number");
  });

  it("registers a server-side cleanup for when the connection drops mid-typing", async () => {
    await setTypingStatus("uid-b", true);
    expect(mockOnDisconnect).toHaveBeenCalledWith({ path: "typingStatus/uid-b" });
    expect(mockOnDisconnectRemove).toHaveBeenCalledTimes(1);
  });

  it("removes the node when typing stops", async () => {
    await setTypingStatus("uid-c", false);
    expect(mockRemove).toHaveBeenCalledWith({ path: "typingStatus/uid-c" });
    expect(mockSet).not.toHaveBeenCalled();
  });

  it("throttles repeated writes for the same uid to no more than one per second (scaling-audit No. 12)", async () => {
    await setTypingStatus("uid-d", true);
    expect(mockSet).toHaveBeenCalledTimes(1);

    await setTypingStatus("uid-d", true);
    expect(mockSet).toHaveBeenCalledTimes(1);

    vi.setSystemTime(Date.now() + 1000);
    await setTypingStatus("uid-d", true);
    expect(mockSet).toHaveBeenCalledTimes(2);
  });

  it("does not throttle across different uids", async () => {
    await setTypingStatus("uid-e", true);
    await setTypingStatus("uid-f", true);
    expect(mockSet).toHaveBeenCalledTimes(2);
  });

  it("always lets a stop-typing call through immediately, even right after a start", async () => {
    await setTypingStatus("uid-g", true);
    await setTypingStatus("uid-g", false);
    expect(mockRemove).toHaveBeenCalledWith({ path: "typingStatus/uid-g" });
  });
});

describe("useTypingUsers", () => {
  let capturedOnNext: TypingCallback;
  let capturedOnError: ErrorCallback;

  beforeEach(() => {
    vi.useFakeTimers();
    mockOnValue.mockReset();
    mockUnsubscribe.mockReset();
    mockOnValue.mockImplementation((_ref: unknown, onNext: TypingCallback, onError: ErrorCallback) => {
      capturedOnNext = onNext;
      capturedOnError = onError;
      return mockUnsubscribe;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts empty", () => {
    const { result } = renderHook(() => useTypingUsers("me"));
    expect(result.current).toEqual([]);
  });

  it("excludes the current user from the typing list", () => {
    const { result } = renderHook(() => useTypingUsers("me"));
    act(() => {
      capturedOnNext({ val: () => ({ me: { updatedAt: Date.now() }, other: { updatedAt: Date.now() } }) });
    });
    expect(result.current).toEqual(["other"]);
  });

  it("returns nothing when the node is empty", () => {
    const { result } = renderHook(() => useTypingUsers("me"));
    act(() => capturedOnNext({ val: () => null }));
    expect(result.current).toEqual([]);
  });

  it("ages out a typing signal once it goes stale", () => {
    const { result } = renderHook(() => useTypingUsers("me"));
    const start = Date.now();
    act(() => {
      capturedOnNext({ val: () => ({ other: { updatedAt: start } }) });
    });
    expect(result.current).toEqual(["other"]);

    act(() => {
      vi.setSystemTime(start + 7000);
      vi.advanceTimersByTime(7000);
    });
    expect(result.current).toEqual([]);
  });

  it("logs and stays empty when the listener errors", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { result } = renderHook(() => useTypingUsers("me"));
    act(() => capturedOnError(new Error("permission-denied")));
    expect(result.current).toEqual([]);
    expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to load typing status", expect.any(Error));
    consoleErrorSpy.mockRestore();
  });

  it("unsubscribes on unmount", () => {
    const { unmount } = renderHook(() => useTypingUsers("me"));
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });
});
