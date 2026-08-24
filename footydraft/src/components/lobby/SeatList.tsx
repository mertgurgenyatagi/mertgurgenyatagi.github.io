import { MAX_SEATS } from '../../data/lobbyOptions'
import { useI18n } from '../../lib/i18n'

export interface Seat {
  id: string
  kind: 'you' | 'human' | 'bot'
  /** Set in Oswald, uppercase, on the row. */
  name: string
  /** One or two characters in the disc. A letter for people. */
  mark: string
  /** The line under the name. Never a count, never a pool fact. */
  note: string
  /** The pill on the right of the row, when the seat has a standing. */
  tag?: string
}

interface SeatListProps {
  seats: Seat[]
}

const DISC = 'grid place-items-center rounded-full font-display font-medium'

/**
 * The table. Five seats at most, filled by hand — the empty one stays on
 * screen, which is the whole reason this is a list of seats rather than a
 * number.
 *
 * Two renderings of the same state. Ruled rows from `md` up; below it the
 * seats compress to a strip of discs, because the rows and their captions
 * cannot fit a short viewport that also has to hold the settings half.
 */
export function SeatList({ seats }: SeatListProps) {
  const { t } = useI18n();

  const discClass = (seat: Seat, size: string) => {
    if (seat.kind === 'you') return `${DISC} ${size} shrink-0 bg-accent text-accent-ink`
    return `${DISC} ${size} shrink-0 border border-line-strong bg-surface-2 text-ink`
  }

  return (
    <>
      {/* ---- Compact: one row — the seats, then the count that labels them.
           4px of gap rather than 6px at the narrowest. ---- */}
      <div
        className="fx fx-soft flex items-center gap-[4px] sm:gap-[6px] md:hidden"
        style={{ animationDelay: '220ms' }}
      >
        {seats.map((seat) => (
          <span key={seat.id} className={`${discClass(seat, 'h-8 w-8')} text-[11px]`}>
            {seat.mark}
          </span>
        ))}

        <span className="tabular ml-auto shrink-0 font-display text-[10px] font-medium uppercase tracking-[0.1em] text-dim">
          {seats.length} / {MAX_SEATS}
        </span>
      </div>

      {/* ---- Full: ruled rows. ---- */}
      <ul className="mt-[clamp(1rem,2.6vh,1.625rem)] hidden shrink-0 flex-col border-y border-line-strong [&>li:last-child]:border-b-0 md:flex">
        {seats.map((seat, index) => (
          <li
            key={seat.id}
            className="fx fx-soft flex items-center justify-between gap-3 border-b border-line py-[clamp(0.6rem,1.8vh,1rem)]"
            style={{ animationDelay: `${220 + index * 60}ms` }}
          >
            <div className="flex items-center gap-[14px]">
              <span className={`${discClass(seat, 'h-[38px] w-[38px]')} text-[13px]`}>
                {seat.mark}
              </span>
              <span className="flex flex-col gap-[3px]">
                <span className="font-display text-[17px] font-bold uppercase leading-none tracking-[0.02em]">
                  {seat.name}
                </span>
                <span className="text-[11px] text-dim">{t(seat.note)}</span>
              </span>
            </div>

            {seat.tag ? (
              <span
                className={[
                  'shrink-0 rounded-sm border px-2 py-1 font-display text-[9.5px] font-medium uppercase tracking-[0.16em]',
                  seat.kind === 'you'
                    ? 'border-accent-line text-accent'
                    : 'border-line text-dim',
                ].join(' ')}
              >
                {t(seat.tag)}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  )
}
