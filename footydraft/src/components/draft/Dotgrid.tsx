import { type CSSProperties, useLayoutEffect, useRef, useState } from 'react'
import { type DotgridFrame, type Player, cellGridSrc } from '../../lib/players'

/**
 * Which slice of the grid a frame shows, and how tight — tuned by hand
 * against the real, live screens rather than guessed (see PROJECT.md's Art
 * assets section for how the tuning was done). `zoom` is a multiplier on top
 * of the tightest fit that still covers the box with no gap (1 = that fit
 * exactly, higher = crop in further);
 * `panX`/`panY` (0–1) place the visible window within whatever slack the
 * extra zoom created.
 */
const FRAME_CROPS: Record<DotgridFrame, { zoom: number; panX: number; panY: number; density: number }> = {
  'spare-face': { zoom: 2.04, panX: 0.44, panY: 0.16, density: 48 },
  'auction-block': { zoom: 1, panX: 0, panY: 0.12, density: 96 },
  'box-stage': { zoom: 1, panX: 0.8, panY: 0.15, density: 64 },
  'box-grid-tile': { zoom: 1.1, panX: 0.54, panY: 0.09, density: 48 },
  'pitch-node': { zoom: 1.26, panX: 0.52, panY: 0, density: 16 },
  // Re-tuned when the sold card's photograph went from a square to a 16:9
  // strip: the scale is width-driven at that shape, so the old 2.04 zoom cut
  // a head crop out of a box already only sixty pixels tall.
  'sold-record-face': { zoom: 1, panX: 0.5, panY: 0.1, density: 48 },
  'spotlight-free-pick': { zoom: 1, panX: 0.38, panY: 0.12, density: 64 },
  'spotlight-spin': { zoom: 1, panX: 0.45, panY: 0.11, density: 48 },
}

interface DotgridProps {
  player: Pick<Player, 'portraitBase'>
  frame: DotgridFrame
  /** Sizing/positioning only — `h-full w-full` for a tile, `absolute inset-0`
   * for a frame that fills its parent. The box this resolves to is measured
   * directly, so any shape works without a matching CSS rule to maintain. */
  className?: string
  /** Fires once if the cell-grid asset itself 404s (e.g. no source photo).
   * Callers own the crest fallback, same as the old `<img onError>` did. */
  onError?: () => void
}

/**
 * The dot-grid portrait — a tiny colour grid read as a background image with
 * a repeating circular mask punched over it (`.dotgrid` in index.css). The
 * crop is computed here, not in CSS: a `ResizeObserver` reads this
 * instance's *actual* rendered box and derives one uniform scale factor from
 * it (`max(w/cols, h/rows)`, same as `object-fit: cover`), so
 * `background-size`/`mask-size` end up in matching px on both axes — dots
 * stay circular at any container size. An earlier version expressed these as
 * independent width%/height%, which only avoided stretching at one assumed
 * aspect ratio per frame.
 *
 * The crop values in `FRAME_CROPS` were tuned by hand against the real, live
 * screens rather than guessed — see PROJECT.md's Art assets section for how.
 */
export function Dotgrid({ player, frame, className = '', onError }: DotgridProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [style, setStyle] = useState<CSSProperties>({})

  const crop = FRAME_CROPS[frame]
  const src = cellGridSrc(player, crop.density)
  const cols = crop.density
  const rows = Math.round(crop.density * 1.25)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    const measure = () => {
      const { width: w, height: h } = el.getBoundingClientRect()
      if (w === 0 || h === 0) return

      const scale = Math.max(w / cols, h / rows) * crop.zoom
      const bgWidth = cols * scale
      const bgHeight = rows * scale
      const maxOffsetX = Math.max(0, bgWidth - w)
      const maxOffsetY = Math.max(0, bgHeight - h)
      // Snapped to whole grid-pixel multiples of `scale` so the mask's
      // repeating tile (which is exactly `scale` px) lands on the same
      // boundaries as the background image — otherwise the two textures
      // drift out of phase and a dot shows two different cells' colours.
      // Clamped after snapping: `maxOffset` is rarely an exact multiple of
      // `scale`, so rounding at pan 0 or 1 can overshoot it by a fraction of
      // a cell and pull the image's edge in from the box, leaving a gap.
      const offsetX = Math.min(maxOffsetX, Math.round((maxOffsetX * crop.panX) / scale) * scale)
      const offsetY = Math.min(maxOffsetY, Math.round((maxOffsetY * crop.panY) / scale) * scale)

      setStyle({
        backgroundImage: `url(${src})`,
        backgroundSize: `${bgWidth}px ${bgHeight}px`,
        backgroundPosition: `-${offsetX}px -${offsetY}px`,
        maskSize: `${scale}px ${scale}px`,
        WebkitMaskSize: `${scale}px ${scale}px`,
        maskPosition: `-${offsetX}px -${offsetY}px`,
        WebkitMaskPosition: `-${offsetX}px -${offsetY}px`,
      } as CSSProperties)
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [src, cols, rows, crop])

  return (
    <>
      <div
        ref={ref}
        aria-hidden="true"
        data-frame={frame}
        className={`dotgrid ${className}`}
        style={style}
      />
      {onError ? <img src={src} alt="" className="sr-only" onError={onError} /> : null}
    </>
  )
}
