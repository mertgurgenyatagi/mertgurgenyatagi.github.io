// src/forum/editPost.ts
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { POST_MAX_LENGTH } from "./postTypes";

/** Text (and its @mentions) only — never the attached image, never the
 *  quote a reply was created with (forum-round-03 Q5). */
export async function editPost(postId: string, text: string, mentionedUids: string[]): Promise<void> {
  await updateDoc(doc(db, "forumPosts", postId), {
    text: text.trim().slice(0, POST_MAX_LENGTH),
    mentionedUids,
    editedAt: Date.now(),
  });
}
