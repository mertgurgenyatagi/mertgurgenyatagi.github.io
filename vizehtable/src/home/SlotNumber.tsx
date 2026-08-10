import { motion } from "motion/react";

/** One odometer wheel: a 1-digit-tall window over a stacked 0-9 strip,
 *  translated by whole-digit-heights (in %, so it's independent of the
 *  surrounding font-size — no px/em bookkeeping needed).
 *
 *  The top-[...] nudge: per the CSS inline-block spec, an element with
 *  overflow != visible uses its *bottom margin edge* as the baseline for
 *  vertical-align purposes, not the text baseline of anything inside it —
 *  overflow-hidden is required here for the clipping effect, so
 *  align-baseline alone still sits the digit noticeably above the real
 *  text baseline (by roughly a font's descender height). A relative-
 *  positioned offset compensates; this isn't derived from Inter's exact
 *  metrics, it's tuned by eye, so nudge it further if a different digit
 *  count or font ever makes it drift again. */
function DigitReel({ digit }: { digit: number }) {
  return (
    <span className="relative top-[0.14em] inline-block h-[1em] w-[0.62em] overflow-hidden align-baseline">
      <motion.span
        className="absolute inset-x-0 top-0 flex flex-col"
        animate={{ y: `${-digit * 10}%` }}
        transition={{ type: "spring", stiffness: 120, damping: 20, mass: 0.9 }}
      >
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className="flex h-[1em] shrink-0 items-center justify-center leading-none">
            {i}
          </span>
        ))}
      </motion.span>
    </span>
  );
}

/** Renders `value` as rolling odometer digits — see useIrregularCounter for
 *  the number this is meant to display. Padded to `minDigits` so the width
 *  stays constant as the value climbs and rolls back (no layout jump). */
export function SlotNumber({ value, minDigits = 2 }: { value: number; minDigits?: number }) {
  const digits = String(Math.max(0, Math.round(value))).padStart(minDigits, "0").split("");

  return (
    <span className="inline-flex tabular-nums" aria-label={String(value)}>
      {digits.map((ch, i) => (
        <DigitReel key={i} digit={Number(ch)} />
      ))}
    </span>
  );
}
