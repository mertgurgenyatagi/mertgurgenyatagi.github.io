import { Player } from "../profile/usePlayers";

export interface MentionQuery {
  /** Text typed after "@", not yet including it. */
  query: string;
  /** Index of the "@" character itself within the full text. */
  start: number;
}

/**
 * The single-token form of a participant's name, used for @-mentions.
 *
 * The parent project mentions people by first name, which is always one word.
 * irishtable collects a single `displayName` that may well contain spaces
 * ("Mert G", "The Irish Guy"), and a mention token cannot contain whitespace —
 * `findActiveMentionQuery` below stops at the first space, and the highlighting
 * regex only matches `[\p{L}\d_]+`. Typing "@The Irish Guy" would therefore
 * match nothing at all.
 *
 * So a handle is the display name with everything that isn't a letter, digit
 * or underscore removed: "The Irish Guy" -> "TheIrishGuy". That keeps mentions
 * one token, keeps them readable, and keeps every function below working on
 * the parent's original logic.
 *
 * Two people can share a handle, exactly as two people can share a first name
 * in the parent. Both get notified, which is the existing behaviour.
 */
export function mentionHandle(player: { displayName: string }): string {
  return player.displayName.replace(/[^\p{L}\d_]/gu, "");
}

/**
 * Finds an in-progress "@word" token immediately before the cursor, e.g.
 * "hey @ad|" (cursor at |) -> { query: "ad", start: 4 }. Returns null once the
 * token is broken by whitespace, or "@" isn't at the very start of a word (so
 * "a@b" doesn't trigger mid-word).
 */
export function findActiveMentionQuery(text: string, cursor: number): MentionQuery | null {
  const upToCursor = text.slice(0, cursor);
  const at = upToCursor.lastIndexOf("@");
  if (at === -1) return null;

  const between = upToCursor.slice(at + 1);
  if (/\s/.test(between)) return null;
  if (at > 0 && /\S/.test(upToCursor[at - 1])) return null;

  return { query: between, start: at };
}

/** Players whose handle starts with `query` (case-insensitive), for the
 *  composer's autocomplete dropdown. */
export function matchMentionCandidates(players: Player[], query: string, max = 5): Player[] {
  const q = query.toLowerCase();
  return players
    .filter((p) => mentionHandle(p).toLowerCase().startsWith(q))
    .slice(0, max);
}

/** Replaces the in-progress "@word" token with "@Handle " and reports where
 *  the cursor should land afterward. */
export function insertMention(
  text: string,
  mention: MentionQuery,
  cursor: number,
  player: Player
): { text: string; cursor: number } {
  const before = text.slice(0, mention.start);
  const after = text.slice(cursor);
  const inserted = `@${mentionHandle(player)} `;
  return { text: before + inserted + after, cursor: (before + inserted).length };
}

export interface MentionSegment {
  text: string;
  isMention: boolean;
}

/** Splits message text into plain/mention segments for cosmetic highlighting —
 *  only "@Word" tokens that actually match a real participant's handle light
 *  up, so a stray "@" in normal prose doesn't. */
export function splitMentionSegments(text: string, players: Player[]): MentionSegment[] {
  const handles = new Set(
    players.map((p) => mentionHandle(p).toLowerCase()).filter((h) => h.length > 0)
  );
  return text
    .split(/(@[\p{L}\d_]+)/gu)
    .filter((part) => part.length > 0)
    .map((part) => ({
      text: part,
      isMention: part.startsWith("@") && handles.has(part.slice(1).toLowerCase()),
    }));
}

/** Every uid whose handle is @mentioned anywhere in `text`, deduped. Computed
 *  at send time from the text itself, so it works the same whether a mention
 *  was picked from the dropdown or just typed by hand. */
export function resolveMentionedUids(text: string, players: Player[]): string[] {
  const mentioned = new Set(
    splitMentionSegments(text, players)
      .filter((segment) => segment.isMention)
      .map((segment) => segment.text.slice(1).toLowerCase())
  );
  if (mentioned.size === 0) return [];

  const uids = new Set<string>();
  players.forEach((p) => {
    const handle = mentionHandle(p).toLowerCase();
    if (handle && mentioned.has(handle)) uids.add(p.uid);
  });
  return Array.from(uids);
}
