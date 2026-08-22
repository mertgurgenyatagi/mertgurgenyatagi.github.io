import { useEffect, useState } from 'react'
import type { Box } from '../../lib/dondEngine'
import type { Drafter } from '../../lib/draftEngine'
import { Crest } from '../ui/Crest'
import { Dotgrid } from './Dotgrid'

interface BoxGridProps {
  boxes: Box[]
  /** Who is at the table, so an opened box can be captioned with whose it was. */
  drafters: Drafter[]
  youSeat: number
  /** Set only while it is your go to open one. Null the rest of the time. */
  onOpen: ((index: number) => void) | null
}

/**
 * The round's boxes: `2N` of them, in two rows, anonymous until they open.
 *
 * A shut box says its number and nothing else — no marker for whose it is, no
 * hint at what is inside. Which drafter is at the table is the narrator's job,
 * and a grid that labelled its own boxes would be answering a question nobody
 * asked while giving away the only thing the format keeps hidden.
 *
 * Two rows always, whatever the table size, so the grid keeps the same shape
 * at four boxes as at ten and the boxes themselves grow instead of the layout
 * re-flowing under them.
 */
export function BoxGrid({ boxes, drafters, youSeat, onOpen }: BoxGridProps) {
  const columns = Math.max(1, Math.ceil(boxes.length / 2))

  return (
    <ul
      className="dond-boxes grid min-h-0 flex-1 gap-[clamp(7px,1.1cqh,11px)]"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {boxes.map((box, index) => (
        <li key={box.number} className="min-h-0">
          <BoxFace
            box={box}
            index={index}
            mine={box.openedBy === youSeat}
            opener={box.openedBy === null ? null : drafters[box.openedBy]?.name}
            onOpen={onOpen}
          />
        </li>
      ))}
    </ul>
  )
}

function BoxFace({
  box,
  index,
  mine,
  opener,
  onOpen,
}: {
  box: Box
  index: number
  mine: boolean
  opener: string | null
  onOpen: ((index: number) => void) | null
}) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [box.player.id])

  if (box.openedBy !== null) {
    return (
      <div
        className={[
          'dond-box dond-box-open fx fx-soft flex h-full flex-col overflow-hidden',
          mine ? 'border-accent' : 'border-line-strong',
        ].join(' ')}
        title={`${box.player.name} — box ${box.number}, opened by ${opener}`}
      >
        <div className="min-h-0 flex-1 overflow-hidden">
          {failed ? (
            <Crest className="m-auto h-[50%] w-[50%] opacity-40" src={box.player.crest} alt="" />
          ) : (
            <Dotgrid
              player={box.player}
              frame="box-grid-tile"
              className="h-full w-full"
              onError={() => setFailed(true)}
            />
          )}
        </div>
        <div className="flex shrink-0 items-center gap-[6px] border-t border-line px-[7px] py-[5px]">
          <Crest className="h-[14px] w-[14px] shrink-0" src={box.player.crest} alt="" />
          <span
            className={[
              'truncate font-display text-[11px] font-medium uppercase tracking-[0.04em]',
              mine ? 'text-accent' : 'text-ink',
            ].join(' ')}
          >
            {box.player.surname}
          </span>
        </div>
      </div>
    )
  }

  if (!onOpen) {
    return (
      <div className="dond-box dond-box-shut grid h-full place-items-center border-line-strong">
        <span className="dond-number text-dim">{String(box.number).padStart(2, '0')}</span>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => onOpen(index)}
      aria-label={`Open box ${box.number}`}
      className="dond-box dond-box-shut dond-box-live grid h-full w-full place-items-center border-accent-line transition-[border-color,transform] duration-150 ease-out hover:border-accent active:translate-y-px"
    >
      <span className="dond-number text-accent">{String(box.number).padStart(2, '0')}</span>
    </button>
  )
}
