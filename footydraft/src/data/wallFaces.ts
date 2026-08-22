export interface WallFace {
  /** Resolves to public/faces/{slug}.webp — a face-anchored 4:5 crop cut from
   *  the full-resolution photo by scripts/make_face_crops.py. Every crop puts
   *  the face at the same share of the frame, so the portrait never jumps in
   *  scale as the carousel moves between players. */
  slug: string
  /** Short form — the caption sits under a ~150px frame. */
  surname: string
}

/**
 * The faces the home page cycles through. Decoration, not the draft pool: a
 * spread across clubs and leagues, hand-picked, and nothing else reads it.
 * Every slug here needs a crop in public/faces — re-run the script after
 * editing this list.
 */
export const wallFaces: WallFace[] = [
  { slug: 'erling-haaland', surname: 'Haaland' },
  { slug: 'jude-bellingham', surname: 'Bellingham' },
  { slug: 'mohamed-salah', surname: 'Salah' },
  { slug: 'virgil-van-dijk', surname: 'Van Dijk' },
  { slug: 'kylian-mbappe', surname: 'Mbappé' },
  { slug: 'bukayo-saka', surname: 'Saka' },
  { slug: 'lautaro-martinez', surname: 'Lautaro' },
  { slug: 'kevin-de-bruyne', surname: 'De Bruyne' },
  { slug: 'harry-kane', surname: 'Kane' },
  { slug: 'vinicius-junior', surname: 'Vinícius Jr' },
  { slug: 'alexander-isak', surname: 'Isak' },
  { slug: 'rodri', surname: 'Rodri' },
]
