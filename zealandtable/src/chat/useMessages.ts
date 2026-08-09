// src/chat/useMessages.ts
import { useCallback, useEffect, useState } from "react";
import { collection } from "firebase/firestore";
import { db } from "../firebase";
import { Message } from "./messageTypes";
import { getCached, setCached } from "../lib/sessionCache";
import { PAGE_SIZE, subscribeToRecentMessages, fetchOlderMessages } from "./paginatedMessages";

export interface MessageWithId extends Message {
  id: string;
}

const CACHE_KEY = "liveMessages";

export function useMessages() {
  const cached = getCached<MessageWithId[]>(CACHE_KEY);
  const [liveMessages, setLiveMessages] = useState<MessageWithId[]>(cached ?? []);
  const [olderMessages, setOlderMessages] = useState<MessageWithId[]>([]);
  const [loading, setLoading] = useState(cached === undefined);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMoreOlder, setHasMoreOlder] = useState(true);

  useEffect(() => {
    // Same fromCache guard as usePlayers.ts — don't report loaded off a
    // snapshot the SDK synthesized from local cache before the server has
    // confirmed it (2026-08-03).
    let confirmed = false;
    return subscribeToRecentMessages<Message>(
      collection(db, "messages"),
      (docs, fromCache) => {
        if (!confirmed && fromCache) return;
        confirmed = true;
        setCached(CACHE_KEY, docs);
        setLiveMessages(docs);
        setLoading(false);
        if (docs.length < PAGE_SIZE) setHasMoreOlder(false);
      },
      (err: Error) => {
        console.error("Failed to load messages", err);
        setLoading(false);
      }
    );
  }, []);

  const loadOlder = useCallback(async () => {
    const oldest = olderMessages[0] ?? liveMessages[0];
    if (!oldest || loadingOlder || !hasMoreOlder) return;

    setLoadingOlder(true);
    try {
      const docs = await fetchOlderMessages<Message>(collection(db, "messages"), oldest.createdAt);
      if (docs.length < PAGE_SIZE) setHasMoreOlder(false);
      if (docs.length > 0) setOlderMessages((prev) => [...docs, ...prev]);
    } catch (err) {
      console.error("Failed to load older messages", err);
    } finally {
      setLoadingOlder(false);
    }
  }, [olderMessages, liveMessages, loadingOlder, hasMoreOlder]);

  return {
    messages: [...olderMessages, ...liveMessages],
    loading,
    loadOlder,
    loadingOlder,
    hasMoreOlder,
  };
}
