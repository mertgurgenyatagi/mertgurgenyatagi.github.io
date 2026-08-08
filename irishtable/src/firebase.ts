import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";

/**
 * irishtable runs on its own Firebase project, entirely separate from the
 * parent project's — separate auth, separate data, separate billing.
 *
 * Values come from .env.local (gitignored). See .env.example for the shape.
 *
 * Realtime Database is back as of the frontend clone. It powers exactly two
 * things, presence and typing indicators, both of which the cloned ChatRoom
 * carries. It costs ~35KB gzipped, which was the reason the original build
 * dropped it — the call to take that back was made deliberately: the chat cell
 * is what makes the logged-in Home read as inhabited rather than static, and
 * that matters when the page exists to be shown to someone deciding whether to
 * run it with an audience. RTDB is free on Spark, so no billing change.
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
};

/** True when the project hasn't been wired up yet — lets the shell render a
 *  clear message instead of throwing an opaque Firebase error. */
export const firebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId
);

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);

/**
 * Firestore, with long-polling auto-detection turned on.
 *
 * By default the SDK talks over a WebChannel streaming connection. Some
 * networks — corporate proxies, VPNs, certain antivirus and mobile carriers —
 * let that connection open but silently stall its traffic. The failure mode is
 * nasty and specific: **reads keep working off an already-established stream
 * while writes hang forever**, because `setDoc` only resolves on a server ack
 * that never arrives, and the SDK has no write timeout of its own.
 *
 * `experimentalAutoDetectLongPolling` makes the SDK notice a stalled stream
 * and fall back to plain HTTP long-polling, which such networks pass through
 * fine. It costs nothing on a healthy connection.
 */
export const db = initializeFirestore(firebaseApp, {
  experimentalAutoDetectLongPolling: true,
});

/**
 * Realtime Database — presence and typing only.
 *
 * Deliberately not Firestore: both are high-frequency, disposable writes with
 * no history worth keeping, and RTDB's `onDisconnect` is the only clean way to
 * clear a presence node when a tab dies without a graceful sign-out.
 */
export const rtdb = getDatabase(firebaseApp);

export const storage = getStorage(firebaseApp);

/**
 * Photo uploads are off unless explicitly switched on.
 *
 * Firebase Storage needs the Blaze plan, and against a project without a
 * bucket an upload doesn't fail — it retries on a backoff for two minutes and
 * *looks* like a hang. Rather than offer a picker that cannot work, the whole
 * photo affordance is hidden until this is flipped on. Set
 * VITE_PHOTOS_ENABLED=true in .env.local once Storage is actually set up.
 */
export const photosEnabled = import.meta.env.VITE_PHOTOS_ENABLED === "true";

/**
 * Cut the SDK's two-minute retry window right down. Even with Storage
 * properly configured, a genuine failure should surface in seconds — nobody
 * watches a "Saving" button for two minutes to find out it didn't work.
 */
storage.maxUploadRetryTime = 10_000;
storage.maxOperationRetryTime = 10_000;
