import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Frame, FrameBody } from "@/components/ui/frame";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useCountdown } from "../useCountdown";
import { PREDICTIONS_CLOSE_MS } from "@/data/deadlines";
import { initials } from "../../profile/deletedAccount";
import type { Player } from "../../profile/usePlayers";

/**
 * The welcome oblong — greeting, countdown, and the prediction CTA when
 * there's still one to make.
 *
 * Its desktop counterpart lays all three out on one line and stacks to two on
 * narrow screens, which at 390px puts a four-digit countdown, an eyebrow
 * label and a pill button into a wrapping row that never lands the same way
 * twice. This version fixes the shape instead: name on the first line,
 * countdown on the second as four evenly-divided columns, CTA full-width
 * beneath when shown.
 *
 * Mert's wireframe note on this block, verbatim: *"Not touching the edges.
 * It's an oblong inside this frame."* — hence the page gutter around it
 * rather than a full-bleed band.
 */
export function MobileWelcomeBanner({ me, showCta }: { me: Player; showCta: boolean }) {
  const countdown = useCountdown(PREDICTIONS_CLOSE_MS);

  return (
    <Frame className="shrink-0 animate-cotton-rise">
      <FrameBody className="flex flex-col gap-3.5 px-4 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="size-10 shrink-0">
            <AvatarImage src={me.photoURL} alt="" />
            <AvatarFallback className="font-mono text-xs text-color_textsecondary">
              {initials(me)}
            </AvatarFallback>
          </Avatar>
          <p className="min-w-0 truncate font-display text-lg text-color_text">
            Welcome back, <span className="font-bold">{me.displayName}</span>.
          </p>
        </div>

        {!countdown.expired && (
          <div className="flex flex-col gap-1.5 border-t border-color_border1/40 pt-3">
            <span className="font-mono text-[0.55rem] tracking-[0.2em] text-color_textsecondary uppercase">
              Entries close in
            </span>
            <div className="grid grid-cols-4">
              <MiniDigit value={countdown.days} label="Days" />
              <MiniDigit value={countdown.hours} label="Hrs" />
              <MiniDigit value={countdown.minutes} label="Min" />
              <MiniDigit value={countdown.seconds} label="Sec" />
            </div>
          </div>
        )}

        {showCta && (
          <Link
            to="/predictions"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-color_text px-5 py-2.5 text-xs font-semibold text-background no-underline outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-color_accent"
          >
            Make your predictions
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        )}
      </FrameBody>
    </Frame>
  );
}

function MiniDigit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="font-display text-xl leading-none font-semibold text-color_text tnum">
        {String(value).padStart(2, "0")}
      </span>
      <span className="font-mono text-[0.55rem] tracking-[0.14em] text-color_textsecondary uppercase">
        {label}
      </span>
    </div>
  );
}
