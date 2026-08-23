import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { tr } from './translations'

export type Language = 'en' | 'tr'

/** Substituted into a phrase — see the note on word order below. */
export type Vars = Record<string, string | number>

interface I18nContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string, vars?: Vars) => string
}

const I18nContext = createContext<I18nContextType | undefined>(undefined)

const STORAGE_KEY = 'footydraft.language'

function readStored(): Language {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved === 'tr' || saved === 'en') return saved
  } catch {
    // A private window, or site data blocked. English is the default anyway.
  }
  return 'en'
}

/**
 * English and Turkish.
 *
 * **Keys are the English string, and a phrase with something variable in it is
 * one key with a `{placeholder}` in it** — never English fragments glued
 * around a name at the call site. That distinction is the whole reason the
 * first Turkish pass read badly: English puts the verb in the middle and
 * Turkish puts it at the end, so `"Waiting on " + name` can be translated
 * word-for-word and still come out as nonsense (*"Bekleniyor Ali"* rather than
 * *"Ali bekleniyor"*). A translator that receives the whole phrase can move
 * the name to where the sentence needs it.
 *
 * A key with no translation falls through to the key itself, which is the
 * English copy — so an untranslated string is merely untranslated rather than
 * a missing-key marker on screen.
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(readStored)

  useEffect(() => {
    document.documentElement.lang = language
    try {
      window.localStorage.setItem(STORAGE_KEY, language)
    } catch {
      // Nothing to recover — the choice just doesn't outlive the session.
    }
  }, [language])

  const setLanguage = useCallback((next: Language) => setLanguageState(next), [])

  const t = useCallback(
    (key: string, vars?: Vars) => fill(language === 'tr' ? (tr[key] ?? key) : key, vars),
    [language],
  )

  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

function fill(text: string, vars?: Vars): string {
  if (!vars) return text
  return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole,
  )
}

const FALLBACK: I18nContextType = {
  t: (key: string, vars?: Vars) => fill(key, vars),
  language: 'en',
  setLanguage: () => {},
}

export function useI18n() {
  return useContext(I18nContext) ?? FALLBACK
}
