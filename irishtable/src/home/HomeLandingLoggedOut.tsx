import { motion, useReducedMotion, type Variants } from "motion/react";
import { LoginButton } from "../auth/LoginButton";
import { AvatarStack } from "./AvatarStack";
import { SlotNumber } from "./SlotNumber";
import { useCountdown } from "./useCountdown";
import { useIrregularCounter } from "./useIrregularCounter";
import { PREDICTIONS_CLOSE_MS, formatDeadline } from "@/data/deadlines";
import { CLUB_COUNT } from "@/data/clubs";
import type { Player } from "../profile/usePlayers";

// What it is, how it works, when it happens — in that order, deliberately
// brief. The scoring formula belongs on /scoring, not here.
const MISSION_COPY =
  "Rank all twenty clubs before a ball is kicked, call both cups and the six individual awards, then live with it for nine months.";

// Matches --ease-cotton in index.css so this reveal and the CSS-keyframe ones
// elsewhere feel like one system rather than two animation vocabularies.
const EASE_COTTON = [0.22, 0.61, 0.36, 1] as const;

const riseIn: Variants = {
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE_COTTON } },
};

const staggerGroup: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09, delayChildren: 0.08 } },
};

/** The single Google CTA on this page. */
function SignupCta() {
  return (
    <div className="[&_button]:rounded-full [&_button]:px-6 [&_button]:py-3.5 [&_button]:text-sm [&_button]:font-semibold [&_svg]:size-[1.05rem] [&_[role=alert]]:mt-2 [&_[role=alert]]:text-xs">
      <LoginButton label="Sign in and play" />
    </div>
  );
}

function CountdownDigit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="font-display text-3xl font-semibold text-color_text tnum sm:text-4xl">
        {String(value).padStart(2, "0")}
      </span>
      <span className="font-mono text-[0.6rem] tracking-[0.22em] text-color_textsecondary uppercase">
        {label}
      </span>
    </div>
  );
}

/**
 * Home, logged out and pre-season — the one page a visitor sees before signing
 * in, and the first thing The Irish Guy will look at.
 *
 * A single screen, no scroll: one hero band, headline and CTA left, mission
 * and countdown right. Cloned from kupatakipucl, with `DustHaze` dropped —
 * irishtable's ruled grid is already the background, and five drifting blurred
 * blobs on top of a ruled field is two competing textures.
 */
export function HomeLandingLoggedOut({ players }: { players: Player[] }) {
  const countdown = useCountdown(PREDICTIONS_CLOSE_MS);
  const liveCount = useIrregularCounter(players.length);
  const reduceMotion = useReducedMotion();
  const initial = reduceMotion ? "visible" : "hidden";

  return (
    <section className="relative flex h-full min-h-0 flex-1 items-center overflow-hidden">
      <motion.div
        initial={initial}
        animate="visible"
        variants={staggerGroup}
        className="relative z-10 mx-auto grid w-full max-w-[1400px] grid-cols-1 items-center gap-10 px-6 sm:px-10 lg:grid-cols-[3fr_2fr] lg:gap-16"
      >
        <div className="flex flex-col gap-6">
          <motion.h1
            variants={riseIn}
            className="max-w-3xl text-balance font-display text-4xl leading-[0.98] font-semibold tracking-[-0.02em] text-color_text sm:text-5xl lg:text-6xl"
          >
            {CLUB_COUNT} clubs. <SlotNumber value={liveCount} /> players. 1 season.
          </motion.h1>
          <motion.p
            variants={riseIn}
            className="max-w-xl text-base text-color_textsecondary sm:text-lg"
          >
            Predict the Premier League table. Then argue about it until May.
          </motion.p>

          <motion.div variants={riseIn} className="flex flex-wrap items-center gap-6 pt-2">
            <SignupCta />
            {players.length > 0 && (
              <div className="flex items-center gap-3">
                <AvatarStack players={players} />
                <span className="font-mono text-xs text-color_textsecondary">
                  {players.length} {players.length === 1 ? "person has" : "people have"} joined
                </span>
              </div>
            )}
          </motion.div>
        </div>

        <motion.div
          variants={riseIn}
          className="flex flex-col gap-7 lg:border-l lg:border-color_border1/30 lg:pl-12"
        >
          <p className="text-balance font-display text-lg leading-snug text-color_text sm:text-xl">
            {MISSION_COPY}
          </p>

          <div className="flex flex-col gap-4">
            <span className="font-mono text-[0.62rem] tracking-[0.28em] text-color_textsecondary uppercase">
              Entries close {formatDeadline()}
            </span>
            <div className="flex items-start gap-5 sm:gap-7">
              <CountdownDigit value={countdown.days} label="Days" />
              <CountdownDigit value={countdown.hours} label="Hrs" />
              <CountdownDigit value={countdown.minutes} label="Min" />
              <CountdownDigit value={countdown.seconds} label="Sec" />
            </div>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}
