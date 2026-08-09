import { motion, useReducedMotion, type Variants } from "motion/react";
import { LoginButton } from "../../auth/LoginButton";
import { useCountdown } from "../useCountdown";
import { PREDICTIONS_CLOSE_MS, formatDeadline } from "@/data/deadlines";
import { CLUB_COUNT } from "@/data/clubs";
import type { Player } from "../../profile/usePlayers";

const MISSION_COPY =
  `Rank all ${CLUB_COUNT} clubs from first to last, call both cups and the six individual awards, then watch nine months of football decide whether you were right. One entry each. No edits after ${formatDeadline()}. Made for the Football Iconic YouTube channel.`;

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
      <span className="type-numeral text-2xl font-bold text-color_text tabular">
        {String(value).padStart(2, "0")}
      </span>
      <span className="type-label text-[0.55rem] tracking-[0.18em] text-color_textsecondary uppercase">
        {label}
      </span>
    </div>
  );
}

export function MobileHomeLoggedOut({ players: _players }: { players: Player[] }) {
  const countdown = useCountdown(PREDICTIONS_CLOSE_MS);
  const reduceMotion = useReducedMotion();

  return (
    <section className="relative flex min-h-0 flex-1 items-center overflow-hidden">
      <motion.div
        initial={reduceMotion ? "visible" : "hidden"}
        animate="visible"
        variants={staggerGroup}
        className="relative z-10 flex w-full flex-col gap-6 px-6 py-6"
      >
        <motion.p variants={riseIn} className="type-label text-accent">
          2026/27 PREMIER LEAGUE
        </motion.p>

        <motion.h1
          variants={riseIn}
          className="text-balance type-display text-[2rem] leading-[1.02] font-semibold text-color_text"
        >
          PREDICT THE TABLE.
          <br />
          LIVE WITH IT FOR A SEASON.
        </motion.h1>

        <motion.p
          variants={riseIn}
          className="text-balance text-[0.92rem] leading-relaxed text-color_textsecondary"
        >
          {MISSION_COPY}
        </motion.p>

        <motion.div variants={riseIn} className="flex flex-col gap-2.5">
          <span className="type-label text-[0.6rem] tracking-[0.2em] text-color_textsecondary uppercase">
            PREDICTIONS CLOSE IN
          </span>
          <div className="grid grid-cols-4">
            <CountdownDigit value={countdown.days} label="DAYS" />
            <CountdownDigit value={countdown.hours} label="HOURS" />
            <CountdownDigit value={countdown.minutes} label="MINS" />
            <CountdownDigit value={countdown.seconds} label="SECS" />
          </div>
        </motion.div>

        <motion.div
          variants={riseIn}
          className="pt-2 [&_button]:flex [&_button]:w-full [&_button]:cursor-pointer [&_button]:items-center [&_button]:justify-center [&_button]:gap-2.5 [&_button]:rounded-full [&_button]:bg-accent [&_button]:text-main [&_button]:px-6 [&_button]:py-3.5 [&_button]:text-sm [&_button]:font-semibold [&_svg]:size-[1.05rem]"
        >
          <LoginButton size="lg" variant="primary" label="SIGN IN AND PLAY" />
        </motion.div>
      </motion.div>
    </section>
  );
}
