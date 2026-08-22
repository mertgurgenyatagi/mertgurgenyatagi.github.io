import type { Drafter } from '../../lib/draftEngine'

interface TableStripProps {
  drafters: Drafter[]
  /** Whose turn it is. Carried by the accent on the disc, not by a word. */
  active: number
}

/**
 * The table, in the top bar: connected discs with names under them and nothing
 * else — no pick counts, no per-seat status, no captions. Everything the row
 * used to spell out is either on the narrator line beside it or is state
 * nobody needs mid-draft.
 *
 * Bots keep the outlined ring they have in the lobby. A bot never gets a face,
 * because a face implies the bot is somebody.
 */
export function TableStrip({ drafters, active }: TableStripProps) {
  return (
    <ul className="flex shrink-0 items-start">
      {drafters.map((drafter, index) => (
        <li key={drafter.id} className="flex items-start">
          {index > 0 ? (
            <span
              aria-hidden="true"
              className="mt-[15px] block h-px w-[11px] shrink-0 bg-line-strong sm:w-[20px] min-[1180px]:w-[26px]"
            />
          ) : null}

          <div className="flex w-[54px] flex-col items-center gap-[7px] sm:w-[62px]">
            <span
              className={[
                'grid h-[31px] w-[31px] place-items-center rounded-full font-display text-[12px] font-medium transition-colors duration-300 ease-out',
                index === active
                  ? 'bg-accent text-accent-ink'
                  : drafter.kind === 'bot'
                    ? 'border border-line-strong text-dim'
                    : 'border border-line-strong bg-surface-2 text-muted',
              ].join(' ')}
            >
              {drafter.mark}
            </span>
            <span
              className={[
                'w-full truncate text-center font-display text-[9px] font-medium uppercase leading-none tracking-[0.12em] transition-colors duration-300 ease-out',
                index === active ? 'text-ink' : 'text-dim',
              ].join(' ')}
            >
              {drafter.name}
            </span>
          </div>
        </li>
      ))}
    </ul>
  )
}
