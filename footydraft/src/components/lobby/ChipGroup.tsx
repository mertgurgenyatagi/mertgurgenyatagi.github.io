import type { ReactNode } from 'react'
import type { Choice } from '../../data/lobbyOptions'
import { SectionLabel } from '../ui/SectionLabel'
import { useI18n } from '../../lib/i18n'

/**
 * The workhorse of the settings half: one settable value, drawn as a row of
 * chips. Nothing moves on hover — the border and the fill change, which is the
 * same promise the format tiles on the home page make.
 */
/**
 * `unavailable` is the table-too-big state: the option exists, this many
 * drafters can't play it. It's drawn as a dashed hairline rather than a
 * removed chip, so the row keeps its shape and the option stays legible as
 * something you could have with fewer seats. A selection that *became*
 * unavailable keeps its accent so it still reads as your choice — dashed, to
 * show the choice no longer stands.
 */
export function chipClass(selected: boolean, readOnly = false, unavailable = false) {
  return [
    'rounded-sm border px-[clamp(0.5rem,1.2vw,1rem)] py-[var(--lobby-chip-py)]',
    'font-display text-[clamp(0.625rem,1vw,0.8125rem)] font-medium uppercase tracking-[0.08em]',
    'whitespace-nowrap transition-colors duration-150 ease-out',
    unavailable
      ? selected
        ? 'border-dashed border-accent-line text-faint'
        : 'border-dashed border-line text-faint'
      : selected
        ? 'border-accent bg-accent-soft text-ink'
        : readOnly
          ? 'border-line text-faint'
          : 'border-line text-muted hover:border-line-strong hover:text-ink',
  ].join(' ')
}

/**
 * Height-collapsing wrapper for the settings that only some states offer.
 *
 * The alternative — reserving the space and fading the contents — leaves a
 * hole in the column the size of a whole group, which reads as something
 * broken rather than something not offered. So this collapses instead, and
 * carries its own top spacing *inside* the collapsing box so the gap goes with
 * it. `grid-template-rows` is the one non-compositor thing on the screen; it's
 * a one-off on a small subtree, not an ambient loop.
 */
export function Collapse({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div
      inert={!open}
      className="grid transition-[grid-template-rows,opacity] duration-300 ease-out"
      style={{ gridTemplateRows: open ? '1fr' : '0fr', opacity: open ? 1 : 0 }}
    >
      <div className="overflow-hidden">{children}</div>
    </div>
  )
}

interface ChipGroupProps {
  label: string
  options: Choice[]
  value: string | null
  onChange: (id: string) => void
  /** Rendered under the chips — what the setting does, never a count. */
  note?: string
  /** Sub-selection revealed by the chosen chip. */
  children?: ReactNode
  /** The host's settings, seen from a guest's seat: shown, not offered. */
  readOnly?: boolean
  /** Options this many drafters can't play. Shown, dashed, and not selectable. */
  isUnavailable?: (id: string) => boolean
  /** Appended to an unavailable chip's accessible name, e.g. "five at the table". */
  unavailableHint?: string
  delayMs: number
}

export function ChipGroup({
  label,
  options,
  value,
  onChange,
  note,
  children,
  readOnly = false,
  isUnavailable,
  unavailableHint,
  delayMs,
}: ChipGroupProps) {
  const { t } = useI18n()

  return (
    <div className="fx fx-soft" style={{ animationDelay: `${delayMs}ms` }}>
      <SectionLabel>{label}</SectionLabel>

      <div className="mt-[var(--lobby-chip-mt)] flex flex-wrap gap-[clamp(0.25rem,0.7vw,0.5rem)]">
        {options.map((option) => {
          const unavailable = isUnavailable?.(option.id) ?? false
          const name = t(option.name)
          const label = unavailable && unavailableHint
            ? t('{name} — not available with {hint}', { name, hint: unavailableHint })
            : undefined

          return readOnly ? (
            <span
              key={option.id}
              aria-current={option.id === value ? 'true' : undefined}
              aria-label={label}
              className={chipClass(option.id === value, true, unavailable)}
            >
              {name}
            </span>
          ) : (
            <button
              key={option.id}
              type="button"
              aria-pressed={option.id === value}
              aria-label={label}
              disabled={unavailable}
              onClick={() => onChange(option.id)}
              className={chipClass(option.id === value, false, unavailable)}
            >
              {name}
            </button>
          )
        })}
      </div>

      {children}

      {/* Hidden on a short viewport — the chips have to fit first. */}
      {note ? (
        <p className="mt-[9px] hidden text-[10.5px] leading-[1.4] text-dim md:block">{note}</p>
      ) : null}
    </div>
  )
}
