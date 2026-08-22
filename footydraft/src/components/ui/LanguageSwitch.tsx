import { useState } from 'react'

const LANGUAGES = [
  { id: 'en', label: 'EN' },
  { id: 'tr', label: 'TR' },
] as const

/**
 * English and Turkish, on every screen.
 *
 * The switch moves; nothing behind it does yet. Copy is still English in both
 * positions — translation is its own pass, and the control is here first so
 * every layout already has the room for it rather than having one cut into it
 * later.
 */
export function LanguageSwitch({ className = '' }: { className?: string }) {
  const [language, setLanguage] = useState<string>('en')

  return (
    <div
      role="group"
      aria-label="Language"
      className={`flex shrink-0 items-center overflow-hidden rounded-sm border border-line ${className}`}
    >
      {LANGUAGES.map((entry) => (
        <button
          key={entry.id}
          type="button"
          aria-pressed={language === entry.id}
          onClick={() => setLanguage(entry.id)}
          className={[
            'px-[9px] py-[4px] font-display text-[10px] font-medium uppercase leading-none tracking-[0.14em] transition-colors duration-150 ease-out',
            language === entry.id
              ? 'bg-accent-soft text-accent'
              : 'text-dim hover:text-ink',
          ].join(' ')}
        >
          {entry.label}
        </button>
      ))}
    </div>
  )
}
