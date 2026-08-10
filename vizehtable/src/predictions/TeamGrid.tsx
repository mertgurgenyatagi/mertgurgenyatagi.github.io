import { useDraggable, useDroppable } from "@dnd-kit/core";
import { memo, useRef, useState } from "react";
import { Team } from "./teams";
import { TeamCrest } from "../leaderboard/TeamCrest";
import { cn } from "@/lib/utils";

interface TeamGridProps {
  /** All teams to display in the grid, in alphabetical order. */
  teams: Team[];
  /** IDs of teams currently placed in the ranking list (shown as empty cells). */
  placedTeamIds: Set<string>;
}

const GridCell = memo(function GridCell({ team, isPlaced }: { team: Team; isPlaced: boolean }) {
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `grid:${team.id}`,
  });

  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    transform,
    isDragging,
  } = useDraggable({
    id: `grid:${team.id}`,
    disabled: isPlaced,
  });

  const [tooltipVisible, setTooltipVisible] = useState(false);
  const tooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleMouseEnter() {
    if (isPlaced) return;
    tooltipTimer.current = setTimeout(() => setTooltipVisible(true), 750);
  }

  function handleMouseLeave() {
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
    setTooltipVisible(false);
  }

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
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn(
        "relative flex aspect-square flex-col items-center justify-center rounded-xl border select-none p-1.5",
        // Transform deliberately left out of the transition list, and the
        // hover scale dropped: 36 cells each animating a transform kept the
        // whole grid on its own compositing layers during a drag, which is
        // most of what made this panel feel heavy. Color/opacity only now.
        "transition-[border-color,background-color,opacity] duration-200 ease-[var(--ease-cotton)]",
        isPlaced
          ? [
              "border-dashed bg-foreground/[0.01]",
              isOver
                ? "border-color_accent/80 bg-foreground/[0.06]"
                : "border-color_border1/40 hover:border-color_border1/60",
            ]
          : [
              "border-color_border1/60 bg-background/80 cursor-grab shadow-sm",
              isOver
                ? "border-color_accent/80 bg-foreground/[0.08]"
                : "hover:border-color_border1 hover:bg-foreground/[0.06]",
              "active:cursor-grabbing",
            ],
        isDragging && "opacity-0"
      )}
    >
      {!isPlaced && <TeamCrest teamId={team.id} className="size-11 shrink-0" />}

      {/* Expanding tooltip — name slides down after 0.75 s hover */}
      {!isPlaced && (
        <div
          aria-hidden
          className={cn(
            "absolute bottom-1 left-0 right-0 overflow-hidden px-1 transition-[max-height,opacity,margin] duration-300 ease-[var(--ease-cotton)]",
            tooltipVisible ? "max-h-8 opacity-100" : "max-h-0 opacity-0"
          )}
        >
          <span className="block text-center text-[10px] font-medium leading-tight text-color_text whitespace-nowrap truncate bg-background/90 rounded px-1 py-0.5 shadow-sm border border-color_border1/50">
            {team.name}
          </span>
        </div>
      )}
    </div>
  );
});

/**
 * The right-side pool panel — a 6-column grid of every team's crest. Teams
 * that have been dragged into the ranking list are shown as empty cells with
 * defined borders. Every cell (occupied or empty) is a drop target so items on
 * the left list can be dragged back or swapped.
 */
export function TeamGrid({ teams, placedTeamIds }: TeamGridProps) {
  const { setNodeRef } = useDroppable({ id: "grid-return" });

  return (
    <div ref={setNodeRef} className="p-1">
      <div className="grid grid-cols-6 gap-2.5">
        {teams.map((team) => (
          <GridCell key={team.id} team={team} isPlaced={placedTeamIds.has(team.id)} />
        ))}
      </div>
    </div>
  );
}
