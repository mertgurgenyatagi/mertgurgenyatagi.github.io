import { useEffect, useId, useRef, useState } from 'react'
import { type PositionCode, positionNames } from '../../data/formation'
import { useI18n } from '../../lib/i18n'

interface PositionSelectProps {
  value: PositionCode | null
  onChange: (value: PositionCode | null) => void
  /** The positions still open in the eleven the pool is being read against. */
  options: PositionCode[]
  disabled?: boolean
}

const ALL = 'All positions'

/**
 * The position filter, as one dropdown rather than a row of chips.
 *
 * A row of ten chips is the right control when every one of them is always
 * live — which is what Free Pick's pool is. Here the pool is already twice
 * narrowed, by the wheel and by the shape of your own eleven, so most of
 * those chips would be dead most of the time. A dropdown that lists only the
 * positions actually open states the same thing in one line.
 *
 * Hand-rolled rather than a native `<select>`: the native control paints its
 * own list in the platform's colours, which on a near-black page is a white
 * slab. This is a listbox with the keyboard behaviour that implies — arrows
 * move, Enter takes, Escape closes without changing anything.
 */
export function PositionSelect({
  value,
  onChange,
  options,
  disabled = false,
}: PositionSelectProps) {
  const { t } = useI18n();

  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  const choices: (PositionCode | null)[] = [null, ...options]
  const label = value ? positionNames[value] : ALL

  useEffect(() => {
    if (disabled) setOpen(false)
  }, [disabled])

  useEffect(() => {
    if (!open) return

    const onPointer = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', onPointer)
    return () => window.removeEventListener('pointerdown', onPointer)
  }, [open])

  // Opening on the current value is the difference between a list you read and
  // a list you have to find your place in.
  useEffect(() => {
    if (open) setActive(Math.max(0, choices.indexOf(value)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const take = (choice: PositionCode | null) => {
    onChange(choice)
    setOpen(false)
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      setOpen(false)
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) {
        setOpen(true)
        return
      }
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActive((index) => (index + step + choices.length) % choices.length)
      return
    }
    if (open && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault()
      take(choices[active] ?? null)
    }
  }

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={onKeyDown}
        className={[
          'flex w-full items-center justify-between gap-[10px] border px-[11px] py-[8px] font-display text-[11.5px] font-medium uppercase tracking-[0.08em] transition-colors duration-150 ease-out',
          open || value ? 'border-accent-line text-accent' : 'border-line text-muted hover:text-ink',
        ].join(' ')}
      >
        <span className="truncate">{label}</span>
        <span aria-hidden="true" className={`select-caret ${open ? 'select-caret-open' : ''}`} />
      </button>

      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={t("Filter by position")}
          className="select-list fx fx-soft scroller"
        >
          {choices.map((choice, index) => (
            <li key={choice ?? 'all'}>
              <button
                type="button"
                role="option"
                aria-selected={choice === value}
                onPointerEnter={() => setActive(index)}
                onClick={() => take(choice)}
                className={[
                  'flex w-full items-center gap-[9px] px-[11px] py-[7px] text-left transition-colors duration-100 ease-out',
                  index === active ? 'rounded-[6px] bg-accent-soft' : '',
                ].join(' ')}
              >
                <span
                  className={[
                    'w-[34px] shrink-0 font-display text-[10.5px] font-semibold uppercase tracking-[0.1em]',
                    choice === value ? 'text-accent' : 'text-dim',
                  ].join(' ')}
                >
                  {choice ?? 'All'}
                </span>
                <span
                  className={[
                    'truncate text-[11.5px]',
                    choice === value ? 'text-ink' : 'text-muted',
                  ].join(' ')}
                >
                  {choice ? positionNames[choice] : ALL}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
