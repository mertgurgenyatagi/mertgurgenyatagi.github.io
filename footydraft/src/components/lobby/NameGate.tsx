import { useEffect, useId, useRef, useState } from 'react'
import { readName } from '../../lib/lobbySession'
import { Button } from '../ui/Button'
import { SectionLabel } from '../ui/SectionLabel'
import { useI18n } from '../../lib/i18n'

export const NAME_MAX = 14
const NAME_MIN = 2

interface NameGateProps {
  /** Creating draws the code as something new; joining draws it as a destination. */
  mode: 'create' | 'join'
  code: string
  onSubmit: (name: string) => void
  onCancel: () => void
}

/**
 * The one thing asked before a friends lobby opens. A real `<dialog>`, so the
 * page behind it goes inert, focus is trapped and Escape closes it without any
 * of that being hand-rolled.
 *
 * It opens pre-filled with the last name used — the common case is the same
 * person opening a second lobby, not a new one.
 */
export function NameGate({ mode, code, onSubmit, onCancel }: NameGateProps) {
  const { t } = useI18n();

  const ref = useRef<HTMLDialogElement>(null)
  const fieldId = useId()
  const [name, setName] = useState(readName)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog || dialog.open) return

    // jsdom and older engines don't all carry showModal; the dialog still has
    // to render, so fall through to the plain open attribute.
    if (typeof dialog.showModal === 'function') {
      try {
        dialog.showModal()
      } catch {
        dialog.open = true
      }
    } else {
      dialog.open = true
    }
  }, [])

  const trimmed = name.trim()
  const ready = trimmed.length >= NAME_MIN

  return (
    <dialog
      ref={ref}
      aria-label={mode === 'create' ? 'Open a lobby' : 'Join a lobby'}
      onCancel={(event) => {
        event.preventDefault()
        onCancel()
      }}
      className="gate fixed inset-0 z-50 m-0 h-full max-h-none w-full max-w-none bg-transparent p-0 text-ink"
    >
      <div className="fx fx-fade absolute inset-0 bg-shade/80" />

      <div className="relative grid h-full place-items-center p-[clamp(1rem,4vw,2rem)]">
        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (ready) onSubmit(trimmed)
          }}
          className="fx fx-soft gate-panel w-full max-w-[26rem] border border-line-strong bg-surface px-[clamp(1.25rem,4vw,2rem)] py-[clamp(1.25rem,4vw,1.875rem)]"
        >
          <div className="flex items-baseline justify-between gap-4">
            <SectionLabel>
              {mode === 'create' ? 'New lobby' : 'Joining'}
            </SectionLabel>
            <span className="tabular shrink-0 font-display text-[13px] font-medium uppercase tracking-[0.26em] text-accent">
              {code}
            </span>
          </div>

          <h2
            aria-hidden="true"
            className="mt-[clamp(0.5rem,2vh,0.875rem)] font-display text-[clamp(1.5rem,4vw,2rem)] font-bold uppercase leading-[0.95] tracking-[0.02em]"
          >{t("Your name")}</h2>

          <p className="mt-[6px] text-[11.5px] leading-[1.5] text-dim">{t("Everyone at the table sees it. It isn't saved anywhere else.")}</p>

          <label className="sr-only" htmlFor={fieldId}>{t("Your name")}</label>
          <input
            id={fieldId}
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value.slice(0, NAME_MAX))}
            placeholder={t("e.g. Alex")}
            autoComplete="given-name"
            spellCheck={false}
            className="mt-[clamp(0.75rem,2.5vh,1.125rem)] w-full rounded-sm border border-line-strong bg-ground px-4 py-[13px] font-sans text-[14px] text-ink transition-colors duration-100 ease-out hover:border-line focus:border-accent-line focus:outline-none"
          />

          <div className="mt-[clamp(0.875rem,3vh,1.375rem)] flex items-center justify-between gap-4">
            <Button
              type="button"
              variant="ghost"
              onClick={onCancel}
            >{t("Cancel")}</Button>

            <Button
              type="submit"
              variant="accent"
              size="lg"
              disabled={!ready}
            >
              {mode === 'create' ? 'Open lobby →' : 'Join lobby →'}
            </Button>
          </div>
        </form>
      </div>
    </dialog>
  )
}
