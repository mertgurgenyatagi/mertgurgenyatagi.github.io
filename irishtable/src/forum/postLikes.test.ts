import { describe, it, expect, vi, beforeEach } from "vitest";
import { PostWithId } from "./postTypes";

const mockDoc = vi.fn((_db: unknown, collectionName: string, id: string) => ({ collectionName, id }));
const mockUpdateDoc = vi.fn();
const mockArrayUnion = vi.fn((...uids: string[]) => ({ op: "union", uids }));
const mockArrayRemove = vi.fn((...uids: string[]) => ({ op: "remove", uids }));

vi.mock("firebase/firestore", () => ({
  doc: (...args: unknown[]) => mockDoc(...(args as [unknown, string, string])),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  arrayUnion: (...args: unknown[]) => mockArrayUnion(...(args as string[])),
  arrayRemove: (...args: unknown[]) => mockArrayRemove(...(args as string[])),
}));

vi.mock("../firebase", () => ({ db: {} }));

import { buildLikesByPost, setPostLiked } from "./postLikes";

function makePost(overrides: Partial<PostWithId> = {}): PostWithId {
  return {
    id: "p1",
    uid: "uid1",
    text: "Merhaba",
    imageURL: null,
    parentId: null,
    createdAt: 1,
    editedAt: null,
    mentionedUids: [],
    quotedPostId: null,
    quotedAuthorUid: null,
    quotedText: null,
    likedByUids: [],
    ...overrides,
  };
}

describe("buildLikesByPost", () => {
  it("maps each post's likedByUids to a set, keyed by post id", () => {
    const posts = [makePost({ id: "p1", likedByUids: ["uid1", "uid2"] }), makePost({ id: "p2", likedByUids: [] })];
    const map = buildLikesByPost(posts);
    expect(map.get("p1")).toEqual(new Set(["uid1", "uid2"]));
    expect(map.get("p2")).toEqual(new Set());
  });

  it("returns an empty map for an empty post list", () => {
    expect(buildLikesByPost([])).toEqual(new Map());
  });
});

describe("setPostLiked", () => {
  beforeEach(() => {
    mockDoc.mockClear();
    mockUpdateDoc.mockReset();
    mockArrayUnion.mockClear();
    mockArrayRemove.mockClear();
  });

  it("adds the uid to likedByUids via arrayUnion when liking", async () => {
    mockUpdateDoc.mockResolvedValue(undefined);
    await setPostLiked("p1", "uid1", true);
    expect(mockDoc).toHaveBeenCalledWith({}, "forumPosts", "p1");
    expect(mockArrayUnion).toHaveBeenCalledWith("uid1");
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      { collectionName: "forumPosts", id: "p1" },
      { likedByUids: { op: "union", uids: ["uid1"] } }
    );
  });

  it("removes the uid from likedByUids via arrayRemove when unliking", async () => {
    mockUpdateDoc.mockResolvedValue(undefined);
    await setPostLiked("p1", "uid1", false);
    expect(mockArrayRemove).toHaveBeenCalledWith("uid1");
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      { collectionName: "forumPosts", id: "p1" },
      { likedByUids: { op: "remove", uids: ["uid1"] } }
    );
  });

  it("propagates a write failure", async () => {
    mockUpdateDoc.mockRejectedValue(new Error("permission-denied"));
    await expect(setPostLiked("p1", "uid1", true)).rejects.toThrow("permission-denied");
  });
});
