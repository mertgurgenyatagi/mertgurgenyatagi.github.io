import { describe, it, expect } from "vitest";
import { computeThreadStats } from "./threadStats";
import { PostWithId } from "./postTypes";

function post(id: string, parentId: string | null, createdAt: number): PostWithId {
  return {
    id,
    uid: "uid1",
    text: `text-${id}`,
    imageURL: null,
    parentId,
    createdAt,
    editedAt: null,
    mentionedUids: [],
    quotedPostId: null,
    quotedAuthorUid: null,
    quotedText: null,
    likedByUids: [],
  };
}

describe("computeThreadStats", () => {
  it("gives a threadless post a zero reply count and its own createdAt as last activity", () => {
    const stats = computeThreadStats([post("a", null, 100)]);
    expect(stats.get("a")).toEqual({ replyCount: 0, lastActivityAt: 100, latestReply: null });
  });

  it("counts a direct reply and bumps last activity to the reply's time", () => {
    const reply = post("reply", "thread", 500);
    const stats = computeThreadStats([post("thread", null, 100), reply]);
    expect(stats.get("thread")).toEqual({ replyCount: 1, lastActivityAt: 500, latestReply: reply });
  });

  it("counts a reply-to-a-reply toward the root thread, arbitrarily deep, and surfaces it as the latest reply", () => {
    const reply2 = post("reply2", "reply1", 300);
    const stats = computeThreadStats([post("thread", null, 100), post("reply1", "thread", 200), reply2]);
    expect(stats.get("thread")).toEqual({ replyCount: 2, lastActivityAt: 300, latestReply: reply2 });
  });

  it("uses the root's own createdAt for last activity when it's later than any reply, but still surfaces the reply", () => {
    const reply = post("reply", "thread", 200);
    const stats = computeThreadStats([post("thread", null, 900), reply]);
    expect(stats.get("thread")).toEqual({ replyCount: 1, lastActivityAt: 900, latestReply: reply });
  });

  it("keeps separate threads' stats independent", () => {
    const t1Reply = post("t1-reply", "t1", 150);
    const stats = computeThreadStats([post("t1", null, 100), t1Reply, post("t2", null, 200)]);
    expect(stats.get("t1")).toEqual({ replyCount: 1, lastActivityAt: 150, latestReply: t1Reply });
    expect(stats.get("t2")).toEqual({ replyCount: 0, lastActivityAt: 200, latestReply: null });
  });

  it("only produces entries for top-level posts, not replies", () => {
    const stats = computeThreadStats([post("thread", null, 100), post("reply", "thread", 200)]);
    expect(stats.has("reply")).toBe(false);
    expect(stats.size).toBe(1);
  });
});
