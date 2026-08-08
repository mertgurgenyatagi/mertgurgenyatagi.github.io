// src/chat/paginatedMessages.ts
import {
  CollectionReference,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  Unsubscribe,
} from "firebase/firestore";

// Global chat, every lobby's chat, and the forum feed (usePosts.ts) all cap
// their live window to the most recent page — older history is reachable on
// demand via fetchOlderMessages, a one-time (non-live) fetch. Shared here
// rather than duplicated across useMessages.ts, useLobbyMessages.ts, and
// usePosts.ts. Named generically (not MESSAGE_PAGE_SIZE) since it now bounds
// forum posts too, not just chat messages.
export const PAGE_SIZE = 50;

interface WithCreatedAt {
  createdAt: number;
}

function toDocWithId<T>(docSnap: { id: string; data: () => unknown }): T & { id: string } {
  return { id: docSnap.id, ...(docSnap.data() as T) };
}

export function subscribeToRecentMessages<T extends WithCreatedAt>(
  messagesCollection: CollectionReference,
  onNext: (docs: (T & { id: string })[], fromCache: boolean) => void,
  onError: (err: Error) => void
): Unsubscribe {
  return onSnapshot(
    query(messagesCollection, orderBy("createdAt", "desc"), limit(PAGE_SIZE)),
    (snapshot) =>
      onNext(
        snapshot.docs.map((d) => toDocWithId<T>(d)).reverse(),
        Boolean(snapshot.metadata?.fromCache)
      ),
    onError
  );
}

export async function fetchOlderMessages<T extends WithCreatedAt>(
  messagesCollection: CollectionReference,
  beforeCreatedAt: number
): Promise<(T & { id: string })[]> {
  const snapshot = await getDocs(
    query(messagesCollection, orderBy("createdAt", "desc"), startAfter(beforeCreatedAt), limit(PAGE_SIZE))
  );
  return snapshot.docs.map((d) => toDocWithId<T>(d)).reverse();
}
