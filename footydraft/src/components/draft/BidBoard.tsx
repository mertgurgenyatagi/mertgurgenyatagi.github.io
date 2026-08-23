import { BID_STEPS } from '../../lib/auctionEngine'
import type { Drafter } from '../../lib/draftEngine'
import { useI18n } from '../../lib/i18n'

interface BidBoardProps {
  drafters: Drafter[]
  youSeat: number
  /** Who holds the lot, or null while it is still at its opening price. */
  holder: number | null
  price: number
  /** The last figure each seat put up on this lot. */
  bids: Record<number, number>
  /** Seats that are out of this lot — priced out, or passed by hand. */
  out: number[]
  budgets: number[]
  seconds: number
  limit: number
  /** Bumped by every bid, so the drain restarts rather than easing back. */
  resetKey: number
  live: boolean
  /**
   * False for the first few seconds of every countdown — see the lockout note
   * in `AuctionDraft`. Nobody can raise while it is false, the room included.
   */
  armed: boolean
  onBid: (step: number) => void
  /** Standing down from this lot. See the pass rule in `auctionEngine`. */
  onPass: () => void
}

/**
 * Everything under the displayer: the countdown, the table's bids side by
 * side with your budget beside them, and the controls.
 *
 * **The steps say only what they are.** They used to carry a second line
 * naming the price the raise lands on, which was a defensible thing to want
 * and an indefensible thing to read: two figures on one button, the smaller of
 * them in ten-pixel type, against a clock. `+5`, `+10`, `+25`, at size, and
 * nothing else *(2026-08-23)*.
 *
 * **Your budget takes the room the bid cards do not.** Below five drafters the
 * row of bids left a third of the screen's width empty, next to a screen whose
 * every decision is "can I afford this". The figure is sized off its own cell,
 * so it is enormous at two drafters and merely large at five rather than
 * needing a different layout for each.
 *
 * **Pass is a control again** *(set by Mert, 2026-08-23)*. It was cut on
 * 2026-08-22 on the reasoning that a seat which stops bidding has already
 * passed — true, but it left no way to *say so*, and therefore no way for a
 * lot to close early when the room had plainly finished with it. Passing is
 * final for the lot: that is what lets the hammer fall the moment everybody
 * but the holder has stood down.
 */
