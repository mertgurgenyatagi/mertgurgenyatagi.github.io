import { type WheelCategory, type WheelSlice, sliceColours, sliceGradient } from '../../lib/wheelEngine'
import { useI18n } from '../../lib/i18n'

interface SpinWheelProps {
  slices: WheelSlice[]
  category: WheelCategory
  /** Absolute degrees. Only ever increases, so the wheel never unwinds. */
  rotation: number
  spinning: boolean
  /** Null while spinning, and null on the turn the wheel comes up empty. */
  landed: WheelSlice | null
  durationMs: number
  /** Every eleven is full: the wheel is held where it stopped and says so. */
  done: boolean
}

/**
 * The sun this screen orbits.
 *
 * One conic gradient for the face, one transform for the spin, and one
 * counter-transform per chip so a crest never ends up upside down — all of it
 * on the compositor, none of it per frame in JS. The hub sits outside the
 * rotating element rather than inside it counter-rotated, because a hub that
 * has to be un-spun is a hub that shimmers for three seconds every turn.
 *
 * The chips shrink as the slice count grows and drop out entirely past
 * fourteen, which is the point where a mark is smaller than its own outline.
 * The hub still names whatever it lands on, so nothing is lost when they go.
 */
export function SpinWheel({
  slices,
  category,
  rotation,
  spinning,
  landed,
  durationMs,
  done,
}: SpinWheelProps) {
  const { t } = useI18n()
  const count = slices.length
  const step = count > 0 ? 360 / count : 360
  const gradient = sliceGradient(sliceColours(slices, category))
  const chip = count <= 6 ? '15%' : count <= 10 ? '11.5%' : count <= 16 ? '8.5%' : '7%'
  const spin = { transitionDuration: `${durationMs}ms` }

  return (
    <div className="wheel-stage relative min-h-0 w-full flex-1">
      <div className="wheel-fit relative mx-auto">
        <span aria-hidden="true" className="wheel-pointer" />

        <div
          aria-hidden="true"
          className="wheel-disc"
          style={{ ...spin, transform: `rotate(${rotation}deg)`, backgroundImage: gradient }}
        >
          {count <= 16
            ? slices.map((slice, index) => (
                <span
                  key={slice.key}
                  className={[
                    'wheel-chip',
                    !spinning && !done && landed?.key === slice.key ? 'wheel-chip-landed' : '',
                  ].join(' ')}
                  style={{ '--a': `${(index + 0.5) * step}deg`, '--chip': chip } as React.CSSProperties}
                >
                  {slice.mark ? (
                    <img
                      className="crest-plain"
                      src={slice.mark}
                      alt=""
                      style={{ ...spin, transform: `rotate(${-rotation}deg)` }}
                    />
                  ) : (
                    <b style={{ ...spin, transform: `rotate(${-rotation}deg)` }}>
                      {slice.label.slice(0, 3)}
                    </b>
                  )}
                </span>
              ))
            : null}
        </div>

        <div className="wheel-hub">
          <span
            key={done ? 'done' : spinning ? 'spinning' : (landed?.key ?? 'open')}
            className="fx fx-fade"
          >
            <b>{done ? t('The draft') : spinning ? t('The wheel') : t('Landed')}</b>
            <em>
              {done
                ? t('Complete')
                : spinning
                  ? t('Spinning')
                  : (landed ? t(landed.label) : t('Open board'))}
            </em>
          </span>
        </div>
      </div>
    </div>
  )
}
