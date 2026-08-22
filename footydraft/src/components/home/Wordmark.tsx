import { useEffect, useState } from 'react'
import { wallFaces } from '../../data/wallFaces'

/** Long enough to read a face, short enough that the letters never look parked. */
const HOLD_MS = 3800

/**
 * The wall. Two five-letter lines stack into a near-solid rectangle of type,
 * and a player portrait is clipped into the letterforms — cycling through the
 * pool, cross-fading from one face to the next.
 *
 * The face is Bebas Neue rather than Oswald: this is the logo, and the logo is
 * the one place a third family is allowed. Everything else on the page is
 * Oswald or Inter.
 */
export function Wordmark() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setIndex((current) => (current + 1) % wallFaces.length), HOLD_MS)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="relative w-fit">
      {/* Invisible — sizes the box and carries the accessible name. The image
          layers below are stacked absolutely on top of it, aria-hidden. */}
      <h1
        aria-label="#footydraft"
        className="select-none font-wordmark text-[min(17.5vw,24vh,13rem)] uppercase leading-[0.8] tracking-[0.005em] text-transparent"
      >
        <span className="block">FOOTY</span>
        <span className="block">DRAFT</span>
      </h1>

      {wallFaces.map((face, position) => (
        <div
          key={face.slug}
          aria-hidden="true"
          className="wordmark-mask absolute inset-0 transition-opacity duration-[900ms] ease-in-out"
          style={{ opacity: position === index ? 1 : 0 }}
        >
          <div
            className="wordmark-fill fx fx-wipe pointer-events-none absolute inset-0 font-wordmark text-[min(17.5vw,24vh,13rem)] uppercase leading-[0.8] tracking-[0.005em]"
            style={{
              animationDelay: '180ms',
              ['--wordmark-image' as string]: `url(${import.meta.env.BASE_URL}faces/${face.slug}.webp)`,
            }}
          >
            <span className="block">FOOTY</span>
            <span className="block">DRAFT</span>
          </div>
        </div>
      ))}

      {/* The hairline that rides the wipe's leading edge and is gone by the time
          it lands. Full-width element whose right edge carries the 2px rule, so
          a single translate sweeps it across without touching layout. */}
      <span
        aria-hidden="true"
        className="fx fx-scan pointer-events-none absolute inset-y-0 left-0 w-full"
        style={{
          animationDelay: '180ms',
          background:
            'linear-gradient(to right, transparent calc(100% - 2px), var(--color-accent) calc(100% - 2px))',
        }}
      />
    </div>
  )
}
