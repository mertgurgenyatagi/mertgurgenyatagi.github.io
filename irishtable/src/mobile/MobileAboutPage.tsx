import { Fragment } from "react";
import { motion, useReducedMotion, type Variants } from "motion/react";
import {
  CONTACT_EMAIL,
  ESSENCE_TEXT,
  KEY_DATES,
  currentThresholdFor,
  formatChipDate,
  getDateStatus,
} from "../pages/aboutContent";
import { SITE_NAME } from "@/data/site";
import { cn } from "@/lib/utils";

const EASE_COTTON = [0.22, 0.61, 0.36, 1] as const;

const riseIn: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.65, ease: EASE_COTTON } },
};

const staggerGroup: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
};

/**
 * /about on a phone: the mark, what this is, and when it happens.
 *
 * Desktop runs a two-column poster — text and contact on the left, a large
 * mark over a horizontal timeline on the right. That composition is a poster
 * rather than a responsive layout, so this is its own screen rather than an
 * adaptation of it.
 *
 * The timeline turns vertical, which is the only orientation that works:
 * four labelled nodes across 390px would give each one under 100px, and the
 * labels run to two and three words.
 */
export function MobileAboutPage() {
  const reduceMotion = useReducedMotion();
  const initial = reduceMotion ? "visible" : "hidden";

  return (
    <section className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <motion.div
        initial={initial}
        animate="visible"
        variants={staggerGroup}
        // Distributed rather than stacked with a fixed gap: this page has to
        // land inside one screenful, and `justify-between` absorbs the
        // difference between a 667px phone and a 926px one without any of the
        // four blocks needing a breakpoint of its own.
        className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-between gap-4 px-6 py-5"
      >
        <motion.img
          variants={riseIn}
          src="/brand/irishtable-logo.svg"
          alt={SITE_NAME}
          className="h-[clamp(3.5rem,9vh,6rem)] w-auto shrink-0"
        />

        <motion.p
          variants={riseIn}
          className="min-h-0 overflow-y-auto font-display text-[0.78rem] leading-relaxed font-light text-color_textsecondary"
        >
          {ESSENCE_TEXT}
        </motion.p>

        <motion.div variants={riseIn} className="w-full">
          <VerticalDateTimeline />
        </motion.div>

        <motion.div variants={riseIn} className="flex flex-col items-center gap-1">
          <span className="font-mono text-[0.58rem] tracking-[0.2em] text-color_textsecondary uppercase">
            Contact
          </span>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="font-display text-sm text-color_text no-underline"
          >
            {CONTACT_EMAIL}
          </a>
        </motion.div>
      </motion.div>
    </section>
  );
}

/** The same stepper as desktop's, rotated: the rail runs down the left and
 *  each node's date and label sit beside it rather than beneath it. */
function VerticalDateTimeline() {
  const now = Date.now();
  const currentThreshold = currentThresholdFor(now);

  return (
    <ol className="flex flex-col">
      {KEY_DATES.map((item, i) => {
        const status = getDateStatus(item.date, now, currentThreshold);
        const isFuture = status === "future";
        const isCurrent = status === "current";
        return (
          <Fragment key={item.label}>
            <li className="flex items-center gap-3.5 py-0.5">
              <span
                className={cn(
                  "size-3.5 shrink-0 rounded-full",
                  isFuture ? "border-2 border-color_text bg-transparent" : "bg-color_text",
                  isCurrent && "animate-pulse"
                )}
              />
              <span
                className={cn(
                  "w-20 shrink-0 font-display text-base font-semibold tnum",
                  isFuture ? "text-color_textsecondary" : "text-color_text",
                  isCurrent && "animate-pulse"
                )}
              >
                {formatChipDate(item)}
              </span>
              <span
                className={cn(
                  "min-w-0 flex-1 font-mono text-[0.58rem] leading-tight tracking-[0.1em] uppercase",
                  isFuture ? "text-color_textsecondary/70" : "text-color_textsecondary",
                  isCurrent && "animate-pulse"
                )}
              >
                {item.label}
              </span>
            </li>
            {/* The rail segment, inset to sit under the node's centre. */}
            {i < KEY_DATES.length - 1 && (
              <span
                aria-hidden
                className="ml-[0.4rem] h-[clamp(0.5rem,1.4vh,1rem)] w-px shrink-0 bg-color_border1"
              />
            )}
          </Fragment>
        );
      })}
    </ol>
  );
}
