import { useEffect, useState } from "react";
import { doc, onSnapshot, type DocumentData } from "firebase/firestore";
import { db } from "@/firebase";

export type DocState<T> = {
  data: T | null;
  loading: boolean;
  error: Error | null;
};

/**
 * Live listener on a single Firestore document.
 *
 * Deliberately does *not* wait for a server-confirmed snapshot the way the
 * collection listeners do. The parent project found that collection listeners
 * could release their loading gate on a partial, cache-only snapshot — some
 * of N documents — and painted half a list. A single document has no
 * equivalent failure mode: it's atomic, so a cached read is either the whole
 * document or nothing.
 */
export function useDoc<T>(
  path: string | null,
  map: (data: DocumentData, id: string) => T
): DocState<T> {
  const [state, setState] = useState<DocState<T>>({
    data: null,
    loading: path !== null,
    error: null,
  });

  useEffect(() => {
    if (!path) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    setState({ data: null, loading: true, error: null });

    return onSnapshot(
      doc(db, path),
      (snap) => {
        setState({
          data: snap.exists() ? map(snap.data(), snap.id) : null,
          loading: false,
          error: null,
        });
      },
      (error) => setState({ data: null, loading: false, error })
    );
    // `map` is intentionally excluded: call sites pass an inline arrow, and
    // including it would resubscribe on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  return state;
}
