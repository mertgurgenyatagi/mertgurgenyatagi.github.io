import { motion, useReducedMotion, type Variants } from "motion/react";
import { LoginButton } from "../auth/LoginButton";
import { AvatarStack } from "./AvatarStack";
import { useCountdown } from "./useCountdown";
import { CrestMarquee } from "./CrestMarquee";
import { PREDICTIONS_CLOSE_MS, formatDeadline, predictionsAreOpen } from "@/data/deadlines";
import { CLUB_COUNT } from "@/data/clubs";
import type { Player } from "../profile/usePlayers";

const EASE_COTTON = [0.22, 0.61, 0.36, 1] as const;

const riseIn: Variants = {
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE_COTTON } },
};

const staggerGroup: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09, delayChildren: 0.08 } },
};

function CountdownDigit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 sm:gap-1.5">
      <span className="type-numeral text-[clamp(1.9rem,7vw,2.8rem)] text-color_text tabular font-bold">
        {String(value).padStart(2, "0")}
      </span>
      <span className="type-label text-[0.6rem] tracking-[0.16em] uppercase text-color_textsecondary">
        {label}
      </span>
    </div>
  );
}

/**
 * Logged-out Landing Hero — Desktop & Tablet view.
 * Single screen view (no scrolling down).
 */
export function HomeLandingLoggedOut({ players }: { players: Player[] }) {
  const countdown = useCountdown(PREDICTIONS_CLOSE_MS);
  const reduceMotion = useReducedMotion();
  const initial = reduceMotion ? "visible" : "hidden";

  return (
    <section className="relative flex h-full min-h-0 flex-1 items-center overflow-hidden py-4 sm:py-8">
      <motion.div
        initial={initial}
        animate="visible"
        variants={staggerGroup}
        className="relative z-10 mx-auto flex w-full max-w-[1300px] flex-col gap-7 px-6 sm:px-10"
      >
        <motion.p variants={riseIn} className="type-label text-accent">
          2026/27 PREMIER LEAGUE
        </motion.p>

        <motion.h1
          variants={riseIn}
          className="type-display text-[clamp(2.4rem,7.5vw,4.5rem)] leading-[0.98] font-semibold text-color_text"
        >
          PREDICT THE TABLE.
          <br />
          LIVE WITH IT FOR A SEASON.
        </motion.h1>

        <motion.p
          variants={riseIn}
          className="max-w-2xl text-base text-color_textsecondary sm:text-lg leading-relaxed"
        >
          Rank all {CLUB_COUNT} clubs from first to last, call both cups and the six
          individual awards, then watch nine months of football decide whether you were
          right. One entry each. No edits after {formatDeadline()}. Made for the Football Iconic YouTube channel.
        </motion.p>

        <motion.div
          variants={riseIn}
          className="flex flex-col gap-6 pt-2 lg:flex-row lg:items-center lg:justify-between"
        >
          {/* Sign in button & social proof */}
          <div className="flex flex-col gap-3">
            {predictionsAreOpen() ? (
              <LoginButton size="lg" variant="primary" label="SIGN IN AND PLAY" />
            ) : (
              <p className="type-label text-remove">Entries are closed for this season</p>
            )}

            {players.length > 0 && (
              <div className="flex items-center gap-3 pt-1">
                <AvatarStack players={players} />
                <p className="text-sm text-color_textsecondary">
                  <span className="type-numeral text-color_text font-bold">{players.length}</span>{" "}
                  {players.length === 1 ? "person has" : "people have"} joined
                </p>
              </div>
            )}
          </div>

          {/* Seamless Club Crest Conveyor Belt */}
          <div className="hidden min-w-0 flex-1 px-8 lg:block">
            <CrestMarquee />
          </div>

          {/* Countdown Strip */}
          <div className="flex flex-col gap-2">
            <p className="type-label text-right lg:text-left">PREDICTIONS CLOSE IN</p>
            <div className="flex items-start gap-4 sm:gap-6">
              <CountdownDigit value={countdown.days} label="DAYS" />
              <CountdownDigit value={countdown.hours} label="HOURS" />
              <CountdownDigit value={countdown.minutes} label="MINS" />
              <CountdownDigit value={countdown.seconds} label="SECS" />
            </div>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}
