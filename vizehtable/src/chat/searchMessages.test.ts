import { vi, describe, it, expect, beforeEach } from "vitest";

const mockGetDocs = vi.fn();
const mockCollection = vi.fn((_db: unknown, ...path: string[]) => ({ path }));
const mockQuery = vi.fn((ref: unknown) => ref);
const mockOrderBy = vi.fn((field: string) => ({ field }));
const mockLimit = vi.fn((n: number) => ({ limit: n }));

vi.mock("firebase/firestore", () => ({
  collection: (...args: unknown[]) => mockCollection(...(args as [unknown, ...string[]])),
  query: (...args: unknown[]) => mockQuery(...(args as [unknown])),
  orderBy: (...args: unknown[]) => mockOrderBy(...(args as [string])),
  limit: (...args: unknown[]) => mockLimit(...(args as [number])),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
}));

vi.mock("../firebase", () => ({ db: {} }));

import { fetchRecentMessagesForSearch, searchMessages, SEARCH_WINDOW } from "./searchMessages";

function docSnap(id: string, data: Record<string, unknown>) {
  return { id, data: () => data };
}

describe("searchMessages", () => {
  beforeEach(() => {
    mockGetDocs.mockReset();
    mockCollection.mockClear();
    mockLimit.mockClear();
  });

  it("returns an empty array without querying anything for a blank term", async () => {
    const result = await searchMessages("   ");
    expect(result).toEqual([]);
    expect(mockGetDocs).not.toHaveBeenCalled();
  });

  it("matches case-insensitively on message text", async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        docSnap("m1", { uid: "u1", text: "the weather is LOVELY", createdAt: 1 }),
        docSnap("m2", { uid: "u1", text: "unrelated message", createdAt: 2 }),
      ],
    });
    const result = await searchMessages("lovely");
    expect(result.map((m) => m.id)).toEqual(["m1"]);
  });

  it("excludes deleted messages from results", async () => {
    mockGetDocs.mockResolvedValue({
      docs: [docSnap("m1", { uid: "u1", text: "secret info", createdAt: 1, deleted: true })],
    });
    const result = await searchMessages("secret");
    expect(result).toEqual([]);
  });

  it("searches the one messages collection", async () => {
    mockGetDocs.mockResolvedValue({ docs: [] });
    await fetchRecentMessagesForSearch();
    expect(mockCollection).toHaveBeenCalledWith({}, "messages");
  });

  // Was unbounded: one search click downloaded every message ever sent, which
  // at 250 participants over a season is tens of thousands of documents and
  // grows daily (scaling-250 design spec, 2026-08-07, S3).
  it("caps the fetch to the most recent SEARCH_WINDOW messages", async () => {
    mockGetDocs.mockResolvedValue({ docs: [] });
    await fetchRecentMessagesForSearch();
    expect(mockLimit).toHaveBeenCalledWith(SEARCH_WINDOW);
  });

  it("uses a window of 2000", () => {
    expect(SEARCH_WINDOW).toBe(2000);
  });
});
