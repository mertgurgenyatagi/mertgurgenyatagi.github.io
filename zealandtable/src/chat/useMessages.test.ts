import { act, renderHook, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { clearSessionCache } from "../lib/sessionCache";

const mockOnSnapshot = vi.fn();
const mockGetDocs = vi.fn();
const mockCollection = vi.fn((_db: unknown, name: string) => ({ name }));
const mockQuery = vi.fn((...args: unknown[]) => ({ constraints: args.slice(1) }));
const mockOrderBy = vi.fn((field: string, direction?: string) => ({ type: "orderBy", field, direction }));
const mockLimit = vi.fn((n: number) => ({ type: "limit", n }));
const mockStartAfter = vi.fn((value: unknown) => ({ type: "startAfter", value }));
const mockUnsubscribe = vi.fn();

vi.mock("firebase/firestore", () => ({
  collection: (...args: unknown[]) => mockCollection(...(args as [unknown, string])),
  query: (...args: unknown[]) => mockQuery(...args),
  orderBy: (...args: unknown[]) => mockOrderBy(...(args as [string, string?])),
  limit: (...args: unknown[]) => mockLimit(...(args as [number])),
  startAfter: (...args: unknown[]) => mockStartAfter(...(args as [unknown])),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
}));

vi.mock("../firebase", () => ({ db: {} }));

import { useMessages } from "./useMessages";

type SnapshotCallback = (snapshot: {
  docs: { id: string; data: () => unknown }[];
  metadata?: { fromCache: boolean };
}) => void;
type ErrorCallback = (err: Error) => void;

function doc(id: string, uid: string, text: string, createdAt: number) {
  return { id, data: () => ({ uid, text, createdAt }) };
}

describe("useMessages", () => {
  let capturedOnNext: SnapshotCallback;
  let capturedOnError: ErrorCallback;

  beforeEach(() => {
    mockOnSnapshot.mockReset();
    mockGetDocs.mockReset();
    mockUnsubscribe.mockReset();
    mockQuery.mockClear();
    mockOrderBy.mockClear();
    mockLimit.mockClear();
    mockStartAfter.mockClear();
    clearSessionCache();
    mockOnSnapshot.mockImplementation((_query: unknown, onNext: SnapshotCallback, onError: ErrorCallback) => {
      capturedOnNext = onNext;
      capturedOnError = onError;
      return mockUnsubscribe;
    });
  });

  it("starts with loading=true and an empty message list", () => {
    const { result } = renderHook(() => useMessages());
    expect(result.current.loading).toBe(true);
    expect(result.current.messages).toEqual([]);
  });

  it("queries the most recent page, newest first, then reverses to chronological order", async () => {
    const { result } = renderHook(() => useMessages());
    expect(mockOrderBy).toHaveBeenCalledWith("createdAt", "desc");
    expect(mockLimit).toHaveBeenCalledWith(50);

    act(() => {
      capturedOnNext({
        docs: [doc("newest", "uid1", "b", 200), doc("oldest", "uid1", "a", 100)],
      });
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.messages.map((m) => m.id)).toEqual(["oldest", "newest"]);
  });

  it("assumes there's more history when a full page comes back", async () => {
    const { result } = renderHook(() => useMessages());
    const fullPage = Array.from({ length: 50 }, (_, i) => doc(`m${i}`, "uid1", "x", i));
    act(() => capturedOnNext({ docs: fullPage }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.hasMoreOlder).toBe(true);
  });

  it("knows there's nothing older once a snapshot comes back short of a full page", async () => {
    const { result } = renderHook(() => useMessages());
    act(() => capturedOnNext({ docs: [doc("only", "uid1", "x", 100)] }));
    await waitFor(() => expect(result.current.hasMoreOlder).toBe(false));
  });

  it("stops loading and keeps prior messages when the live listener errors", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { result } = renderHook(() => useMessages());
    act(() => capturedOnNext({ docs: [doc("m1", "uid1", "first", 100)] }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => capturedOnError(new Error("listener failed")));
    await waitFor(() => expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to load messages", expect.any(Error)));
    expect(result.current.messages).toHaveLength(1);
    consoleErrorSpy.mockRestore();
  });

  it("unsubscribes the live listener on unmount", () => {
    const { unmount } = renderHook(() => useMessages());
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it("ignores a from-cache snapshot as the very first result, waiting for the server-confirmed one before reporting loaded", async () => {
    const { result } = renderHook(() => useMessages());

    act(() => capturedOnNext({ docs: [doc("m1", "uid1", "a", 100)], metadata: { fromCache: true } }));
    expect(result.current.loading).toBe(true);
    expect(result.current.messages).toEqual([]);

    act(() => capturedOnNext({ docs: [doc("m1", "uid1", "a", 100)], metadata: { fromCache: false } }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.messages).toHaveLength(1);
  });

  describe("loadOlder", () => {
    async function setupWithFullPage() {
      const { result } = renderHook(() => useMessages());
      const fullPage = Array.from({ length: 50 }, (_, i) => doc(`m${i}`, "uid1", "x", (i + 1) * 10));
      act(() => capturedOnNext({ docs: [...fullPage].reverse() }));
      await waitFor(() => expect(result.current.loading).toBe(false));
      return result;
    }

    it("fetches the next page before the oldest currently-loaded message", async () => {
      const result = await setupWithFullPage();
      mockGetDocs.mockResolvedValue({ docs: [doc("older1", "uid1", "y", 5)] });

      await act(async () => {
        await result.current.loadOlder();
      });

      expect(mockStartAfter).toHaveBeenCalledWith(10);
      expect(result.current.messages[0].id).toBe("older1");
    });

    it("prepends older messages ahead of what was already loaded", async () => {
      const result = await setupWithFullPage();
      mockGetDocs.mockResolvedValue({
        docs: [doc("older2", "uid1", "y", 8), doc("older1", "uid1", "y", 5)],
      });

      await act(async () => {
        await result.current.loadOlder();
      });

      expect(result.current.messages.slice(0, 2).map((m) => m.id)).toEqual(["older1", "older2"]);
    });

    it("marks hasMoreOlder false once an older page comes back short", async () => {
      const result = await setupWithFullPage();
      mockGetDocs.mockResolvedValue({ docs: [doc("older1", "uid1", "y", 5)] });

      await act(async () => {
        await result.current.loadOlder();
      });

      expect(result.current.hasMoreOlder).toBe(false);
    });

    it("does nothing once hasMoreOlder is false", async () => {
      const { result } = renderHook(() => useMessages());
      act(() => capturedOnNext({ docs: [doc("only", "uid1", "x", 100)] }));
      await waitFor(() => expect(result.current.hasMoreOlder).toBe(false));

      await act(async () => {
        await result.current.loadOlder();
      });
      expect(mockGetDocs).not.toHaveBeenCalled();
    });

    it("logs and leaves messages unchanged when the older-page fetch fails", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const result = await setupWithFullPage();
      const before = result.current.messages.length;
      mockGetDocs.mockRejectedValue(new Error("offline"));

      await act(async () => {
        await result.current.loadOlder();
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to load older messages", expect.any(Error));
      expect(result.current.messages).toHaveLength(before);
      consoleErrorSpy.mockRestore();
    });
  });
});
