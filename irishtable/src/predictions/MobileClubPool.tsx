import { useDraggable, useDroppable } from "@dnd-kit/core";
import { memo } from "react";
import { Team } from "./teams";
import { TeamCrest } from "../leaderboard/TeamCrest";
import { cn } from "@/lib/utils";

/**
 * The club pool on a phone — a crest grid with the club's short name written
 * under each badge.
 *
 * This is the one panel that deliberately does *not* follow the parent.
 * kupatakipucl replaces its crest grid with a plain text list on mobile,
 * because `TeamGrid` puts the club name in a tooltip that only appears after
 * 750ms of **hover** (which a touchscreen never produces) and because every
 * crest in that project is deliberately assigned to the wrong club pending a
 * roster swap — so a grid on a phone would be 36 unidentifiable badges.
 *
 * Neither condition holds here: irishtable's crests are Mert's own and each
 * belongs to its real club. Printing the name under the badge solves the
 * tooltip problem outright, which is what Mert chose over the text list.
 *
 * Drag ids match `TeamGrid`'s exactly (`grid:${team.id}`), so TeamRanker's
 * drag handling, the `grid-return` drop target and the placed/unplaced logic
 * all work unchanged — this swaps the panel's appearance, not its wiring.
 */

const PoolTile = memo(function PoolTile({ team, isPlaced }: { team: Team; isPlaced: boolean }) {
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: `grid:${team.id}` });
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    transform,
    isDragging,
  } = useDraggable({ id: `grid:${team.id}`, disabled: isPlaced });

  const combinedRef = (node: HTMLElement | null) => {
    setDropRef(node);
    setDragRef(node);
  };

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={combinedRef}
      {...(isPlaced ? {} : attributes)}
      {...(isPlaced ? {} : listeners)}
      style={style}
      className={cn(
        "flex flex-col items-center justify-center gap-1 rounded-xl border p-1.5 select-none",
        "transition-[border-color,background-color,opacity] duration-200 ease-[var(--ease-cotton)]",
        // touch-manipulation (not touch-none) is what lets the TouchSensor's
        // press-and-hold win. touch-action: none blocks native panning from
        // the very first touch, before the 200ms delay has even had a chance
        // to decide whether this is a scroll or a hold — which is what made
        // the pool unscrollable on a phone, since almost every pixel in the
        // grid is a tile. manipulation still allows native scrolling; dnd-kit
        // only needs to win once the hold is confirmed.
        !isPlaced && "touch-manipulation",
        isPlaced
          ? "border-dashed border-color_border1/40 bg-foreground/[0.01]"
          : "border-color_border1/60 bg-background/80",
        isOver && "border-color_accent/80 bg-foreground/[0.08]",
        isDragging && "opacity-0"
      )}
    >
      {isPlaced ? (
        // Keeps the tile's height without redrawing a badge that is now on
        // the ranking side — an empty grid that reflows as clubs are placed
        // would move every remaining target out from under a finger.
        <span className="flex h-[3.4rem] items-center font-mono text-[0.55rem] tracking-[0.14em] text-color_textsecondary/50 uppercase">
          Ranked
        </span>
      ) : (
        <>
          <TeamCrest teamId={team.id} className="size-9 shrink-0" />
          <span className="w-full truncate text-center font-display text-[0.6rem] leading-tight text-color_text">
            {team.shortName}
          </span>
        </>
      )}
    </div>
  );
});

export function MobileClubPool({
  teams,
  placedTeamIds,
}: {
  teams: Team[];
  placedTeamIds: Set<string>;
}) {
  const { setNodeRef } = useDroppable({ id: "grid-return" });

  return (
    <div ref={setNodeRef} className="p-1">
      <div className="grid grid-cols-4 gap-2">
        {teams.map((team) => (
          <PoolTile key={team.id} team={team} isPlaced={placedTeamIds.has(team.id)} />
        ))}
      </div>
    </div>
  );
}
