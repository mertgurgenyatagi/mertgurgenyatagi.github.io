import { Avatar, AvatarImage, AvatarFallback, AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar";
import type { Player } from "../profile/usePlayers";
import { cn } from "@/lib/utils";

const VISIBLE = 3;

interface AvatarStackProps {
  players: Player[];
  className?: string;
}

/** Three faces, then an afterthought (PAGE_BRIEFING.txt: "stacked but
 *  horizontally, and after three it's kind of like an afterthought"). Reuses
 *  the shadcn AvatarGroup/AvatarGroupCount primitives already in the tree
 *  rather than hand-rolling the overlap/ring styling again. */
export function AvatarStack({ players, className }: AvatarStackProps) {
  const shown = players.slice(0, VISIBLE);
  const overflow = players.length - shown.length;

  return (
    <AvatarGroup className={cn(className)}>
      {shown.map((player) => (
        <Avatar key={player.uid} size="lg" className="ring-2 ring-background">
          <AvatarImage src={player.photoURL} alt="" />
          <AvatarFallback className="font-mono text-xs text-color_text">
            {player.displayName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      ))}
      {overflow > 0 && (
        <AvatarGroupCount className="size-10 ring-2 ring-background">+{overflow}</AvatarGroupCount>
      )}
    </AvatarGroup>
  );
}