export function BidBoard({
  drafters,
  youSeat,
  holder,
  price,
  bids,
  out,
  budgets,
  seconds,
  limit,
  resetKey,
  live,
  armed,
  onBid,
  onPass,
}: BidBoardProps) {
  const { t } = useI18n();

  const held = holder !== null
  const youHold = holder === youSeat
  const youOut = out.includes(youSeat)
  const yourBudget = budgets[youSeat] ?? 0

  /* The first bid on a lot is exactly at the opening price, so the three steps
     are redundant until somebody has taken it and mask down to a single bid. */
  const offers = held
    ? BID_STEPS.map((step) => ({ step, lands: price + step }))
    : [{ step: 0, lands: price }]

  const canRaise = live && armed && !youHold && !youOut
  const canPass = live && !youHold && !youOut
  /** Whole seconds still to run on the lockout, for the line that names it. */
  const opensIn = Math.max(0, Math.ceil(seconds - (limit - LOCKOUT)))

  const note = !live
    ? ''
    : youHold
      ? t('You hold this lot.')
      : youOut
        ? t('You have passed on this lot.')
        : !armed
          ? t('Bidding opens in {seconds}', { seconds: opensIn })
          : ''

  return (
    <div className="flex shrink-0 flex-col">
      {/* ---- The clock, and how much of it is left. ---- */}
      <div className="mt-[clamp(10px,2cqh,16px)] flex items-center gap-[16px]">
        <span
          className={[
            'tabular auction-clock shrink-0 font-display font-semibold leading-[0.8]',
            live && seconds <= 5 ? 'narrator-pulse text-accent' : 'text-accent',
          ].join(' ')}
        >
          {String(Math.max(0, Math.ceil(seconds))).padStart(2, '0')}
        </span>

        <span className="h-[3px] min-w-0 flex-1 overflow-hidden bg-line">
          <span
            key={resetKey}
            className="auction-drain block h-full w-full bg-accent"
            style={{ animationDuration: `${limit}s`, animationPlayState: live ? 'running' : 'paused' }}
          />
        </span>
      </div>

      {/* ---- The table, side by side, with what each of them has said — and
              your own budget filling whatever they leave over. ---- */}
      <div
        className="auction-bidrow mt-[clamp(9px,1.7cqh,14px)]"
        style={{ '--auction-seats': drafters.length } as React.CSSProperties}
      >
        <ul className="auction-bids">
          {drafters.map((drafter, seat) => {
            const high = seat === holder
            const passed = out.includes(seat)
            const bid = bids[seat]

            return (
              <li
                key={drafter.id}
                className={[
                  'auction-bid-card relative flex min-w-0 flex-col gap-[5px] rounded-md border px-[10px] pb-[8px] pt-[9px] transition-colors duration-300 ease-out',
                  high
                    ? 'border-accent bg-accent-soft'
                    : seat === youSeat
                      ? 'border-line-strong bg-surface'
                      : 'border-line bg-surface',
                  passed && !high ? 'opacity-40' : '',
                ].join(' ')}
              >
                <span
                  className={[
                    'flex items-center gap-[6px] truncate whitespace-nowrap text-[11.5px] font-medium leading-none',
                    high || seat === youSeat ? 'text-ink' : 'text-muted',
                  ].join(' ')}
                >
                  <Disc drafter={drafter} tone={high ? 'lead' : seat === youSeat ? 'you' : 'plain'} />
                  <span className="truncate">{drafter.name}</span>
                </span>

                <span
                  key={`${bid ?? 'none'}-${resetKey}`}
                  className={[
                    'tabular auction-bid fx fx-soft font-display font-semibold leading-[0.85]',
                    bid === undefined ? 'text-faint' : high ? 'money text-accent' : 'money text-dim',
                  ].join(' ')}
                >
                  {bid === undefined ? '—' : bid}
                </span>

                <span
                  className={[
                    'truncate font-display text-[10px] font-medium uppercase leading-none tracking-[0.1em]',
                    passed && !high ? 'text-dim' : 'text-faint',
                  ].join(' ')}
                >
                  {passed && !high ? t('Passed') : ' '}
                </span>
              </li>
            )
          })}
        </ul>

        {/* The one number every decision on this screen is measured against. */}
        <div className="auction-budget rounded-md border border-line bg-surface px-[12px] py-[9px]">
          <span className="auction-budget-label font-display font-medium uppercase tracking-[0.18em] text-dim">
            {t('Your budget')}
          </span>
          <span
            key={yourBudget}
            className="money tabular auction-budget-figure fx fx-soft font-display font-semibold leading-[0.82] text-ink"
          >
            {yourBudget}
          </span>
        </div>
      </div>

      {/* ---- The controls. The steps, and the way out of a lot. ---- */}
      <div className="mt-[clamp(9px,1.7cqh,14px)] flex items-stretch gap-[9px]">
        {offers.map((offer) => {
          const affordable = offer.lands <= yourBudget
          const enabled = canRaise && affordable

          return (
            <button
              key={offer.step}
              type="button"
              disabled={!enabled}
              onClick={() => onBid(offer.step)}
              aria-label={
                held ? t('Raise by {amount}', { amount: offer.step }) : t('Open the bidding')
              }
              className={[
                'auction-step flex min-w-0 flex-1 items-center justify-center rounded-sm border-2 px-[8px] py-[clamp(10px,2.4cqh,19px)] font-display font-semibold uppercase leading-none tracking-[0.04em] transition-[background-color,border-color,color,transform] duration-150 ease-out active:translate-y-px',
                enabled
                  ? 'border-accent bg-accent text-accent-ink hover:bg-transparent hover:text-accent'
                  : 'border-line bg-transparent text-faint',
              ].join(' ')}
            >
              <span className={`tabular auction-step-figure ${held ? '' : 'money'}`}>
                {held ? `+${offer.step}` : offer.lands}
              </span>
            </button>
          )
        })}

        <button
          type="button"
          disabled={!canPass}
          onClick={onPass}
          className={[
            'auction-pass shrink-0 rounded-sm border-2 px-[clamp(12px,2.4cqw,22px)] font-display font-semibold uppercase leading-none tracking-[0.12em] transition-[border-color,color,transform] duration-150 ease-out active:translate-y-px',
            canPass
              ? 'border-line-strong bg-transparent text-muted hover:border-ink hover:text-ink'
              : 'border-line bg-transparent text-faint',
          ].join(' ')}
        >
          {t('Pass')}
        </button>
      </div>

      {/* One line under the controls, and only when there is something to say —
          why they are off, rather than a permanently reserved caption. */}
      <p
        className={[
          'mt-[7px] shrink-0 truncate font-display text-[10.5px] font-medium uppercase tracking-[0.16em] transition-opacity duration-200 ease-out',
          note ? 'text-muted opacity-100' : 'text-dim opacity-0',
        ].join(' ')}
        aria-live="polite"
      >
        {note || ' '}
      </p>
    </div>
  )
}

/** Kept in step with `LOCKOUT_MS` in `AuctionDraft`, in whole seconds. */
const LOCKOUT = 3

/** The seat disc. Bots keep their dashed outline; a bot never gets a face. */
function Disc({ drafter, tone }: { drafter: Drafter; tone: 'lead' | 'you' | 'plain' }) {

  return (
    <span
      className={[
        'auction-bid-disc grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full font-display text-[9px] font-semibold leading-none transition-colors duration-300 ease-out',
        tone === 'lead'
          ? 'border-2 border-accent text-accent'
          : tone === 'you'
            ? 'bg-accent text-accent-ink'
            : drafter.kind === 'bot'
              ? 'border border-dashed border-line-strong text-muted'
              : 'border border-line-strong text-muted',
      ].join(' ')}
    >
      {drafter.mark}
    </span>
  )
}
