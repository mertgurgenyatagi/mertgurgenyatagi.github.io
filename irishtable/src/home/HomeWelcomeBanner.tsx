import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Frame, FrameBody } from "@/components/ui/frame";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useCountdown } from "./useCountdown";
import { PREDICTIONS_CLOSE_MS } from "@/data/deadlines";
import { initials } from "../profile/deletedAccount";
import type { Player } from "../profile/usePlayers";

interface HomeWelcomeBannerProps {
  me: Player;
  /** Whether to show the "Tahminini Yap" CTA. HomeLandingLoggedIn passes
   *  `!submitterUids.has(me.uid)` (predictions still open); the started
   *  page passes `false` unconditionally, since /predictions redirects
   *  home for anyone visiting once the tournament has started, regardless
   *  of submission status. */
  showCta: boolean;
}

function MiniCountdownDigit({ value, label }: { value: number; label: string }) {
  return (
    <span className="flex items-baseline gap-1.5 whitespace-nowrap">
      <span className="font-display text-2xl leading-none font-semibold text-color_text tnum sm:text-3xl">
        {String(value).padStart(2, "0")}
      </span>
      <span className="font-mono text-xs tracking-[0.1em] text-color_textsecondary uppercase">{label}</span>
    </span>
  );
}

/**
 * Personal welcome + primary action + countdown — one frame, no title band
 * (Home's "no widget carries a label" rule applies to the greeting too).
 * Shared between HomeLandingLoggedIn (not-started) and
 * HomeLandingLoggedInStarted (league phase) — identical treatment on both,
 * per the started page's own wireframe note ("welcome message, same as
 * logged in not started").
 */
export function HomeWelcomeBanner({ me, showCta }: HomeWelcomeBannerProps) {
  const countdown = useCountdown(PREDICTIONS_CLOSE_MS);

  return (
    <Frame className="shrink-0 animate-cotton-rise">
      <FrameBody className="flex flex-col gap-4 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="size-11 shrink-0">
            <AvatarImage src={me.photoURL} alt="" />
            <AvatarFallback className="font-mono text-xs text-color_textsecondary">
              {initials(me)}
            </AvatarFallback>
          </Avatar>
          <p className="min-w-0 truncate font-display text-lg text-color_text sm:text-xl">
            Welcome back, <span className="font-bold">{me.displayName}</span>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-5 sm:gap-6">
          {showCta && (
            <Link
              to="/predictions"
              className="inline-flex shrink-0 items-center gap-2 rounded-full bg-color_text px-5 py-2.5 text-xs font-semibold text-background outline-none transition-all duration-150 ease-[var(--ease-cotton)] hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-color_accent"
            >
              Make your predictions
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          )}

          {!countdown.expired && (
            <div className="flex items-baseline gap-3.5 whitespace-nowrap">
              <span className="font-mono text-[0.7rem] tracking-[0.12em] text-color_textsecondary uppercase">
                Entries close in
              </span>
              <div className="flex items-baseline gap-3">
                <MiniCountdownDigit value={countdown.days} label="Days" />
                <MiniCountdownDigit value={countdown.hours} label="Hrs" />
                <MiniCountdownDigit value={countdown.minutes} label="Min" />
                <MiniCountdownDigit value={countdown.seconds} label="Sec" />
              </div>
            </div>
          )}
        </div>
      </FrameBody>
    </Frame>
  );
}
