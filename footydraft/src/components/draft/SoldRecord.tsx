import { useState } from 'react'
import type { Sale } from '../../lib/auctionEngine'
import type { Drafter } from '../../lib/draftEngine'
import type { Player } from '../../lib/players'
import { Dotgrid } from './Dotgrid'
import { SectionLabel } from '../ui/SectionLabel'
import { useI18n } from '../../lib/i18n'

interface SoldRecordProps {
  sales: Sale[]
  drafters: Drafter[]
  youSeat: number
  /** How many cards fit the rail. Two columns, so an even number reads best. */
  show?: number
}

/**
 * What has already gone — the left rail, and the only record of the auction's
 * own history on the screen.
 *
 * **A sold lot is a transaction, and the card is drawn as one.** The
 * photograph is a strip along the top rather than a square: enough to see who
 * it was, not so much that it crowds out the two facts the record actually
 * exists to carry — **who bought them and for how much** — which now take the
 * body of the card at the size the face used to have. The club crest is gone
 * entirely; it was a third identifier for a footballer already named twice,
 * and it was the smallest, busiest thing in the rail.
 *
 * An unsold lot stays in the record rather than disappearing — passing on a
 * footballer is a real event *(R8-Q4)*, and a record that only listed sales
 * would quietly rewrite what happened. It is dimmed whole.
 */
export function SoldRecord({ sales, drafters, youSeat, show = 4 }: SoldRecordProps) {
  const { t } = useI18n();

  const recent = sales.slice(-show).reverse()

  return (
    <section className="flex shrink-0 flex-col gap-[10px]">
      <div className="flex items-baseline justify-between gap-3">
        <SectionLabel>{t("Sold")}</SectionLabel>
        <span className="tabular font-display text-[9.5px] font-medium uppercase tracking-[0.16em] text-dim">
          {sales.length}
        </span>
      </div>

      {recent.length === 0 ? (
        <p className="text-[11px] leading-[1.4] text-faint">{t("Nothing has gone yet.")}</p>
      ) : (
        <ul className="auction-sold">
          {recent.map((sale) => {
            const mine = sale.seat === youSeat
            const buyer = sale.seat === null ? null : (drafters[sale.seat] ?? null)

            return (
              <li
                key={sale.lot}
                className={[
                  'fx fx-soft flex flex-col overflow-hidden rounded-md border bg-surface',
                  buyer === null ? 'border-line opacity-40' : mine ? 'border-accent-line' : 'border-line',
                ].join(' ')}
              >
                <SoldFace player={sale.player} />

                <span className="flex flex-col gap-[4px] px-[8px] pb-[8px] pt-[6px]">
                  <span className="truncate font-display text-[11px] font-medium uppercase leading-none tracking-[0.04em] text-muted">
                    {sale.player.surname}
                  </span>

                  <span
                    className={[
                      'money tabular truncate font-display text-[17px] font-semibold leading-[0.9]',
                      buyer === null ? 'text-dim' : mine ? 'text-accent' : 'text-ink',
                    ].join(' ')}
                  >
                    {buyer === null ? '' : sale.price}
                  </span>

                  <span
                    className={[
                      'truncate font-display text-[10.5px] font-semibold uppercase leading-none tracking-[0.12em]',
                      mine ? 'text-accent' : buyer === null ? 'text-dim' : 'text-muted',
                    ].join(' ')}
                  >
                    {buyer === null ? t('Unsold') : buyer.name}
                  </span>
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

/** Same silent-hide-on-failure the card used with a bare `<img>` — the card's
 * own surname beneath it is label enough without this photo. */
function SoldFace({ player }: { player: Player }) {

  const [failed, setFailed] = useState(false)

  if (failed) return null

  return (
    <span className="auction-sold-face block w-full overflow-hidden bg-surface-2">
      <Dotgrid
        player={player}
        frame="sold-record-face"
        className="h-full w-full"
        onError={() => setFailed(true)}
      />
    </span>
  )
}
