/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  /** "true" switches on the profile-photo affordance. Needs Firebase Storage,
   *  which needs the Blaze plan — see src/firebase.ts. */
  readonly VITE_PHOTOS_ENABLED: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
