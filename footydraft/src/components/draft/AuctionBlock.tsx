import { useEffect, useState } from 'react'
import type { Lot } from '../../lib/auctionEngine'
import type { Player } from '../../lib/players'
import { Crest } from '../ui/Crest'
import { Dotgrid } from './Dotgrid'
import { useI18n } from '../../lib/i18n'

export interface BlockResult {
  /** Null when the lot drew no bid at all and went to the unsold pile. */
  buyer: string | null
  price: number
  yours: boolean
}

interface AuctionBlockProps {
  lot: Lot
  /** How many lots come after this one. Sits at the top, per the centre stack. */
  left: number
  total: number
  /** Drawn across the photograph once the clock has run out on this lot. */
  result: BlockResult | null
}

/**
 * The player displayer — the top of the fixed centre stack, and the largest
 * surface on the screen.
 *
 * The count of what is left rides at the top of it rather than in a panel of
 * its own; the footballer is full bleed and face-anchored, in their own colour
 * with no filter over them; the opening bid sits in the caption because it is a
 * fact about this lot rather than about the bidding.
 *
 * Nothing here is a sentence. Every string is a label or a value.
 */
export function AuctionBlock({ lot, left, total, result }: AuctionBlockProps) {
  const { t } = useI18n();

  return (
    <div className="spotlight-frame relative min-h-0 flex-1 overflow-hidden rounded-lg border border-line-strong bg-surface-2">
      <BlockPhoto player={lot.player} />

      {/* The count, at the top of the displayer. */}
      <div className="auction-block-top absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-3 px-[14px] py-[10px]">
        <span className="tabular font-display text-[11px] font-medium uppercase tracking-[0.14em] text-ink">
          {t('Lot')} {lot.number} / {total}
        </span>
        <span className="tabular font-display text-[11px] font-medium uppercase tracking-[0.14em] text-accent">
          {t('{count} left', { count: left })}
        </span>
      </div>

      <div
        aria-hidden="true"
        className="absolute inset-0 z-10 bg-[linear-gradient(to_top,var(--color-ground)_1%,color-mix(in_oklab,var(--color-ground)_62%,transparent)_30%,transparent_62%)]"
      />

      <div className="absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-4 p-[clamp(12px,4.7cqh,20px)]">
        <span className="flex min-w-0 flex-col gap-[9px]">
          <span
            key={lot.player.id}
            className="fx fx-soft auction-name truncate font-display font-bold uppercase leading-[0.95] tracking-[-0.01em] text-ink"
            title={lot.player.name}
          >
            {lot.player.name}
          </span>
          <span className="flex min-w-0 items-center gap-[9px]">
            <Crest className="h-[19px] w-[19px] shrink-0" src={lot.player.crest} alt="" />
            <span className="shrink-0 font-display text-[9.5px] font-semibold uppercase tracking-[0.13em] text-accent">
              {t(lot.player.position)}
            </span>
            <span className="truncate text-[12.5px] leading-none text-muted">
              {lot.player.club} · {lot.player.nation} · {lot.player.age}
            </span>
          </span>
        </span>

        <span className="flex shrink-0 flex-col items-end gap-[5px]">
          <span className="font-display text-[8.5px] font-medium uppercase tracking-[0.22em] text-dim">{t("Open")}</span>
          <span className="money tabular auction-open font-display font-semibold leading-[0.85] text-muted">
            {lot.opening}
          </span>
        </span>
      </div>

      {result ? <Stamp result={result} /> : null}
    </div>
  )
}

/**
 * The photograph. `dg-auction-block` (index.css) crops the standardised
 * dot-grid asset to this frame's own shape — no per-player positioning left
 * to do here.
 */
function BlockPhoto({ player }: { player: Player }) {

  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [player.id])

  if (failed) {
    return (
      <Crest
        className="absolute left-1/2 top-1/2 h-[92px] w-[92px] -translate-x-1/2 -translate-y-1/2 opacity-40"
        src={player.crest}
        alt=""
      />
    )
  }

  return (
    <Dotgrid
      key={player.id}
      player={player}
      frame="auction-block"
      className="fx fx-fade absolute inset-0"
      onError={() => setFailed(true)}
    />
  )
}

/**
 * The hammer. A lot closing is the one event this screen has, and with no
 * narrator on it the event has to be drawn — so the result lands across the
 * photograph at display size and holds there while the room reads it.
 */
function Stamp({ result }: { result: BlockResult }) {
  const { t } = useI18n()

  return (
    <div className="fx fx-fade absolute inset-0 z-40 grid place-items-center bg-ground/78">
      <div className="flex flex-col items-center gap-[clamp(8px,3.8cqh,16px)]">
        <span
          className={[
            'auction-stamp font-display font-bold uppercase leading-[0.9] tracking-[0.06em]',
            result.buyer === null ? 'text-dim' : result.yours ? 'text-accent' : 'text-ink',
          ].join(' ')}
        >
          {result.buyer === null ? t('Unsold') : t('Sold')}
        </span>

        {result.buyer !== null ? (
          <span className="flex items-baseline gap-[14px]">
            <span
              className={[
                'money tabular font-display text-[clamp(20px,6.6cqh,28px)] font-semibold leading-none',
                result.yours ? 'text-accent' : 'text-ink',
              ].join(' ')}
            >
              {result.price}
            </span>
            <span className="font-display text-[clamp(11px,3.3cqh,14px)] font-medium uppercase tracking-[0.2em] text-muted">
              {result.buyer}
            </span>
          </span>
        ) : null}
      </div>
    </div>
  )
}
