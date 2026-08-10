// src/forum/editPost.test.ts
import { vi, describe, it, expect, beforeEach } from "vitest";

const mockUpdateDoc = vi.fn();
const mockDoc = vi.fn((_db: unknown, collection: string, id: string) => ({ collection, id }));

vi.mock("firebase/firestore", () => ({
  doc: (...args: unknown[]) => mockDoc(...(args as [unknown, string, string])),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
}));

vi.mock("../firebase", () => ({ db: {} }));

import { editPost } from "./editPost";

describe("editPost", () => {
  beforeEach(() => {
    mockUpdateDoc.mockReset().mockResolvedValue(undefined);
    mockDoc.mockClear();
  });

  it("updates text (trimmed), mentionedUids, and sets a fresh editedAt", async () => {
    await editPost("p1", "  yeni metin  ", ["uid2"]);
    expect(mockDoc).toHaveBeenCalledWith({}, "forumPosts", "p1");
    const [, written] = mockUpdateDoc.mock.calls[0];
    expect(written.text).toBe("yeni metin");
    expect(written.mentionedUids).toEqual(["uid2"]);
    expect(typeof written.editedAt).toBe("number");
  });

  it("propagates an update rejection", async () => {
    mockUpdateDoc.mockRejectedValue(new Error("permission-denied"));
    await expect(editPost("p1", "metin", [])).rejects.toThrow("permission-denied");
  });
});
