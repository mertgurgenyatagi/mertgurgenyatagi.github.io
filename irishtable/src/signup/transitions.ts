import type { Variants } from "motion/react";

const EASE_COTTON = [0.22, 0.61, 0.36, 1] as const;

/** The welcome moment — slow, floaty, "very very extremely slightly
 *  enlarge" (Mert's own words: a near-imperceptible scale-up, not a pop). */
export const welcomeVariants: Variants = {
  initial: { opacity: 0, scale: 0.985 },
  animate: { opacity: 1, scale: 1, transition: { duration: 1.1, ease: EASE_COTTON } },
  exit: { opacity: 0, transition: { duration: 0.6, ease: EASE_COTTON } },
};

/** Every other step — originally a snappier fade than the welcome message,
 *  reversed: "make the fast fades as slow as the first one." Same duration
 *  as welcomeVariants now, just without the scale-enlarge (that stays a
 *  one-time welcome detail). */
export const sharpVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 1.1, ease: EASE_COTTON } },
  exit: { opacity: 0, transition: { duration: 0.6, ease: EASE_COTTON } },
};
