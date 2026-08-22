import { MAX_SEATS, MIN_SEATS } from '../../data/lobbyOptions'
import { useI18n } from '../../lib/i18n'

export interface Seat {
  id: string
  kind: 'you' | 'human' | 'bot'
  /** Set in Oswald, uppercase, on the row. */
  name: string
  /** One or two characters in the disc. A letter for people, a number for bots. */
  mark: string
  /** The line under the name. Never a count, never a pool fact. */
  note: string
  /** The pill on the right of the row, when the seat has a standing. */
  tag?: string
}

interface SeatListProps {
  seats: Seat[]
  /** Below this, nothing can be removed. */
  minSeats?: number
  /** Omitted when the viewer isn't the host — only a host adds bots. */
  onAdd?: () => void
  onRemove?: (id: string) => void
}

const DISC = 'grid place-items-center rounded-full font-display font-medium'

/**
 * The table. Five seats at most, filled by hand — the empty one stays on
 * screen, which is the whole reason this is a list of seats rather than a
 * number.
 *
 * Bots get an outlined ring with a number, never a player photograph: a face
 * would imply the bot is somebody. People get their initial in the same ring,
 * and you get the one filled disc.
 *
 * Two renderings of the same state. Ruled rows from `md` up; below it the
 * seats compress to a strip of discs with add and remove on the end, because
 * the rows and their captions cannot fit a short viewport that also has to
 * hold the settings half.
 */
export function SeatList({ seats, minSeats = MIN_SEATS, onAdd, onRemove }: SeatListProps) {
  const { t } = useI18n();

  const canAdd = Boolean(onAdd) && seats.length < MAX_SEATS
  const removable = seats.filter((seat) => seat.kind === 'bot')
  const canRemove = Boolean(onRemove) && removable.length > 0 && seats.length > minSeats

  const discClass = (seat: Seat, size: string) => {
    if (seat.kind === 'you') return `${DISC} ${size} shrink-0 bg-accent text-accent-ink`
    if (seat.kind === 'human')
      return `${DISC} ${size} shrink-0 border border-line-strong bg-surface-2 text-ink`
    return `${DISC} ${size} shrink-0 border border-line-strong text-muted`
  }

  return (
    <>
      {/* ---- Compact: one row — the seats, then the count that labels them.
           4px of gap rather than 6px at the narrowest: a full table is five
           discs, an add, a remove and the count, and at 320px those don't fit
           on six. ---- */}
      <div
        className="fx fx-soft flex items-center gap-[4px] sm:gap-[6px] md:hidden"
        style={{ animationDelay: '220ms' }}
      >
        {seats.map((seat) => (
          <span key={seat.id} className={`${discClass(seat, 'h-8 w-8')} text-[11px]`}>
            {seat.mark}
          </span>
        ))}

        {onAdd ? (
          <button
            type="button"
            onClick={onAdd}
            disabled={!canAdd}
            aria-label={t("Add a bot")}
            className={`${DISC} h-8 w-8 shrink-0 border border-dashed border-line-strong text-[14px] text-dim transition-colors duration-150 ease-out hover:border-accent-line hover:text-accent disabled:border-line disabled:text-faint disabled:hover:border-line disabled:hover:text-faint`}
          >
            +
          </button>
        ) : null}

        {onRemove ? (
          <button
            type="button"
            onClick={() => onRemove(removable[removable.length - 1].id)}
            disabled={!canRemove}
            aria-label={t("Remove a bot")}
            className={`${DISC} h-8 w-8 shrink-0 border border-line-strong text-[14px] text-dim transition-colors duration-150 ease-out hover:border-ink hover:text-ink disabled:border-line disabled:text-faint disabled:hover:border-line disabled:hover:text-faint`}
          >
            −
          </button>
        ) : null}

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
                <span className="text-[11px] text-dim">{seat.note}</span>
              </span>
            </div>

            {seat.kind === 'bot' && onRemove ? (
              <button
                type="button"
                onClick={() => onRemove(seat.id)}
                disabled={!canRemove}
                className="shrink-0 font-display text-[10px] font-medium uppercase tracking-[0.2em] text-muted transition-colors duration-150 ease-out hover:text-ink disabled:text-faint disabled:hover:text-faint"
              >{t("Remove")}</button>
            ) : seat.tag ? (
              <span
                className={[
                  'shrink-0 rounded-sm border px-2 py-1 font-display text-[9.5px] font-medium uppercase tracking-[0.16em]',
                  seat.kind === 'you'
                    ? 'border-accent-line text-accent'
                    : 'border-line text-dim',
                ].join(' ')}
              >
                {seat.tag}
              </span>
            ) : null}
          </li>
        ))}

        {canAdd ? (
          <li className="fx fx-soft" style={{ animationDelay: `${220 + seats.length * 60}ms` }}>
            <button
              type="button"
              onClick={onAdd}
              className="group/seat flex w-full items-center gap-[14px] py-[clamp(0.6rem,1.8vh,1rem)] text-left"
            >
              <span
                className={`${DISC} h-[38px] w-[38px] shrink-0 border border-dashed border-line-strong text-[15px] text-dim transition-colors duration-150 ease-out group-hover/seat:border-accent-line group-hover/seat:text-accent`}
              >
                +
              </span>
              <span className="flex flex-col gap-[3px]">
                <span className="font-display text-[17px] font-bold uppercase leading-none tracking-[0.02em] text-dim transition-colors duration-150 ease-out group-hover/seat:text-ink">{t("Add a bot")}</span>
                <span className="text-[11px] text-faint">
                  {MAX_SEATS - seats.length === 1
                    ? 'One seat left'
                    : `${MAX_SEATS - seats.length} seats left`}
                </span>
              </span>
            </button>
          </li>
        ) : null}
      </ul>
    </>
  )
}
