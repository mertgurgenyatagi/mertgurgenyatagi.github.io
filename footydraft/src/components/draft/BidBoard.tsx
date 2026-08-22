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
  /** Seats the price has already climbed past. */
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
}

/**
 * Everything under the displayer: the countdown, the table's bids side by
 * side, and the steps.
 *
 * **Stripped back to those three things.** It used to open with a holder chip
 * naming who had the lot and at what price — which is now the headline across
 * the top of the whole screen, set four times the size, so repeating it here
 * was costing the row that carried it and telling nobody anything. The bid
 * cards lost their budget meters for the same reason the figure beside them
 * survived: the number is the fact, the bar was decoration.
 *
 * What that bought is **the steps**, which are the only controls on this
 * screen and were the smallest type on it. Each one is now a real button with
 * a real label: the step at reading size on top, what it lands on underneath.
 * A button that names only its step makes you do arithmetic against a clock,
 * and a button that names it in ten-pixel type makes you squint first.
 *
 * There is no Pass. A seat that stops bidding has passed; saying so out loud
 * was a control for a rule the auction does not have.
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
}: BidBoardProps) {
  const { t } = useI18n();

  const held = holder !== null
  const youHold = holder === youSeat
  const yourBudget = budgets[youSeat] ?? 0

  /* The first bid on a lot is exactly at the opening price, so the three steps
     are redundant until somebody has taken it and mask down to a single bid. */
  const offers = held
    ? BID_STEPS.map((step) => ({ step, lands: price + step }))
    : [{ step: 0, lands: price }]

  const canRaise = live && armed && !youHold
  /** Whole seconds still to run on the lockout, for the line that names it. */
  const opensIn = Math.max(0, Math.ceil(seconds - (limit - LOCKOUT)))

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

      {/* ---- The table, side by side, with what each of them has said. ---- */}
      <ul className="auction-bids mt-[clamp(9px,1.7cqh,14px)]">
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

              <span className="money tabular truncate font-display text-[11px] font-medium leading-none text-muted">
                {budgets[seat] ?? 0}
              </span>
            </li>
          )
        })}
      </ul>

      {/* ---- The steps. The only controls on the screen, drawn like it. ---- */}
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
              className={[
                'auction-step flex min-w-0 flex-1 flex-col items-center justify-center gap-[5px] rounded-sm border-2 px-[8px] py-[clamp(9px,2.1cqh,17px)] font-display font-semibold uppercase leading-none tracking-[0.04em] transition-[background-color,border-color,color,transform] duration-150 ease-out active:translate-y-px',
                enabled
                  ? 'border-accent bg-accent text-accent-ink hover:bg-transparent hover:text-accent'
                  : 'border-line bg-transparent text-faint',
              ].join(' ')}
            >
              <span className="money tabular auction-step-figure">
                {held ? `+${offer.step}` : offer.lands}
              </span>
              <span
                className={[
                  'auction-step-note font-medium tracking-[0.12em]',
                  enabled ? 'text-accent-ink/70' : 'text-faint',
                ].join(' ')}
              >
                {held ? <>{t("to")}<span className="money tabular">{offer.lands}</span></> : 'Open the bidding'}
              </span>
            </button>
          )
        })}
      </div>

      {/* One line under the steps, and only when there is something to say —
          why they are off, rather than a permanently reserved caption. */}
      <p
        className={[
          'mt-[7px] shrink-0 truncate font-display text-[10.5px] font-medium uppercase tracking-[0.16em] transition-opacity duration-200 ease-out',
          live && !armed ? 'text-muted opacity-100' : 'text-dim opacity-0',
        ].join(' ')}
        aria-live="polite"
      >
        {live && !armed ? `Bidding opens in ${opensIn}` : ' '}
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
