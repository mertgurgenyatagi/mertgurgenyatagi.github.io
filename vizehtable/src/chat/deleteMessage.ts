import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";

/**
 * Soft-delete: flips `deleted` to true and leaves everything else alone.
 * firestore.rules enforces both that this is the message's own sender and that
 * `deleted` is the only field this write can touch.
 *
 * The parent takes a `lobbyId` here to pick a lobby's own messages
 * subcollection. irishtable has no lobbies, so there is one collection and no
 * switch.
 */
export async function deleteMessage(messageId: string): Promise<void> {
  await updateDoc(doc(db, "messages", messageId), { deleted: true });
}
