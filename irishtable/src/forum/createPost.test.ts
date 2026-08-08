// src/forum/createPost.test.ts
import { vi, describe, it, expect, beforeEach } from "vitest";

const mockAddDoc = vi.fn();
const mockCollection = vi.fn((_db: unknown, name: string) => ({ name }));
const mockUploadBytes = vi.fn();
const mockGetDownloadURL = vi.fn();
const mockRef = vi.fn((_storage: unknown, path: string) => ({ path }));

vi.mock("firebase/firestore", () => ({
  collection: (...args: unknown[]) => mockCollection(...(args as [unknown, string])),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
}));

vi.mock("firebase/storage", () => ({
  ref: (...args: unknown[]) => mockRef(...(args as [unknown, string])),
  uploadBytes: (...args: unknown[]) => mockUploadBytes(...args),
  getDownloadURL: (...args: unknown[]) => mockGetDownloadURL(...args),
}));

vi.mock("../firebase", () => ({ db: {}, storage: {} }));

import { createPost } from "./createPost";
import { IMMUTABLE_CACHE_CONTROL } from "../lib/compressImage";

const fakeFile = new File(["fake-image-bytes"], "photo.png", { type: "image/png" });

describe("createPost", () => {
  beforeEach(() => {
    mockAddDoc.mockReset();
    mockUploadBytes.mockReset();
    mockGetDownloadURL.mockReset();
  });

  it("writes a text-only post with imageURL null and does not attempt an upload", async () => {
    mockAddDoc.mockResolvedValue(undefined);
    await createPost("uid1", "  Merhaba  ", null, null);
    expect(mockUploadBytes).not.toHaveBeenCalled();
    const [, written] = mockAddDoc.mock.calls[0];
    expect(written).toMatchObject({ uid: "uid1", text: "Merhaba", imageURL: null, parentId: null });
    expect(typeof written.createdAt).toBe("number");
  });

  it("defaults editedAt to null and mentionedUids/quote fields to empty when omitted", async () => {
    mockAddDoc.mockResolvedValue(undefined);
    await createPost("uid1", "Merhaba", null, null);
    const [, written] = mockAddDoc.mock.calls[0];
    expect(written.editedAt).toBeNull();
    expect(written.mentionedUids).toEqual([]);
    expect(written.quotedPostId).toBeNull();
    expect(written.quotedAuthorUid).toBeNull();
    expect(written.quotedText).toBeNull();
  });

  it("writes the given mentionedUids", async () => {
    mockAddDoc.mockResolvedValue(undefined);
    await createPost("uid1", "hey @Ada", null, null, ["uid2"]);
    const [, written] = mockAddDoc.mock.calls[0];
    expect(written.mentionedUids).toEqual(["uid2"]);
  });

  it("writes the quote fields when a quote is given", async () => {
    mockAddDoc.mockResolvedValue(undefined);
    await createPost("uid1", "cevap", null, "thread-1", [], { postId: "p2", authorUid: "uid3", text: "orijinal metin" });
    const [, written] = mockAddDoc.mock.calls[0];
    expect(written).toMatchObject({ quotedPostId: "p2", quotedAuthorUid: "uid3", quotedText: "orijinal metin" });
  });

  it("uploads the image and writes its download URL for an image-only post", async () => {
    mockUploadBytes.mockResolvedValue(undefined);
    mockGetDownloadURL.mockResolvedValue("https://example.com/image.png");
    mockAddDoc.mockResolvedValue(undefined);
    await createPost("uid1", "", fakeFile, null);
    expect(mockUploadBytes).toHaveBeenCalledTimes(1);
    const [, written] = mockAddDoc.mock.calls[0];
    expect(written).toMatchObject({ uid: "uid1", text: "", imageURL: "https://example.com/image.png", parentId: null });
  });

  it("uploads with an immutable cache-control (the path is never reused per upload)", async () => {
    mockUploadBytes.mockResolvedValue(undefined);
    mockGetDownloadURL.mockResolvedValue("https://example.com/image.png");
    mockAddDoc.mockResolvedValue(undefined);
    await createPost("uid1", "", fakeFile, null);
    expect(mockUploadBytes).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { cacheControl: IMMUTABLE_CACHE_CONTROL }
    );
  });

  it("writes the given parentId for a reply", async () => {
    mockAddDoc.mockResolvedValue(undefined);
    await createPost("uid1", "Bir cevap", null, "thread-1");
    const [, written] = mockAddDoc.mock.calls[0];
    expect(written.parentId).toBe("thread-1");
  });

  it("does not write when both text and image are empty", async () => {
    await createPost("uid1", "   ", null, null);
    expect(mockAddDoc).not.toHaveBeenCalled();
  });

  it("propagates an upload rejection", async () => {
    mockUploadBytes.mockRejectedValue(new Error("upload failed"));
    await expect(createPost("uid1", "", fakeFile, null)).rejects.toThrow("upload failed");
    expect(mockAddDoc).not.toHaveBeenCalled();
  });

  it("propagates a write rejection", async () => {
    mockAddDoc.mockRejectedValue(new Error("permission-denied"));
    await expect(createPost("uid1", "Merhaba", null, null)).rejects.toThrow("permission-denied");
  });
});
