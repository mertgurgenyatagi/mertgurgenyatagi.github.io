import { useEffect, useState } from 'react'
import { type FormationSlot, formation } from '../../data/formation'
import type { Drafter, Squad } from '../../lib/draftEngine'
import type { Player } from '../../lib/players'
import { Crest } from '../ui/Crest'
import { Dotgrid } from './Dotgrid'
import { useI18n } from '../../lib/i18n'

interface PitchViewProps {
  drafters: Drafter[]
  /** Which board is on the pitch. Not necessarily whose turn it is. */
  tab: number
  onTab: (seat: number) => void
  squad: Squad
  /** Where the pick would land, on your own board only. */
  pending: FormationSlot | null
  /** Drawn faintly in the pending slot while you are deciding. */
  preview: Player | null
  /** Fades in the node that has just arrived. */
  lastArrival: string | null
}

/**
 * Section 04 — the elevens, drawn as a pitch rather than as a list.
 *
 * A list of eleven rows tells you what you own. A pitch tells you what you have
 * built: that the left of your defence is empty, that you are three deep in
 * midfield and have nobody to pass to. That reading is the whole job of this
 * column, and a stack of labelled rows cannot do it.
 *
 * The tabs are how far the room is exposed. Every drafter's board is open to
 * everyone all the way through — no reveal, no delay, no fog. A draft where you
 * cannot see what the others are building is a draft where the only strategy is
 * taking the best name left, which is the format this app is trying not to be.
 */
export function PitchView({
  drafters,
  tab,
  onTab,
  squad,
  pending,
  preview,
  lastArrival,
}: PitchViewProps) {
  const { t } = useI18n();

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div
        role="tablist"
        aria-label={t("Whose eleven to show")}
        className="flex shrink-0 items-center gap-[2px] border-b border-line"
      >
        {drafters.map((drafter, seat) => (
          <button
            key={drafter.id}
            type="button"
            role="tab"
            aria-selected={seat === tab}
            onClick={() => onTab(seat)}
            className={[
              'min-w-0 flex-1 truncate border-b px-[4px] pb-[7px] font-display text-[10px] font-medium uppercase leading-none tracking-[0.12em] transition-colors duration-150 ease-out',
              seat === tab
                ? 'border-accent text-ink'
                : 'border-transparent text-dim hover:text-muted',
            ].join(' ')}
          >
            {drafter.name}
          </button>
        ))}
      </div>

      {/* Keyed on the tab so switching boards cross-fades rather than cutting.
          Eleven nodes swapping at once is the largest single change on any of
          these screens, and it was the one that happened without a transition. */}
      <div key={tab} className="fx fx-fade mt-[16px] flex min-h-0 flex-1 items-start justify-center">
        <div className="relative h-full max-h-full" style={{ aspectRatio: '68 / 105' }}>
          <Markings />

          {formation.map((slot) => {
            const player = squad[slot.id]
            const isPending = pending?.id === slot.id
            return (
              <Node
                key={slot.id}
                slot={slot}
                player={player ?? null}
                pending={isPending}
                preview={isPending ? preview : null}
                arrived={Boolean(player && player.id === lastArrival)}
              />
            )
          })}
        </div>
      </div>
    </section>
  )
}

/**
 * The pitch itself, at real proportions — 68 by 105 metres, so the centre circle
 * is a circle and the boxes are the size they are on a Saturday. Hairlines in
 * the line colour, no green: the ground under this app is petrol, and a strip of
 * turf dropped into it would be the one lit object on a dark page.
 */
function Markings() {

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 68 105"
      className="absolute inset-0 h-full w-full"
      fill="none"
      stroke="var(--color-line-strong)"
      strokeWidth="0.4"
      vectorEffect="non-scaling-stroke"
    >
      <rect x="0.2" y="0.2" width="67.6" height="104.6" />
      <line x1="0.2" y1="52.5" x2="67.8" y2="52.5" />
      <circle cx="34" cy="52.5" r="9.15" />
      <circle cx="34" cy="52.5" r="0.5" fill="var(--color-line-strong)" stroke="none" />

      {/* Attacking end, top. */}
      <rect x="13.84" y="0.2" width="40.32" height="16.5" />
      <rect x="24.84" y="0.2" width="18.32" height="5.5" />
      <circle cx="34" cy="11" r="0.5" fill="var(--color-line-strong)" stroke="none" />
      <path d="M 26.7 16.7 A 9.15 9.15 0 0 0 41.3 16.7" />

      {/* Your own end, bottom. */}
      <rect x="13.84" y="88.3" width="40.32" height="16.5" />
      <rect x="24.84" y="99.3" width="18.32" height="5.5" />
      <circle cx="34" cy="94" r="0.5" fill="var(--color-line-strong)" stroke="none" />
      <path d="M 26.7 88.3 A 9.15 9.15 0 0 1 41.3 88.3" />
    </svg>
  )
}

function Node({
  slot,
  player,
  pending,
  preview,
  arrived,
}: {
  slot: FormationSlot
  player: Player | null
  pending: boolean
  preview: Player | null
  arrived: boolean
}) {

  const shown = player ?? preview
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [player?.id])

  return (
    <div
      className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-[5px]"
      style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
    >
      <span
        className={[
          'grid h-[var(--draft-node)] w-[var(--draft-node)] place-items-center overflow-hidden rounded-full transition-colors duration-300 ease-out',
          player
            ? 'border border-line-strong bg-surface-2'
            : pending
              ? 'border border-dashed border-accent-line bg-accent-ink'
              : 'border border-dashed border-line bg-ground/70',
        ].join(' ')}
      >
        {shown && !failed ? (
          <Dotgrid
            key={shown.id}
            player={shown}
            frame="pitch-node"
            className={`h-full w-full ${arrived ? 'fx fx-pop' : ''}`}
            onError={() => setFailed(true)}
          />
        ) : shown ? (
          <Crest
            key={`${shown.id}-crest`}
            className={`h-[62%] w-[62%] ${arrived ? 'fx fx-pop' : ''}`}
            src={shown.crest}
            alt={shown.club}
          />
        ) : (
          <span
            className={[
              'font-display text-[9px] font-medium uppercase leading-none tracking-[0.06em]',
              pending ? 'text-accent' : 'text-dim',
            ].join(' ')}
          >
            {slot.position}
          </span>
        )}
      </span>

      {/* The name only ever sits on its own backing — a surname straight on the
          markings is a surname with a hairline through it. */}
      {shown ? (
        <span
          key={shown.id}
          className={[
            'pitch-name max-w-[var(--draft-name)] truncate rounded-sm bg-ground/85 px-[4px] py-[2px] font-display text-[length:var(--draft-name-size)] font-medium uppercase leading-none tracking-[0.03em]',
            player ? 'text-ink' : 'text-accent',
            arrived ? 'fx fx-soft' : '',
          ].join(' ')}
          title={shown.name}
        >
          {shown.surname}
        </span>
      ) : null}
    </div>
  )
}
