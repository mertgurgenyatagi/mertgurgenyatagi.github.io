import { Collapse } from './ChipGroup'
import { leagues } from '../../data/lobbyOptions'

interface ScopeDetailProps {
  scope: string
  league: string
  onLeagueChange: (id: string) => void
  /** A guest sees what the host narrowed it to, and can't move it. */
  readOnly?: boolean
  /** Leagues this many drafters can't play. */
  isLeagueUnavailable?: (id: string) => boolean
  /** Appended to an unavailable option's accessible name. */
  unavailableHint?: string
}

/**
 * One of the three scopes narrows further, and this is where it does it. The
 * row collapses away entirely for the two that don't, so the panel is never
 * holding space for a control that isn't on offer.
 *
 * Leagues are picked by their mark, not their name — the marks are the
 * identifier. Two of the five are dark and would otherwise vanish against the
 * ground, so the crests carry a 1px ink stroke (`.crest`): an outline drawn
 * around the artwork, which leaves every colour inside it untouched. Selection
 * is drawn on the chip, never on the crest.
 *
 * `min-h-0 min-w-0` on the mark is load-bearing, not tidying. A grid item's
 * automatic minimum size (`min-height: auto`) is content-based, and for a
 * replaced element it can clamp the height back *up* past an explicit `h-64%`
 * using the image's intrinsic aspect ratio. Landscape and square marks are
 * width-constrained so it never bites them; the two portrait lockups (Serie A,
 * Ligue 1) were pushed taller than the chip and clipped along its bottom edge.
 * See `mockups/crest-chip.html` for the before/after.
 */
export function ScopeDetail({
  scope,
  league,
  onLeagueChange,
  readOnly = false,
  isLeagueUnavailable,
  unavailableHint,
}: ScopeDetailProps) {
  const showLeagues = scope === 'league'
  const selected = leagues.find((entry) => entry.id === league)

  return (
    <Collapse open={showLeagues}>
      {/* Inside the collapsing box, so the spacing collapses with the row. */}
      <div className="mt-[var(--lobby-chip-mt)]">
        {readOnly ? (
          <div className="flex items-center gap-[clamp(0.25rem,0.7vw,0.5rem)]">
            <span className="grid h-[var(--lobby-crest)] w-[clamp(2rem,5vw,3.25rem)] place-items-center rounded-sm border border-accent bg-accent-soft">
              <img
                src={`${import.meta.env.BASE_URL}leagues/${league}.svg`}
                alt=""
                draggable={false}
                className="crest h-[64%] w-[64%] min-h-0 min-w-0 object-contain"
              />
            </span>
            <span className="ml-1 truncate font-display text-[10px] font-medium uppercase tracking-[0.16em] text-dim">
              {selected?.name}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-[clamp(0.25rem,0.7vw,0.5rem)]">
            {leagues.map((entry) => {
              /*
               * An unavailable league recedes as a whole control — chip and
               * mark together, on one opacity — rather than having its crest
               * treated on its own. A dashed hairline alone was far too quiet
               * at this size to read as "not on offer".
               *
               * This is still not a recoloured badge: nothing is greyed,
               * filtered or silhouetted, and the crest keeps every colour it
               * has. The whole button is simply dimmed the way a disabled
               * control is, and comes back untouched the moment a seat frees.
               */
              const unavailable = isLeagueUnavailable?.(entry.id) ?? false

              return (
                <button
                  key={entry.id}
                  type="button"
                  aria-label={
                    unavailable && unavailableHint
                      ? `${entry.name} — not available with ${unavailableHint}`
                      : entry.name
                  }
                  aria-pressed={entry.id === league}
                  disabled={unavailable}
                  onClick={() => onLeagueChange(entry.id)}
                  className={[
                    'grid h-[var(--lobby-crest)] w-[clamp(2rem,5vw,3.25rem)] place-items-center',
                    'rounded-sm border',
                    'transition-[border-color,background-color,opacity] duration-150 ease-out',
                    unavailable
                      ? entry.id === league
                        ? 'border-dashed border-accent-line opacity-30'
                        : 'border-dashed border-line opacity-30'
                      : entry.id === league
                        ? 'border-accent bg-accent-soft'
                        : 'border-line hover:border-line-strong',
                  ].join(' ')}
                >
                  <img
                    src={`${import.meta.env.BASE_URL}leagues/${entry.id}.svg`}
                    alt=""
                    draggable={false}
                    className="crest h-[64%] w-[64%] min-h-0 min-w-0 object-contain"
                  />
                </button>
              )
            })}

            <span className="ml-1 truncate font-display text-[10px] font-medium uppercase tracking-[0.16em] text-dim">
              {selected?.name}
            </span>
          </div>
        )}
      </div>
    </Collapse>
  )
}
