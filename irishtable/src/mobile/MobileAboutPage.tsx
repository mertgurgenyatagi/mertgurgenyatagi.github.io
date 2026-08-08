import { Fragment } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion, type Variants } from "motion/react";
import {
  KEY_DATES,
  currentThresholdFor,
  formatChipDate,
  getDateStatus,
} from "../pages/aboutContent";
import { SITE_NAME, CHANNEL_NAME } from "@/data/site";
import { CLUB_COUNT } from "@/data/clubs";
import { MAX_SCORE } from "@/data/scoring";
import { formatDeadline } from "@/data/deadlines";
import { cn, assetUrl } from "@/lib/utils";

const EASE_COTTON = [0.22, 0.61, 0.36, 1] as const;

const riseIn: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.65, ease: EASE_COTTON } },
};

const staggerGroup: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
};

export function MobileAboutPage() {
  const reduceMotion = useReducedMotion();
  const initial = reduceMotion ? "visible" : "hidden";

  return (
    <section className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <motion.div
        initial={initial}
        animate="visible"
        variants={staggerGroup}
        className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-between gap-4 px-6 py-5 overflow-y-auto"
      >
        <motion.div variants={riseIn} className="flex flex-col items-center gap-1 text-center">
          <motion.img
            src={assetUrl("/brand/irishtable-logo.svg")}
            alt={SITE_NAME}
            className="h-12 w-auto"
          />
          <p className="type-label text-accent">2026/27</p>
          <h1 className="type-display text-3xl font-semibold text-color_text">ABOUT</h1>
        </motion.div>

        <motion.div
          variants={riseIn}
          className="flex flex-col gap-3 text-sm leading-relaxed text-color_textsecondary"
        >
          <p>
            {SITE_NAME} is a season-long Premier League prediction league. You rank all{" "}
            {CLUB_COUNT} clubs, pick both cup winners, and name six individual award winners.
          </p>
          <p>
            Built for {CHANNEL_NAME}'s audience. Everyone submits once, everyone is scored
            identically. Entries close on{" "}
            <span className="font-semibold text-color_text">{formatDeadline()}</span>. A perfect
            entry is worth {MAX_SCORE} points (see{" "}
            <Link to="/scoring" className="text-accent underline">
              scoring
            </Link>
            ).
          </p>
          <p>
            Got questions? Post them in the{" "}
            <Link to="/forum" className="text-accent underline">
              forum
            </Link>
            .
          </p>
        </motion.div>

        <motion.div variants={riseIn} className="w-full pt-2">
          <VerticalDateTimeline />
        </motion.div>
      </motion.div>
    </section>
  );
}

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
