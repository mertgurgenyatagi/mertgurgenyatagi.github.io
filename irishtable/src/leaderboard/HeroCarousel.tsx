import { useEffect, useState } from "react";
import { useImagePreload } from "@/lib/useImagePreload";
import { assetUrl } from "@/lib/utils";

// Portrait crops (public/hero/, pre-cropped to a 3:2 height:width box around
// a per-photo tuned focal point + zoom — see scripts/crop-hero-images.mjs
// and assets/leaderboard_hero_webps/tune.html). One rectangular card,
// full-bleed (object-cover, no mask/fade at the edges), cross-fading between
// them — not stacked, one slot, one image visible at a time. 7s each (Mert's
// explicit spec).
export const HERO_IMAGES = [
  "/hero/bellingham.webp",
  "/hero/bruno.webp",
  "/hero/dembele.webp",
  "/hero/haaland.webp",
  "/hero/harry_kane.webp",
  "/hero/mbappe.webp",
  "/hero/musiala.webp",
  "/hero/olise.webp",
  "/hero/pedri.webp",
  "/hero/raphinha.webp",
  "/hero/rice.webp",
  "/hero/rodri.webp",
  "/hero/saka.webp",
  "/hero/valverde.webp",
  "/hero/vinijr.webp",
  "/hero/wirtz.webp",
  "/hero/yamal.webp",
].map(assetUrl);

// Per-image object-position bias for object-cover — an escape hatch if a
// head gets cropped out in a given spot once these render inside a frame
// that isn't exactly 3:2. Empty by default: each crop above is already
// centered on its tuned focal point, so "50% 50%" (the fallback for
// anything not listed here) is correct out of the box.
export const HERO_IMAGE_POSITIONS: Record<string, string> = {};

const CYCLE_MS = 7000;
const FADE_MS = 1500;

function shuffled(images: string[]): string[] {
  const copy = images.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * The crossfading portrait carousel itself, extracted so it can be reused
 * without the upcoming-fixtures drawer LeaderboardHero docks to it — the
 * stats page's own hero section wants the exact same carousel, no drawer.
 *
 * Both the starting photo and the rotation order are freshly randomized on
 * every mount (Mert's explicit call) — a Fisher-Yates shuffle computed once
 * per mount via useState's lazy initializer, not resorted on every render.
 */
export function HeroCarousel() {
  const [order] = useState(() => shuffled(HERO_IMAGES));
  const [active, setActive] = useState(0);
  const ready = useImagePreload(order);

  useEffect(() => {
    const id = setInterval(() => {
      setActive((i) => (i + 1) % order.length);
    }, CYCLE_MS);
    return () => clearInterval(id);
  }, [order.length]);

  if (!ready) return null;

  return (
    <>
      {order.map((src, i) => (
        <img
          key={src}
          src={src}
          alt=""
          decoding="async"
          data-testid="hero-image"
          className="absolute inset-0 size-full object-cover transition-opacity ease-linear"
          style={{
            opacity: i === active ? 1 : 0,
            transitionDuration: `${FADE_MS}ms`,
            objectPosition: HERO_IMAGE_POSITIONS[src] ?? "50% 50%",
          }}
        />
      ))}
    </>
  );
}
