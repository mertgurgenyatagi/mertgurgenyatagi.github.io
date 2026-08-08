// src/forum/deletePost.test.ts
import { vi, describe, it, expect, beforeEach } from "vitest";

const mockDelete = vi.fn();
const mockCommit = vi.fn();
const mockWriteBatch = vi.fn((_db: unknown) => ({ delete: mockDelete, commit: mockCommit }));
const mockDoc = vi.fn((_db: unknown, collection: string, id: string) => ({ collection, id }));
const mockDeleteObject = vi.fn();
const mockRef = vi.fn((_storage: unknown, url: string) => ({ url }));

vi.mock("firebase/firestore", () => ({
  doc: (...args: unknown[]) => mockDoc(...(args as [unknown, string, string])),
  writeBatch: (...args: unknown[]) => mockWriteBatch(...(args as [unknown])),
}));

vi.mock("firebase/storage", () => ({
  ref: (...args: unknown[]) => mockRef(...(args as [unknown, string])),
  deleteObject: (...args: unknown[]) => mockDeleteObject(...args),
}));

vi.mock("../firebase", () => ({ db: {}, storage: {} }));

import { deletePost } from "./deletePost";

describe("deletePost", () => {
  beforeEach(() => {
    mockDelete.mockReset();
    mockCommit.mockReset().mockResolvedValue(undefined);
    mockDoc.mockClear();
    mockDeleteObject.mockReset().mockResolvedValue(undefined);
    mockRef.mockClear();
  });

  it("deletes the root post itself when there are no replies", async () => {
    await deletePost("root-1", []);
    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(mockDelete).toHaveBeenCalledWith({ collection: "forumPosts", id: "root-1" });
    expect(mockCommit).toHaveBeenCalledTimes(1);
  });

  it("deletes every reply id plus the root itself, in one batch", async () => {
    await deletePost("root-1", ["reply-1", "reply-2"]);
    expect(mockDelete).toHaveBeenCalledTimes(3);
    expect(mockDelete).toHaveBeenCalledWith({ collection: "forumPosts", id: "reply-1" });
    expect(mockDelete).toHaveBeenCalledWith({ collection: "forumPosts", id: "reply-2" });
    expect(mockDelete).toHaveBeenCalledWith({ collection: "forumPosts", id: "root-1" });
  });

  it("propagates a commit rejection", async () => {
    mockCommit.mockRejectedValue(new Error("permission-denied"));
    await expect(deletePost("root-1", [])).rejects.toThrow("permission-denied");
  });

  it("deletes every non-null image URL from storage after the batch commits", async () => {
    await deletePost("root-1", ["reply-1"], ["https://img/root.png", null, "https://img/reply.png"]);
    expect(mockDeleteObject).toHaveBeenCalledTimes(2);
    expect(mockRef).toHaveBeenCalledWith({}, "https://img/root.png");
    expect(mockRef).toHaveBeenCalledWith({}, "https://img/reply.png");
  });

  it("does not attempt any storage deletes when no imageURLs are passed", async () => {
    await deletePost("root-1", []);
    expect(mockDeleteObject).not.toHaveBeenCalled();
  });

  it("swallows a failed image delete instead of throwing", async () => {
    mockDeleteObject.mockRejectedValue(new Error("object-not-found"));
    await expect(deletePost("root-1", [], ["https://img/root.png"])).resolves.toBeUndefined();
  });
});
