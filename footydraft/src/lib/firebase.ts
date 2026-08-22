import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'
import { getAuth, signInAnonymously } from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL
}

export const app = initializeApp(firebaseConfig)
export const database = getDatabase(app)
export const auth = getAuth(app)

let signinPromise: Promise<string> | null = null

export function getAnonymousUid(): Promise<string> {
  if (signinPromise) return signinPromise

  signinPromise = signInAnonymously(auth)
    .then((cred) => cred.user.uid)
    .catch((error) => {
      console.warn('Anonymous auth failed, falling back to local ID:', error)
      const LOCAL_KEY = 'fd.fallback.uid'
      let fallbackId = localStorage.getItem(LOCAL_KEY)
      if (!fallbackId) {
        fallbackId = 'local-' + Math.random().toString(36).slice(2)
        localStorage.setItem(LOCAL_KEY, fallbackId)
      }
      return fallbackId
    })
    
  return signinPromise
}
