import { useEffect, useState } from 'react'
import type { DotgridFrame, Player } from '../../lib/players'
import { Crest } from '../ui/Crest'
import { Dotgrid } from './Dotgrid'

interface PlayerSpotlightProps {
  /** Whoever is selected. Only loads on selection — not on hover. */
  player: Player | null
  onDraft: () => void
  canDraft: boolean
  reason: string
  actionLabel: string
  /**
   * Which dot-grid asset to request — the panel's aspect ratio differs
   * enough between its two hosts that they're tuned as separate frames.
   */
  frame: Extract<DotgridFrame, 'spotlight-free-pick' | 'spotlight-spin'>
  /**
   * Where the panel sits and how big it is — the one thing that differs
   * between the two screens that use it. Free Pick docks it beside the pool
   * at a fixed width; Spin the Wheel gives it a whole cell of the orbit.
   */
  className?: string
}

/**
 * The panel beside the pool: one footballer's photograph, with the draft
 * action docked over the bottom of it rather than sitting in a bar of its
 * own beneath the list.
 *
 * Sizing and placement are handled entirely by the `dg-spotlight-*` CSS
 * rules in index.css — see the `.dotgrid` comment there for the crop.
 */
export function PlayerSpotlight({
  player,
  onDraft,
  canDraft,
  reason,
  actionLabel,
  frame,
  className = 'hidden w-[var(--draft-portrait)] shrink-0 lg:block',
}: PlayerSpotlightProps) {
  const [failed, setFailed] = useState(false)

  useEffect(() => setFailed(false), [player?.id])

  return (
    <div
      className={`spotlight-frame relative overflow-hidden rounded-lg border border-line bg-surface ${className}`}
    >
      {player && !failed ? (
        <Dotgrid
          key={player.id}
          player={player}
          frame={frame}
          className="fx fx-fade absolute inset-0"
          onError={() => setFailed(true)}
        />
      ) : player ? (
        // No photograph on file. The badge stands in rather than the panel
        // collapsing and taking the column width with it.
        <Crest
          key={`${player.id}-crest`}
          className="fx fx-fade absolute left-1/2 top-1/2 h-[46px] w-[46px] -translate-x-1/2 -translate-y-1/2 opacity-40"
          src={player.crest}
          alt=""
        />
      ) : null}

      {/* Named so a layout with a differently-shaped panel can deepen it — the
          orbit's portrait is wide and short, and this fade has a third of the
          height there that it has here to get out of the way of a photograph. */}
      <div className="spotlight-scrim absolute inset-x-0 bottom-0 flex flex-col gap-[8px] bg-gradient-to-t from-ground via-ground/75 to-transparent p-[14px] pt-[40px]">
        <p className="truncate text-[10.5px] leading-[1.4] text-dim">{reason}</p>
        <button
          type="button"
          onClick={onDraft}
          disabled={!canDraft}
          className="w-full shrink-0 rounded-sm border border-accent bg-accent px-[16px] py-[10px] font-display text-[12px] font-semibold uppercase tracking-[0.1em] text-accent-ink transition-[background-color,border-color,color,transform] duration-150 ease-out hover:bg-transparent hover:text-accent active:translate-y-px disabled:pointer-events-none disabled:border-line disabled:bg-transparent disabled:text-faint"
        >
          {actionLabel}
        </button>
      </div>
    </div>
  )
}
