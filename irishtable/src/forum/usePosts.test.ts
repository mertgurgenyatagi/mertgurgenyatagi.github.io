// src/forum/usePosts.test.ts
import { act, renderHook, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { clearSessionCache } from "../lib/sessionCache";

const mockOnSnapshot = vi.fn();
const mockGetDocs = vi.fn();
const mockGetDoc = vi.fn();
const mockCollection = vi.fn((_db: unknown, name: string) => ({ name }));
const mockDoc = vi.fn((_db: unknown, collectionName: string, id: string) => ({ collectionName, id }));
const mockQuery = vi.fn((...args: unknown[]) => ({ constraints: args.slice(1) }));
const mockOrderBy = vi.fn((field: string, direction?: string) => ({ type: "orderBy", field, direction }));
const mockLimit = vi.fn((n: number) => ({ type: "limit", n }));
const mockStartAfter = vi.fn((value: unknown) => ({ type: "startAfter", value }));
const mockUnsubscribe = vi.fn();

vi.mock("firebase/firestore", () => ({
  collection: (...args: unknown[]) => mockCollection(...(args as [unknown, string])),
  doc: (...args: unknown[]) => mockDoc(...(args as [unknown, string, string])),
  query: (...args: unknown[]) => mockQuery(...args),
  orderBy: (...args: unknown[]) => mockOrderBy(...(args as [string, string?])),
  limit: (...args: unknown[]) => mockLimit(...(args as [number])),
  startAfter: (...args: unknown[]) => mockStartAfter(...(args as [unknown])),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
}));

vi.mock("../firebase", () => ({ db: {} }));

import { usePosts } from "./usePosts";

type SnapshotCallback = (snapshot: {
  docs: { id: string; data: () => unknown }[];
  metadata?: { fromCache: boolean };
}) => void;
type ErrorCallback = (err: Error) => void;

function postDoc(
  id: string,
  fields: Partial<{ uid: string; text: string; imageURL: string | null; parentId: string | null; createdAt: number }> = {}
) {
  return {
    id,
    data: () => ({
      uid: "uid1",
      text: "Merhaba",
      imageURL: null,
      parentId: null,
      createdAt: 100,
      ...fields,
    }),
  };
}

describe("usePosts", () => {
  let capturedOnNext: SnapshotCallback;
  let capturedOnError: ErrorCallback;

  beforeEach(() => {
    mockOnSnapshot.mockReset();
    mockGetDocs.mockReset();
    mockGetDoc.mockReset();
    mockUnsubscribe.mockReset();
    mockQuery.mockClear();
    mockOrderBy.mockClear();
    mockLimit.mockClear();
    mockStartAfter.mockClear();
    mockDoc.mockClear();
    clearSessionCache();
    mockOnSnapshot.mockImplementation((_query: unknown, onNext: SnapshotCallback, onError: ErrorCallback) => {
      capturedOnNext = onNext;
      capturedOnError = onError;
      return mockUnsubscribe;
    });
  });

  it("returns an empty list before any posts exist", async () => {
    const { result } = renderHook(() => usePosts());
    act(() => capturedOnNext({ docs: [] }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.posts).toEqual([]);
  });

  it("queries the most recent page, newest first", () => {
    renderHook(() => usePosts());
    expect(mockOrderBy).toHaveBeenCalledWith("createdAt", "desc");
    expect(mockLimit).toHaveBeenCalledWith(50);
  });

  it("maps each doc to a PostWithId", async () => {
    const { result } = renderHook(() => usePosts());
    act(() => capturedOnNext({ docs: [postDoc("post1", { createdAt: 100 })] }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.posts).toEqual([
      { id: "post1", uid: "uid1", text: "Merhaba", imageURL: null, parentId: null, createdAt: 100 },
    ]);
  });

  it("stops loading and leaves posts empty when the listener errors", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { result } = renderHook(() => usePosts());
    act(() => capturedOnError(new Error("permission-denied")));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.posts).toEqual([]);
    expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to load forum posts", expect.any(Error));
    consoleErrorSpy.mockRestore();
  });

  it("updates live when a new post arrives on a later snapshot, no refetch needed", async () => {
    const { result } = renderHook(() => usePosts());
    act(() => capturedOnNext({ docs: [] }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => capturedOnNext({ docs: [postDoc("post1", { text: "Yeni", createdAt: 200 })] }));
    await waitFor(() => expect(result.current.posts).toHaveLength(1));
  });

  it("unsubscribes the live listener on unmount", () => {
    const { unmount } = renderHook(() => usePosts());
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it("ignores a from-cache snapshot as the very first result, waiting for the server-confirmed one before reporting loaded", async () => {
    const { result } = renderHook(() => usePosts());

    act(() => capturedOnNext({ docs: [postDoc("post1")], metadata: { fromCache: true } }));
    expect(result.current.loading).toBe(true);
    expect(result.current.posts).toEqual([]);

    act(() => capturedOnNext({ docs: [postDoc("post1")], metadata: { fromCache: false } }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.posts).toHaveLength(1);
  });

  it("assumes there's more history when a full page comes back", async () => {
    const { result } = renderHook(() => usePosts());
    const fullPage = Array.from({ length: 50 }, (_, i) => postDoc(`p${i}`, { createdAt: i }));
    act(() => capturedOnNext({ docs: fullPage }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.hasMore).toBe(true);
  });

  it("knows there's nothing older once a snapshot comes back short of a full page", async () => {
    const { result } = renderHook(() => usePosts());
    act(() => capturedOnNext({ docs: [postDoc("only")] }));
    await waitFor(() => expect(result.current.hasMore).toBe(false));
  });

  describe("backfilling an out-of-window root", () => {
    it("fetches a reply's root post by id when the root isn't in the loaded window", async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: "root1",
        data: () => ({ uid: "uid1", text: "Root", imageURL: null, parentId: null, createdAt: 1 }),
      });
      const { result } = renderHook(() => usePosts());
      act(() => capturedOnNext({ docs: [postDoc("reply1", { parentId: "root1", createdAt: 500 })] }));

      await waitFor(() => expect(result.current.posts.some((p) => p.id === "root1")).toBe(true));
      expect(mockGetDoc).toHaveBeenCalledWith({ collectionName: "forumPosts", id: "root1" });
      expect(result.current.posts).toHaveLength(2);
    });

    it("does not fetch a root that's already in the loaded window", async () => {
      const { result } = renderHook(() => usePosts());
      act(() =>
        capturedOnNext({
          docs: [postDoc("root1", { parentId: null, createdAt: 1 }), postDoc("reply1", { parentId: "root1", createdAt: 500 })],
        })
      );
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(mockGetDoc).not.toHaveBeenCalled();
    });

    it("silently drops a backfill for a root that no longer exists", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mockGetDoc.mockResolvedValue({ exists: () => false });
      const { result } = renderHook(() => usePosts());
      act(() => capturedOnNext({ docs: [postDoc("reply1", { parentId: "deletedRoot", createdAt: 500 })] }));

      await waitFor(() => expect(result.current.loading).toBe(false));
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(result.current.posts).toHaveLength(1);
      consoleErrorSpy.mockRestore();
    });
  });

  describe("loadOlder", () => {
    async function setupWithFullPage() {
      const { result } = renderHook(() => usePosts());
      const fullPage = Array.from({ length: 50 }, (_, i) => postDoc(`p${i}`, { createdAt: (i + 1) * 10 }));
      act(() => capturedOnNext({ docs: fullPage }));
      await waitFor(() => expect(result.current.loading).toBe(false));
      return result;
    }

    it("fetches the next page before the oldest currently-loaded post", async () => {
      const result = await setupWithFullPage();
      mockGetDocs.mockResolvedValue({ docs: [postDoc("older1", { createdAt: 5 })] });

      await act(async () => {
        await result.current.loadOlder();
      });

      expect(mockStartAfter).toHaveBeenCalledWith(10);
      expect(result.current.posts.some((p) => p.id === "older1")).toBe(true);
    });

    it("marks hasMore false once an older page comes back short", async () => {
      const result = await setupWithFullPage();
      mockGetDocs.mockResolvedValue({ docs: [postDoc("older1", { createdAt: 5 })] });

      await act(async () => {
        await result.current.loadOlder();
      });

      expect(result.current.hasMore).toBe(false);
    });

    it("does nothing once hasMore is false", async () => {
      const { result } = renderHook(() => usePosts());
      act(() => capturedOnNext({ docs: [postDoc("only")] }));
      await waitFor(() => expect(result.current.hasMore).toBe(false));

      await act(async () => {
        await result.current.loadOlder();
      });
      expect(mockGetDocs).not.toHaveBeenCalled();
    });

    it("logs and leaves posts unchanged when the older-page fetch fails", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const result = await setupWithFullPage();
      const before = result.current.posts.length;
      mockGetDocs.mockRejectedValue(new Error("offline"));

      await act(async () => {
        await result.current.loadOlder();
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to load older forum posts", expect.any(Error));
      expect(result.current.posts).toHaveLength(before);
      consoleErrorSpy.mockRestore();
    });
  });
});
