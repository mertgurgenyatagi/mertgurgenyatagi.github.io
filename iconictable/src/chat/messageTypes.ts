export interface Message {
  uid: string;
  text: string;
  createdAt: number;
  /** Uids resolved from any @mentions in `text` at send time (chat-widget-round-01
   *  Q14) — stored separately from the text itself so "does this mention me"
   *  stays exact even with duplicate first names, instead of re-parsing text
   *  against the current players list on every render. Omitted when empty. */
  mentionedUids?: string[];
  /** Soft-delete flag (chat-widget-round-01 Q16) — set by the sender only,
   *  via deleteMessage.ts. The original `text` is left in place server-side
   *  but every reader ignores it once this is true, rendering a "deleted"
   *  placeholder instead (ChatRoom.tsx). */
  deleted?: boolean;
  /** Set when this message quotes an earlier one (chat-widget-round-04) —
   *  a text snapshot only, not a live reference, so it still reads fine even
   *  if the quoted message is later deleted. */
  quotedMessageId?: string;
  quotedAuthorUid?: string;
  quotedText?: string;
}

// chat-widget-round-01 Q17: hard cap at 360, with a counter that only shows
// once composing crosses into the 300 zone.
export const MESSAGE_MAX_LENGTH = 360;
export const MESSAGE_LENGTH_WARNING_AT = 300;
