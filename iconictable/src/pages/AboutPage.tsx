import { Link } from "react-router-dom";
import { motion, useReducedMotion, type Variants } from "motion/react";
import { Fragment } from "react";
import {
  KEY_DATES,
  currentThresholdFor,
  formatChipDate,
  getDateStatus,
} from "./aboutContent";
import { useIsMobile } from "@/lib/useIsMobile";
import { MobileAboutPage } from "../mobile/MobileAboutPage";
import { SITE_NAME, CHANNEL_NAME } from "@/data/site";
import { CLUB_COUNT } from "@/data/clubs";
import { MAX_SCORE } from "@/data/scoring";
import { formatDeadline } from "@/data/deadlines";
import { cn, assetUrl } from "@/lib/utils";

const EASE_COTTON = [0.22, 0.61, 0.36, 1] as const;

const logoIn: Variants = {
  hidden: { opacity: 0, y: -10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: EASE_COTTON } },
};

const essenceIn: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE_COTTON, delay: 0.2 } },
};

const timelineIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.6, ease: EASE_COTTON, delay: 0.6 } },
};

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
 * About Page — Desktop layout.
 * Combines the restored prior text with the timeline component.
 */
export function AboutPage() {
  const isMobile = useIsMobile();
  const reduceMotion = useReducedMotion();
  const initial = reduceMotion ? "visible" : "hidden";
  const animate = "visible";

  if (isMobile) return <MobileAboutPage />;

  return (
    <section className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden py-4 sm:py-6">
      <div className="relative z-10 mx-auto grid h-full min-h-0 w-full max-w-[1500px] grid-cols-[1.1fr_1fr] gap-12 px-10 py-4">
        {/* Left Column: Restored Prior About Text & Header */}
        <motion.div
          initial={initial}
          animate={animate}
          variants={essenceIn}
          className="flex min-h-0 flex-col gap-6 overflow-y-auto pr-4"
        >
          <header className="flex flex-col gap-2">
            <p className="type-label text-accent">2026/27</p>
            <h1 className="type-display text-4xl sm:text-5xl font-semibold text-color_text">ABOUT</h1>
          </header>

          <div className="flex max-w-2xl flex-col gap-4 text-base leading-relaxed text-color_textsecondary sm:text-lg">
            <p>
              {SITE_NAME} is a season-long Premier League prediction league. You rank all{" "}
              {CLUB_COUNT} clubs from first to twentieth, pick who wins the FA Cup and the
              Carabao Cup, and name six individual award winners. Then you wait nine months
              to find out how wrong you were.
            </p>
            <p>
              It's built for {CHANNEL_NAME}'s audience — people who already argue about the
              table in the comments, now with a scoreboard attached. Everyone submits once,
              everyone is scored the same way, and nobody can see anyone else's entry until
              the deadline passes.
            </p>
            <p>
              Entries close on{" "}
              <span className="font-semibold text-color_text">{formatDeadline()}</span>, the day before the{" "}
              season starts. You can change your predictions as many times as you like until
              then, and not once afterwards. A perfect entry is worth {MAX_SCORE} points —{" "}
              <Link to="/scoring" className="text-accent underline-offset-4 hover:underline">
                the scoring page
              </Link>{" "}
              explains exactly how you get there.
            </p>
            <p>
              There's a forum and a chat room, both open from the moment you sign in. Use
              them. Half the point of a prediction league is telling someone their title
              pick is delusional.
            </p>
          </div>

          <section className="flex flex-col gap-2 border-t border-color_border1 pt-6">
            <h2 className="type-display text-xl text-color_text">Questions</h2>
            <p className="max-w-2xl text-color_textsecondary">
              Post them in the{" "}
              <Link to="/forum" className="text-accent underline-offset-4 hover:underline">
                forum
              </Link>
              {" "}— that's the fastest way to get an answer, and someone else has probably
              asked already.
            </p>
          </section>
        </motion.div>

        {/* Right Column: Logo & Timeline */}
        <div className="flex min-h-0 flex-col items-center justify-center gap-14 border-l border-color_border1/30 pl-8">
          <motion.img
            initial={initial}
            animate={animate}
            variants={logoIn}
            src={assetUrl("/brand/iconictable-logo.svg")}
            alt={SITE_NAME}
            className="h-[clamp(9rem,25vh,14rem)] w-auto"
          />
          <motion.div initial={initial} animate={animate} variants={timelineIn} className="w-full">
            <DateTimeline />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
