export interface Format {
  id: string
  /** Set in Oswald, uppercase, on the tile. */
  name: string
}

/** The four formats, in the order PROJECT.md lists them. */
export const formats: Format[] = [
  { id: 'auction', name: 'Auction' },
  { id: 'deal-or-no-deal', name: 'Deal or No Deal' },
  { id: 'free-pick', name: 'Free Pick' },
  { id: 'spin-the-wheel', name: 'Spin the Wheel' },
]
