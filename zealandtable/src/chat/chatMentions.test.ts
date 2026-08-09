import { describe, it, expect } from "vitest";
import {
  findActiveMentionQuery,
  matchMentionCandidates,
  insertMention,
  mentionHandle,
  splitMentionSegments,
  resolveMentionedUids,
} from "./chatMentions";
import { Player } from "../profile/usePlayers";

const players: Player[] = [
  { uid: "uid-ada", displayName: "Ada", photoURL: "", createdAt: 1 },
  { uid: "uid-ada2", displayName: "Ada", photoURL: "", createdAt: 2 },
  { uid: "uid-kuzey", displayName: "Kuzey", photoURL: "", createdAt: 3 },
  // A multi-word display name — impossible in the parent, which mentions by
  // single-token first name, and the reason mentionHandle() exists.
  { uid: "uid-irish", displayName: "The Irish Guy", photoURL: "", createdAt: 4 },
];

describe("findActiveMentionQuery", () => {
  it("finds an in-progress @token at the cursor", () => {
    expect(findActiveMentionQuery("hey @ad", 7)).toEqual({ query: "ad", start: 4 });
  });

  it("finds a bare @ with nothing typed yet as an empty query", () => {
    expect(findActiveMentionQuery("hey @", 5)).toEqual({ query: "", start: 4 });
  });

  it("returns null once whitespace breaks the token", () => {
    expect(findActiveMentionQuery("hey @ad ", 8)).toBeNull();
  });

  it("returns null when there's no @ at all", () => {
    expect(findActiveMentionQuery("hey there", 9)).toBeNull();
  });

  it("returns null for an email-shaped token where @ isn't at a word start", () => {
    expect(findActiveMentionQuery("a@b", 3)).toBeNull();
  });

  it("only looks at text up to the cursor, not the whole string", () => {
    expect(findActiveMentionQuery("@ada more text", 3)).toEqual({ query: "ad", start: 0 });
  });

  it("matches an @ at the very start of the text", () => {
    expect(findActiveMentionQuery("@kuz", 4)).toEqual({ query: "kuz", start: 0 });
  });
});

describe("matchMentionCandidates", () => {
  it("matches by case-insensitive handle prefix", () => {
    expect(matchMentionCandidates(players, "ad").map((p) => p.uid)).toEqual(["uid-ada", "uid-ada2"]);
  });

  it("returns all players for an empty query", () => {
    expect(matchMentionCandidates(players, "")).toHaveLength(4);
  });

  it("returns nothing when no handle matches", () => {
    expect(matchMentionCandidates(players, "zzz")).toEqual([]);
  });

  it("caps results at max", () => {
    expect(matchMentionCandidates(players, "", 2)).toHaveLength(2);
  });
});

describe("insertMention", () => {
  it("replaces the in-progress token with @Handle and a trailing space", () => {
    const result = insertMention("hey @ad", { query: "ad", start: 4 }, 7, players[0]);
    expect(result.text).toBe("hey @Ada ");
    expect(result.cursor).toBe(9);
  });

  it("preserves text typed after the cursor", () => {
    const result = insertMention("hey @ad, look at this", { query: "ad", start: 4 }, 7, players[0]);
    expect(result.text).toBe("hey @Ada , look at this");
  });
});

describe("splitMentionSegments", () => {
  it("flags an @Word segment that matches a real player's handle", () => {
    const segments = splitMentionSegments("hi @Ada how are you", players);
    expect(segments).toContainEqual({ text: "@Ada", isMention: true });
  });

  it("does not flag an @word that matches nobody", () => {
    const segments = splitMentionSegments("this is not an @email", players);
    expect(segments.find((s) => s.text === "@email")).toEqual({ text: "@email", isMention: false });
  });

  it("reassembles to the original text when segments are joined back", () => {
    const text = "hi @Ada and @Kuzey, all right?";
    const segments = splitMentionSegments(text, players);
    expect(segments.map((s) => s.text).join("")).toBe(text);
  });
});

describe("resolveMentionedUids", () => {
  it("resolves every matching player when a name is ambiguous (two Adas)", () => {
    const uids = resolveMentionedUids("hi @Ada", players);
    expect(uids.sort()).toEqual(["uid-ada", "uid-ada2"]);
  });

  it("resolves a unique name to just that player", () => {
    expect(resolveMentionedUids("hi @Kuzey", players)).toEqual(["uid-kuzey"]);
  });

  it("returns an empty array when nothing is mentioned", () => {
    expect(resolveMentionedUids("hi everyone", players)).toEqual([]);
  });

  it("dedupes when the same name is mentioned twice", () => {
    expect(resolveMentionedUids("@Kuzey and again @Kuzey", players)).toEqual(["uid-kuzey"]);
  });
});

describe("mentionHandle", () => {
  it("strips whitespace so a multi-word display name is one mention token", () => {
    expect(mentionHandle({ displayName: "The Irish Guy" })).toBe("TheIrishGuy");
  });

  it("resolves a mention typed against that stripped handle", () => {
    expect(resolveMentionedUids("nice one @TheIrishGuy", players)).toEqual(["uid-irish"]);
  });

  it("does not resolve the spaced form, which a mention token cannot contain", () => {
    expect(resolveMentionedUids("nice one @The Irish Guy", players)).toEqual([]);
  });

  it("offers a multi-word name in the dropdown from a prefix of its handle", () => {
    expect(matchMentionCandidates(players, "theirish").map((p) => p.uid)).toEqual(["uid-irish"]);
  });
});
