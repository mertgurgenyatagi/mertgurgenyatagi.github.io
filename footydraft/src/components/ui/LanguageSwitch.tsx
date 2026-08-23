import { useI18n } from '../../lib/i18n'

const LANGUAGES = [
  { id: 'en', label: 'EN' },
  { id: 'tr', label: 'TR' },
] as const

/**
 * English and Turkish, on every screen — and wired, as of 2026-08-23. The
 * choice is remembered in `localStorage` and stamped on `<html lang>`; see
 * `I18nProvider`.
 */
export function LanguageSwitch({ className = '' }: { className?: string }) {
  const { language, setLanguage, t } = useI18n()

  return (
    <div
      role="group"
      aria-label={t('Language')}
      className={`flex shrink-0 items-center overflow-hidden rounded-sm border border-line ${className}`}
    >
      {LANGUAGES.map((entry) => (
        <button
          key={entry.id}
          type="button"
          aria-pressed={language === entry.id}
          onClick={() => setLanguage(entry.id as 'en' | 'tr')}
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
