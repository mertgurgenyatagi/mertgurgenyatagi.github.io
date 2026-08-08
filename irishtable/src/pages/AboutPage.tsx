import { Fragment } from "react";
import { motion, useReducedMotion, type Variants } from "motion/react";
import {
  CONTACT_EMAIL,
  ESSENCE_TEXT,
  KEY_DATES,
  currentThresholdFor,
  formatChipDate,
  getDateStatus,
} from "./aboutContent";
import { useIsMobile } from "@/lib/useIsMobile";
import { MobileAboutPage } from "../mobile/MobileAboutPage";
import { SITE_NAME } from "@/data/site";
import { cn } from "@/lib/utils";

// Matches --ease-cotton (src/styles/index.css) / HomeLandingLoggedOut.tsx's
// own copy of the same curve, so every page's motion reads as one system.
const EASE_COTTON = [0.22, 0.61, 0.36, 1] as const;

const logoIn: Variants = {
  hidden: { opacity: 0, y: -10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: EASE_COTTON } },
};

// A single fade/rise, not a word-by-word stagger — the essence text is a full
// paragraph, and staggering a hundred-odd words would take several seconds to
// finish revealing.
const essenceIn: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE_COTTON, delay: 0.3 } },
};
const timelineIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.6, ease: EASE_COTTON, delay: 1.1 } },
};
const contactIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.6, ease: EASE_COTTON, delay: 1.5 } },
};

/**
 * A stepper, not a decoration: the four dates are a genuine chronological
 * sequence (entries close → season starts → final matchday → awards). Past
 * nodes are filled, the next upcoming one blinks as the current stage,
 * everything after it stays hollow.
 */
function DateTimeline() {
  const now = Date.now();
  const currentThreshold = currentThresholdFor(now);

  return (
    <div className="flex w-full max-w-3xl items-start">
      {KEY_DATES.map((item, i) => {
        const status = getDateStatus(item.date, now, currentThreshold);
        const isFuture = status === "future";
        const isCurrent = status === "current";
        return (
          <Fragment key={item.label}>
            {i > 0 && <div aria-hidden className="mt-2.5 h-px flex-1 bg-color_border1" />}
            <div className="flex flex-col items-center gap-3">
              <span
                className={cn(
                  "size-5 shrink-0 rounded-full",
                  isFuture ? "border-2 border-color_text bg-transparent" : "bg-color_text",
                  isCurrent && "animate-pulse"
                )}
              />
              <span
                className={cn(
                  "font-display text-lg font-semibold tnum",
                  isFuture ? "text-color_textsecondary" : "text-color_text",
                  isCurrent && "animate-pulse"
                )}
              >
                {formatChipDate(item)}
              </span>
              <span
                className={cn(
                  "max-w-[6.5rem] text-center font-mono text-[0.58rem] leading-tight tracking-[0.1em] uppercase",
                  isFuture ? "text-color_textsecondary/70" : "text-color_textsecondary",
                  isCurrent && "animate-pulse"
                )}
              >
                {item.label}
              </span>
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}

/**
 * /about — open to everyone, no gating. Single no-scroll viewport.
 * Two-column poster composition: matter-of-fact essence text and contact info
 * on the left, the mark over a real-sequence date timeline on the right.
 *
 * `DustHaze` is dropped, same as the landing page — irishtable's ruled grid
 * is already the background, and drifting blurred blobs on top of a ruled
 * field is two competing textures.
 */
export function AboutPage() {
  const isMobile = useIsMobile();
  const reduceMotion = useReducedMotion();
  const initial = reduceMotion ? "visible" : "hidden";
  const animate = "visible";

  // The desktop composition here is a poster, not a responsive layout —
  // mobile gets its own rather than a reflow of something that was never
  // meant to bend.
  if (isMobile) return <MobileAboutPage />;

  return (
    <section className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="relative z-10 mx-auto grid h-full min-h-0 w-full max-w-[1500px] grid-cols-[0.85fr_1.3fr] gap-12 px-14 py-9">
        <div className="flex min-h-0 flex-col items-start justify-center gap-10">
          <motion.p
            initial={initial}
            animate={animate}
            variants={essenceIn}
            className="max-w-2xl font-display text-lg leading-relaxed font-light text-color_text"
          >
            {ESSENCE_TEXT}
          </motion.p>

          <motion.div
            initial={initial}
            animate={animate}
            variants={contactIn}
            className="flex flex-col items-start gap-1"
          >
            <span className="font-mono text-[0.62rem] tracking-[0.2em] text-color_textsecondary uppercase">
              Contact
            </span>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="w-fit font-display text-sm text-color_text no-underline transition-colors duration-150 ease-[var(--ease-cotton)] hover:text-color_accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-color_text"
            >
              {CONTACT_EMAIL}
            </a>
          </motion.div>
        </div>

        <div className="flex min-h-0 flex-col items-center justify-center gap-20">
          <motion.img
            initial={initial}
            animate={animate}
            variants={logoIn}
            src="/brand/irishtable-logo.svg"
            alt={SITE_NAME}
            className="h-[clamp(11rem,32vh,18rem)] w-auto"
          />
          <motion.div initial={initial} animate={animate} variants={timelineIn} className="w-full">
            <DateTimeline />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
