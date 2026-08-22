interface CrestProps {
  /** The mark's URL, or null for a club outside the top five. */
  src: string | null
  /** Read out when the mark stands for the club rather than decorating it. */
  alt?: string
  title?: string
  /** Sizing and placement only — `h-[25px] w-[25px] shrink-0` and so on. */
  className?: string
  /**
   * Draws the 1px ink outline around the artwork. Off by default: the outline
   * is four chained `drop-shadow()`s, which is fine on the five league marks
   * in the lobby (the two dark ones would otherwise vanish into the ground)
   * and ruinous on four hundred pool rows, where it was costing a filter pass
   * per crest on every repaint.
   */
  stroked?: boolean
}

/**
 * A club's mark, or the stand-in for one that has none.
 *
 * Coverage is the top five leagues — 69 crests against 112 clubs in the pool —
 * and the footballers at the other 43 clubs are in the draft regardless. A club
 * the app cannot draw gets **a ring in the same footprint**: same size, same
 * place in the row, nothing recoloured, nothing silhouetted, and no broken
 * image icon where a badge should be.
 */
export function Crest({ src, alt = '', title, className = '', stroked = false }: CrestProps) {
  if (!src) {
    return (
      <span
        aria-label={alt || undefined}
        role={alt ? 'img' : undefined}
        title={title ?? (alt || undefined)}
        className={`crest-ring shrink-0 rounded-full ${className}`}
      />
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      title={title}
      draggable={false}
      decoding="async"
      className={`${stroked ? 'crest' : 'crest-plain'} ${className}`}
    />
  )
}
