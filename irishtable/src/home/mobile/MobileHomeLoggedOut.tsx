import { motion, useReducedMotion, type Variants } from "motion/react";
import { LoginButton } from "../../auth/LoginButton";
import { SlotNumber } from "../SlotNumber";
import { useCountdown } from "../useCountdown";
import { useIrregularCounter } from "../useIrregularCounter";
import { PREDICTIONS_CLOSE_MS } from "@/data/deadlines";
import { CLUB_COUNT } from "@/data/clubs";
import type { Player } from "../../profile/usePlayers";

// The same mission copy the desktop landing carries. Mobile shows this one
// and drops desktop's shorter subline — the wireframe has a single text block
// between headline and countdown, and two blurbs stacked on a phone is exactly
// the busyness the golden rule is aimed at.
const MISSION_COPY =
  "Rank all twenty clubs before a ball is kicked, call both cups and the six individual awards, then live with it for nine months.";

const EASE_COTTON = [0.22, 0.61, 0.36, 1] as const;

const riseIn: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE_COTTON } },
};

const staggerGroup: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09, delayChildren: 0.08 } },
};

function CountdownDigit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="font-display text-2xl font-semibold text-color_text tnum">
        {String(value).padStart(2, "0")}
      </span>
      <span className="font-mono text-[0.55rem] tracking-[0.18em] text-color_textsecondary uppercase">
        {label}
      </span>
    </div>
  );
}

/**
 * Home — logged out, on a phone. The pre-launch front door.
 *
 * Four things in a column, one screenful, no scroll: headline, what this is,
 * how long you have, and the way in. Wireframed exactly that way, and it is
 * the one mobile screen where the ordering genuinely differs from desktop —
 * desktop puts the CTA directly under the headline with the countdown off to
 * the side, where mobile earns more by letting the countdown do the
 * persuading and putting the button last, at thumb height.
 *
 * Dropped from desktop: the avatar stack and its "N people have joined" line.
 * The headline already says how many people are in, one line above it.
 * `DustHaze` is dropped too, same as the desktop landing — irishtable's ruled
 * grid is already the background.
 */
export function MobileHomeLoggedOut({ players }: { players: Player[] }) {
  const countdown = useCountdown(PREDICTIONS_CLOSE_MS);
  const liveCount = useIrregularCounter(players.length);
  const reduceMotion = useReducedMotion();

  return (
    <section className="relative flex min-h-0 flex-1 items-center overflow-hidden">
      <motion.div
        initial={reduceMotion ? "visible" : "hidden"}
        animate="visible"
        variants={staggerGroup}
        className="relative z-10 flex w-full flex-col gap-7 px-6 py-8"
      >
        <motion.h1
          variants={riseIn}
          className="text-balance font-display text-[2.1rem] leading-[1.02] font-semibold tracking-[-0.02em] text-color_text"
        >
          {CLUB_COUNT} clubs. <SlotNumber value={liveCount} /> players. 1 season.
        </motion.h1>

        <motion.p
          variants={riseIn}
          className="text-balance text-[0.95rem] leading-relaxed text-color_textsecondary"
        >
          {MISSION_COPY}
        </motion.p>

        <motion.div variants={riseIn} className="flex flex-col gap-3">
          <span className="font-mono text-[0.58rem] tracking-[0.24em] text-color_textsecondary uppercase">
            Entries close in
          </span>
          {/* Evenly divided rather than gap-spaced: four tabular numerals
              across a 390px screen read as a unit when they share equal
              columns, and drift into a ragged row when they don't. */}
          <div className="grid grid-cols-4">
            <CountdownDigit value={countdown.days} label="Days" />
            <CountdownDigit value={countdown.hours} label="Hrs" />
            <CountdownDigit value={countdown.minutes} label="Min" />
            <CountdownDigit value={countdown.seconds} label="Sec" />
          </div>
        </motion.div>

        {/* Full-bleed within the page gutter — a phone CTA has no reason to
            be narrower than the text it follows. Same wrapper-restyles-the-
            inner-button pattern as every other LoginButton call site, so
            LoginButton stays the one source of truth for the sign-in call. */}
        <motion.div
          variants={riseIn}
          className="[&_button]:flex [&_button]:w-full [&_button]:cursor-pointer [&_button]:items-center [&_button]:justify-center [&_button]:gap-2.5 [&_button]:rounded-full [&_button]:bg-color_text [&_button]:px-6 [&_button]:py-3.5 [&_button]:text-sm [&_button]:font-semibold [&_button]:text-background [&_svg]:size-[1.05rem] [&_[role=alert]]:mt-2 [&_[role=alert]]:text-center [&_[role=alert]]:text-xs [&_[role=alert]]:text-color_remove"
        >
          <LoginButton label="Sign in and play" />
        </motion.div>
      </motion.div>
    </section>
  );
}
