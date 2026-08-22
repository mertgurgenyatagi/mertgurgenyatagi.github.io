import { type ReactNode, useEffect, useRef } from 'react'
import type { PositionCode } from '../../data/formation'
import type { Player } from '../../lib/players'
import { Crest } from '../ui/Crest'
import { SectionLabel } from '../ui/SectionLabel'
import { PositionSelect } from './PositionSelect'
import { useI18n } from '../../lib/i18n'

interface WheelPoolProps {
  /** `Serie A · open slots`, or whose open slots it is when it is not yours. */
  title: string
  rows: Player[]
  query: string
  onQuery: (value: string) => void
  filter: PositionCode | null
  onFilter: (value: PositionCode | null) => void
  /** Positions still open in the eleven this pool is being read against. */
  positions: PositionCode[]
  selectedId: string | null
  onSelect: (id: string) => void
  onDraft: () => void
  canDraft: boolean
  reason: string
  actionLabel: string
  /** The wheel has not stopped yet, so there is nothing to list. */
  spinning: boolean
  /** The portrait panel, drawn beside the list rather than above it — same
      placement as Free Pick's pool. */
  portrait: ReactNode
}

/**
 * Everyone the wheel just put in front of the drafter on the clock, A–Z.
 *
 * Twice narrowed before it ever reaches the screen: by whichever slice the
 * wheel stopped on, and by which slots that drafter still has open. So unlike
 * Free Pick's pool there is nothing here to strike through — a footballer who
 * cannot be taken is not in this category or not in this shape, and either way
 * the wheel is what says so.
 *
 * The search field and the position dropdown are what narrow it further. Both
 * reset to the top of the list when they change, because a filtered list left
 * scrolled where the old one was shows you the middle of a result set you
 * never asked about.
 */
export function WheelPool({
  title,
  rows,
  query,
  onQuery,
  filter,
  onFilter,
  positions,
  selectedId,
  onSelect,
  onDraft,
  canDraft,
  reason,
  actionLabel,
  spinning,
  portrait,
}: WheelPoolProps) {
  const { t } = useI18n();

  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // The field draws a slash key, so it had better honour one.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return
      event.preventDefault()
      searchRef.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0
  }, [query, filter, title])

  return (
    <section className="spin-panel flex min-h-0 flex-1 flex-col p-[14px]">
      <SectionLabel className="shrink-0 truncate">{title}</SectionLabel>

      {/* Both controls go quiet while the wheel is still turning: there is no
          list yet to narrow, and a position dropdown holding nothing but its
          own default is a control that lies about what it can do. */}
      <div
        className={[
          'mt-[11px] flex shrink-0 flex-wrap items-center gap-[8px] transition-opacity duration-200 ease-out',
          spinning ? 'pointer-events-none opacity-40' : '',
        ].join(' ')}
        aria-hidden={spinning}
      >
        <div className="flex min-w-[112px] flex-1 items-center gap-[8px] rounded-sm border border-line bg-ground/60 px-[11px] py-[8px] transition-colors duration-150 ease-out focus-within:border-accent-line">
          <span aria-hidden="true" className="text-[11px] leading-none text-accent">
            &#8981;
          </span>
          <label className="sr-only" htmlFor="wheel-search">{t("Search this category")}</label>
          <input
            ref={searchRef}
            id="wheel-search"
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder={t("Name, club or nation")}
            autoComplete="off"
            disabled={spinning}
            className="min-w-0 flex-1 bg-transparent text-[11.5px] text-ink outline-none"
          />
          <span
            aria-hidden="true"
            className="shrink-0 rounded-[4px] border border-line px-[4px] py-px font-display text-[9px] leading-[1.4] text-dim"
          >
            /
          </span>
        </div>

        <PositionSelect
          value={filter}
          onChange={onFilter}
          options={positions}
          disabled={spinning}
        />
      </div>

      <div className="mt-[11px] flex min-h-0 flex-1 items-stretch gap-[14px]">
        <div
          ref={listRef}
          className="scroller min-h-0 min-w-0 flex-1 overflow-y-auto border-t border-line lg:flex-[65]"
        >
          {spinning ? (
            <p className="pt-[13px] text-[11.5px] text-faint">{t("The wheel is still turning.")}</p>
          ) : rows.length === 0 ? (
            <p className="pt-[13px] text-[11.5px] text-faint">{t("Nobody here matches that.")}</p>
          ) : (
            <ul key={title} className="fx fx-soft">
              {rows.map((player) => {
                const selected = player.id === selectedId
                return (
                  <li key={player.id} className="wheel-row">
                    <button
                      type="button"
                      onClick={() => onSelect(player.id)}
                      onDoubleClick={() => {
                        if (canDraft) onDraft()
                      }}
                      /* Untransitioned, same reasoning as the Free Pick pool:
                         the colour lands at once rather than costing the row
                         nine repaints on the way through. */
                      className={[
                        'flex w-full items-center gap-[11px] border-b border-line px-[7px] py-[10.5px] text-left',
                        selected ? 'bg-accent-soft' : 'hover:bg-surface-2',
                      ].join(' ')}
                    >
                      {/* The code, not the position's full name: this list is
                          already only positions you have open, so the tag is
                          telling you which hole it fills rather than what the
                          footballer is. */}
                      <span className="w-[32px] shrink-0 font-display text-[11px] font-semibold uppercase leading-none tracking-[0.11em] text-accent">
                        {player.position}
                      </span>
                      <Crest className="h-[21px] w-[21px] shrink-0" src={player.crest} alt="" />
                      <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium leading-none text-ink">
                        {player.name}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {portrait}
      </div>

      {/* Above lg the portrait panel carries the action, same as Free Pick's
          pool. Below it there is no portrait, so the button docks here rather
          than disappearing. */}
      <div className="mt-[11px] flex shrink-0 items-center justify-between gap-4 border-t border-line pt-[10px] lg:hidden">
        <p className="min-w-0 truncate text-[11px] text-dim">{reason}</p>
        <button
          type="button"
          onClick={onDraft}
          disabled={!canDraft}
          className="shrink-0 rounded-sm border border-accent bg-accent px-[9px] py-[4px] font-display text-[11.5px] font-semibold uppercase tracking-[0.1em] text-accent-ink transition-[background-color,border-color,color,transform] duration-150 ease-out hover:bg-transparent hover:text-accent active:translate-y-px disabled:pointer-events-none disabled:border-line disabled:bg-transparent disabled:text-faint"
        >
          {actionLabel}
        </button>
      </div>
    </section>
  )
}
