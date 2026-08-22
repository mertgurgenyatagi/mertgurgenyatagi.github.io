import { useI18n } from '../lib/i18n'
import { formation } from '../data/formation'
import type { Drafter, Squad } from '../lib/draftEngine'
import type { Player } from '../lib/players'
import { Crest } from '../components/ui/Crest'
import { BackHome } from '../components/ui/BackHome'
import { LanguageSwitch } from '../components/ui/LanguageSwitch'

interface SquadCompareProps {
  drafters: Drafter[]
  squads: Squad[]
}

/**
 * Post-draft: every squad on screen at once, side by side, shrunk to fit.
 *
 * The rule is no scroll ever. With up to five drafters that means each pitch
 * gets as narrow as it needs to be. The pitch proportions (68:105) hold at
 * every width — CSS container aspect-ratio keeps them honest — and the node
 * size floats to fill the available height via `cqh` on the parent container.
 *
 * No numbers, no rank, no leaderboard. The squads speak for themselves.
 */
export function SquadCompare({ drafters, squads }: SquadCompareProps) {
  const { t } = useI18n()

  return (
    <div className="squad-compare flex h-full w-full flex-col px-[var(--app-inset-x)] py-[var(--app-inset-y)]">
      {/* Header bar — same shape as the draft screen's bar */}
      <div className="fx fx-soft flex shrink-0 items-center justify-between gap-5 border-b border-line py-[12px]">
        <BackHome />
        <p className="font-display text-[13px] font-medium uppercase tracking-[0.18em] text-muted">
          {t("The elevens")}
        </p>
        <LanguageSwitch />
      </div>

      {/* Pitches — equal columns, all visible, no scroll */}
      <div
        className="squad-compare-grid min-h-0 flex-1 pt-[16px]"
        style={{ '--drafter-count': drafters.length } as React.CSSProperties}
      >
        {drafters.map((drafter, seat) => (
          <Pitch
            key={drafter.id}
            drafter={drafter}
            squad={squads[seat] ?? {}}
          />
        ))}
      </div>
    </div>
  )
}

function Pitch({ drafter, squad }: { drafter: Drafter; squad: Squad }) {
  return (
    <div className="squad-pitch flex min-h-0 flex-col items-center gap-[8px]">
      {/* Drafter name above the pitch */}
      <p
        className={[
          'shrink-0 truncate font-display text-[clamp(9px,1.4cqh,13px)] font-medium uppercase tracking-[0.14em]',
          drafter.kind === 'you' ? 'text-accent' : 'text-muted',
        ].join(' ')}
      >
        {drafter.name}
      </p>

      {/* The pitch itself, at real proportions */}
      <div className="relative min-h-0 flex-1" style={{ aspectRatio: '68 / 105' }}>
        <PitchMarkings />
        {formation.map((slot) => {
          const player = squad[slot.id] ?? null
          return (
            <CompareNode
              key={slot.id}
              x={slot.x}
              y={slot.y}
              position={slot.position}
              player={player}
            />
          )
        })}
      </div>
    </div>
  )
}

function PitchMarkings() {
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
      <rect x="13.84" y="0.2" width="40.32" height="16.5" />
      <rect x="24.84" y="0.2" width="18.32" height="5.5" />
      <circle cx="34" cy="11" r="0.5" fill="var(--color-line-strong)" stroke="none" />
      <path d="M 26.7 16.7 A 9.15 9.15 0 0 0 41.3 16.7" />
      <rect x="13.84" y="88.3" width="40.32" height="16.5" />
      <rect x="24.84" y="99.3" width="18.32" height="5.5" />
      <circle cx="34" cy="94" r="0.5" fill="var(--color-line-strong)" stroke="none" />
      <path d="M 26.7 88.3 A 9.15 9.15 0 0 1 41.3 88.3" />
    </svg>
  )
}

function CompareNode({
  x,
  y,
  position,
  player,
}: {
  x: number
  y: number
  position: string
  player: Player | null
}) {
  return (
    <div
      className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-[3px]"
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      <span
        className={[
          'grid place-items-center overflow-hidden rounded-full transition-colors duration-300 ease-out',
          'h-[var(--compare-node)] w-[var(--compare-node)]',
          player
            ? 'border border-line-strong bg-surface-2'
            : 'border border-dashed border-line bg-ground/70',
        ].join(' ')}
      >
        {player ? (
          <Crest
            className="h-[62%] w-[62%]"
            src={player.crest}
            alt={player.club}
          />
        ) : (
          <span className="font-display text-[length:var(--compare-pos-size)] font-medium uppercase leading-none tracking-[0.06em] text-dim">
            {position}
          </span>
        )}
      </span>

      {player ? (
        <span
          className="max-w-[var(--compare-name)] truncate rounded-sm bg-ground/85 px-[3px] py-[1px] font-display text-[length:var(--compare-name-size)] font-medium uppercase leading-none tracking-[0.03em] text-ink"
          title={player.name}
        >
          {player.surname}
        </span>
      ) : null}
    </div>
  )
}
