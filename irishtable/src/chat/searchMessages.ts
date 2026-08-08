import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { db } from "../firebase";
import { Message } from "./messageTypes";
import { MessageWithId } from "./useMessages";

/**
 * How far back search reaches.
 */
export const SEARCH_WINDOW = 2000;

/**
 * There is no real search index behind this — Firestore has no substring
 * query, so this is a bounded fetch plus a client-side filter.
 *
 * The bound matters. In the parent this fetched the entire collection,
 * justified as "a friend-group season, not a public product" — an assumption a
 * public audience retires immediately. At 150 messages/day across a
 * September-May season that is ~40,000 documents per search click, growing
 * every day and recurring on every search.
 *
 * Accepted trade-off: a message older than the window is not findable, and the
 * empty state says so when the window was full, so a miss never implies the
 * message never existed.
 *
 * Split into two pieces so ChatRoom can fetch once per search session and
 * filter every keystroke against that same in-memory list, instead of
 * re-running a full fetch on every debounced keystroke.
 */
export async function fetchRecentMessagesForSearch(): Promise<MessageWithId[]> {
  const messagesQuery = query(
    collection(db, "messages"),
    orderBy("createdAt", "desc"),
    limit(SEARCH_WINDOW)
  );
  const snapshot = await getDocs(messagesQuery);
  return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as Message) }));
}

export function filterMessagesByTerm(messages: MessageWithId[], term: string): MessageWithId[] {
  const trimmed = term.trim().toLowerCase();
  if (!trimmed) return [];
  return messages.filter((message) => !message.deleted && message.text.toLowerCase().includes(trimmed));
}

export async function searchMessages(term: string): Promise<MessageWithId[]> {
  const trimmed = term.trim();
  if (!trimmed) return [];
  const all = await fetchRecentMessagesForSearch();
  return filterMessagesByTerm(all, trimmed);
}
