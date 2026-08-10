import { CSSProperties } from "react";
import { Shield } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { teamCrestSrc } from "../predictions/teams";
import { cn } from "@/lib/utils";

/**
 * A team crest, square (not circular like a participant Avatar), with a
 * quiet shield placeholder if a badge ever fails to load. Real club badge
 * SVGs (public/crests/), each on its own real club — unlike the parent,
 * which hash-assigns them. See teamCrestSrc in predictions/teams.ts.
 *
 * `style` is forwarded (not just `className`) so callers that need a
 * runtime-computed size — TeamPopup.tsx's tunable crest/row-avatar sizes —
 * can set width/height directly rather than needing a matching Tailwind
 * class to exist ahead of time.
 */
export function TeamCrest({
  teamId,
  className,
  style,
}: {
  teamId: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <Avatar
      className={cn(
        "size-7 shrink-0 rounded-sm after:rounded-sm after:border-transparent",
        className
      )}
      style={style}
    >
      <AvatarImage
        src={teamCrestSrc(teamId)}
        alt=""
        className="rounded-sm object-contain"
      />
      <AvatarFallback className="rounded-sm bg-secondary">
        <Shield
          className="size-4 text-color_textsecondary/50"
          strokeWidth={1.5}
        />
      </AvatarFallback>
    </Avatar>
  );
}
