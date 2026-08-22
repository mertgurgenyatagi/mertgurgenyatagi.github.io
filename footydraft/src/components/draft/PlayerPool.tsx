import { type ReactNode, useEffect, useRef } from 'react'
import { type PositionCode, positionCodes, positionNames } from '../../data/formation'
import type { Player } from '../../lib/players'
import { Crest } from '../ui/Crest'
import { useI18n } from '../../lib/i18n'

export interface PoolRow {
  player: Player
  /** Null when they are yours to take. Otherwise the reason, printed on the row. */
  blocked: string | null
}

interface PlayerPoolProps {
  rows: PoolRow[]
  query: string
  onQuery: (value: string) => void
  filter: PositionCode | null
  onFilter: (value: PositionCode | null) => void
  /** Positions whose slot is already full in your eleven, dimmed in the filter row. */
  filled: ReadonlySet<PositionCode>
  selectedId: string | null
  onSelect: (id: string) => void
  onDraft: () => void
  canDraft: boolean
  /** The line at the bottom left — why the button is off, or where the pick lands. */
  reason: string
  actionLabel: string
  /** The portrait panel, drawn beside the list rather than above it. */
  portrait: ReactNode
}

/**
 * Section 03 — everyone still on the board, A to Z.
 *
 * Not by ability. An ability-derived ranking leaks exactly the data-model fact
 * this app keeps off screen, and hiding the number while sorting by it is a
 * distinction without a difference. Alphabetical is neutral; the search field
 * and the position row are what actually narrow it.
 *
 * A footballer you cannot take stays in the list, dimmed whole and struck
 * through, captioned with what stops you. Seeing the best names left crossed
 * out is what makes a per-squad constraint legible without a paragraph
 * explaining it — remove them and the pool just looks smaller for no stated
 * reason.
 */
export function PlayerPool({
  rows,
  query,
  onQuery,
  filter,
  onFilter,
  filled,
  selectedId,
  onSelect,
  onDraft,
  canDraft,
  reason,
  actionLabel,
  portrait,
}: PlayerPoolProps) {
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

  // A narrowed list left scrolled where the old one was shows you the middle of
  // a result set you never asked about.
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0
  }, [query, filter])

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-[16px]">
        <div className="flex min-w-0 flex-1 basis-[25%] items-center gap-[10px] rounded-sm border border-line bg-ground/60 px-[13px] py-[8px] transition-colors duration-150 ease-out focus-within:border-accent-line">
          <span aria-hidden="true" className="text-[12px] leading-none text-accent">
            &#8981;
          </span>
          <label className="sr-only" htmlFor="pool-search">{t("Search the board")}</label>
          <input
            ref={searchRef}
            id="pool-search"
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder={t("Name, club or nation")}
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent text-[12px] text-ink outline-none"
          />
          <span
            aria-hidden="true"
            className="shrink-0 rounded-[4px] border border-line px-[5px] py-px font-display text-[9px] leading-[1.4] text-dim"
          >
            /
          </span>
        </div>

        <div className="flex min-w-0 flex-1 basis-[75%] flex-wrap items-center gap-x-[14.9px] gap-y-[7.4px]">
          <FilterChip active={filter === null} onClick={() => onFilter(null)}>{t("All")}</FilterChip>
          {positionCodes.map((code) => (
            <FilterChip
              key={code}
              active={filter === code}
              spent={filled.has(code)}
              onClick={() => onFilter(filter === code ? null : code)}
            >
              {code}
            </FilterChip>
          ))}
        </div>
      </div>

      <div className="mt-[11px] flex min-h-0 flex-1 items-stretch gap-[14px]">
      <div
        ref={listRef}
        className="scroller min-h-0 min-w-0 flex-1 overflow-y-auto border-t border-line"
      >
        {rows.length === 0 ? (
          <p className="pt-[14px] text-[11.5px] text-faint">{t("Nobody on the board matches that.")}</p>
        ) : (
          <ul>
            {rows.map(({ player, blocked }) => {
              const selected = player.id === selectedId
              return (
                <li key={player.id} className="pool-row">
                  <button
                    type="button"
                    onClick={() => onSelect(player.id)}
                    onDoubleClick={() => {
                      if (!blocked && canDraft) onDraft()
                    }}
                    /* No transition on the hover fill, deliberately: a 150ms
                       ease is nine repaints of the row instead of one, times
                       four hundred rows you sweep the pointer straight
                       through. The colour lands immediately instead. */
                    className={[
                      'flex w-full items-center gap-[14.5px] border-b border-line px-[8px] py-[15px] text-left',
                      blocked ? 'opacity-[0.34]' : selected ? 'bg-accent-soft' : 'hover:bg-surface',
                    ].join(' ')}
                  >
                    <Crest className="h-[25.5px] w-[25.5px] shrink-0" src={player.crest} alt="" />

                    <span className="flex min-w-0 flex-1 flex-col gap-[2.5px]">
                      <span
                        className={[
                          'truncate font-display text-[16.5px] font-medium uppercase leading-none tracking-[0.02em]',
                          blocked ? 'text-muted line-through decoration-1' : 'text-ink',
                        ].join(' ')}
                      >
                        {player.name}
                      </span>
                      <span className="truncate text-[13px] leading-none text-dim">{blocked}</span>
                    </span>

                    <span className="max-w-[128px] shrink-0 truncate text-right font-display text-[12.75px] font-medium uppercase tracking-[0.06em] text-muted">
                      {positionNames[player.position]}
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

      {/* Below lg there is no hero image to carry the button, so it stays
          docked here — the only place left for it once the portrait is gone. */}
      <div className="mt-[12px] flex shrink-0 items-center justify-between gap-4 pt-[10px] lg:hidden">
        <p className="min-w-0 truncate text-[11px] text-dim">{reason}</p>
        <button
          type="button"
          onClick={onDraft}
          disabled={!canDraft}
          className="shrink-0 rounded-sm border border-accent bg-accent px-[22px] py-[10px] font-display text-[12px] font-semibold uppercase tracking-[0.1em] text-accent-ink transition-[background-color,border-color,color,transform] duration-150 ease-out hover:bg-transparent hover:text-accent active:translate-y-px disabled:pointer-events-none disabled:border-line disabled:bg-transparent disabled:text-faint"
        >
          {actionLabel}
        </button>
      </div>
    </section>
  )
}

function FilterChip({
  active,
  spent = false,
  onClick,
  children,
}: {
  active: boolean
  spent?: boolean
  onClick: () => void
  children: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'border-b px-[8.9px] py-[6px] font-display text-[15.6px] font-medium uppercase leading-none tracking-[0.04em] transition-colors duration-150 ease-out',
        active
          ? 'border-accent text-accent'
          : spent
            ? 'border-transparent text-faint hover:text-dim'
            : 'border-transparent text-dim hover:text-ink',
      ].join(' ')}
    >
      {children}
    </button>
  )
}
