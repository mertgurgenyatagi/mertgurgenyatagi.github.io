// src/forum/createPost.ts
import { addDoc, collection } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase";
import { ForumPost, POST_MAX_LENGTH } from "./postTypes";
import { compressImage, IMMUTABLE_CACHE_CONTROL } from "../lib/compressImage";

// Forum images render as a small bounded thumbnail by default (4chan-style —
// only the click-to-expand view shows them larger). 400px/0.45 is a
// deliberately aggressive trade against a free-tier Storage budget with a
// hard billing killswitch behind it (2026-07-31) — the expanded lightbox
// view will look soft on a large screen; that's accepted, not an oversight.
const FORUM_IMAGE_MAX_DIMENSION = 400;
const FORUM_IMAGE_QUALITY = 0.45;

export interface QuoteRef {
  postId: string;
  authorUid: string;
  text: string;
}

export async function createPost(
  uid: string,
  text: string,
  imageFile: File | null,
  parentId: string | null,
  mentionedUids: string[] = [],
  quote: QuoteRef | null = null
): Promise<void> {
  const trimmed = text.trim().slice(0, POST_MAX_LENGTH);
  if (!trimmed && !imageFile) return;

  let imageURL: string | null = null;
  if (imageFile) {
    const compressed = await compressImage(imageFile, { maxDimension: FORUM_IMAGE_MAX_DIMENSION, quality: FORUM_IMAGE_QUALITY });
    const imageRef = ref(storage, `forum-images/${uid}-${Date.now()}`);
    await uploadBytes(imageRef, compressed, { cacheControl: IMMUTABLE_CACHE_CONTROL });
    imageURL = await getDownloadURL(imageRef);
  }

  const post: ForumPost = {
    uid,
    text: trimmed,
    imageURL,
    parentId,
    createdAt: Date.now(),
    editedAt: null,
    mentionedUids,
    quotedPostId: quote?.postId ?? null,
    quotedAuthorUid: quote?.authorUid ?? null,
    quotedText: quote?.text ?? null,
    likedByUids: [],
  };
  await addDoc(collection(db, "forumPosts"), post);
}
