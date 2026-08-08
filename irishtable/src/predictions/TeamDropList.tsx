import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronUp, GripVerticalIcon } from "lucide-react";
import { memo, useCallback } from "react";
import { Team } from "./teams";
import { TeamCrest } from "../leaderboard/TeamCrest";
import { useBoundaryHover } from "./useBoundaryHover";
import { boundaryBandRole } from "./predictionBoundary";
import { RELEGATION_POSITIONS } from "@/data/scoring";
import { cn } from "@/lib/utils";

interface TeamDropListProps {
  ranking: (string | null)[];
  teamsById: Map<string, Team>;
  /** Swap a slot with its neighbour. The same handler the drag path calls,
   *  so a keyboard/button reorder and a drag reorder cannot diverge. */
  onMove: (from: number, to: number) => void;
}

const ListSlot = memo(function ListSlot({
  index,
  teamId,
  team,
  inBand,
  isOrigin,
  canMoveUp,
  canMoveDown,
  onMove,
  onHoverStart,
  onMouseLeave,
  isChampion,
  isRelegation,
}: {
  index: number;
  teamId: string | null;
  team: Team | undefined;
  inBand: boolean;
  isOrigin: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove: (from: number, to: number) => void;
  /** Stable across renders — the slot builds its own bound handler below, so
   *  the parent doesn't hand down a fresh closure per row and defeat memo. */
  onHoverStart: (index: number) => void;
  onMouseLeave: () => void;
  /** 1st place — only lit once a club actually occupies the slot. */
  isChampion: boolean;
  /** One of the three relegation places (`RELEGATION_POSITIONS`) — same. */
  isRelegation: boolean;
}) {
  // Every slot is a drop target.
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `slot:${index}`,
  });

  // Occupied slots are also draggable (back to grid or to another slot).
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    transform,
    isDragging,
  } = useDraggable({
    id: `list:${index}`,
    disabled: teamId === null,
  });

  // Combine the drop-target ref and the drag-source ref on the same node.
  const combinedRef = (node: HTMLElement | null) => {
    setDropRef(node);
    setDragRef(node);
  };

  const style = transform ? { transform: CSS.Transform.toString(transform) } : undefined;

  const highlighted = inBand && !isDragging;

  const handleMouseEnter = useCallback(() => {
    if (teamId !== null) onHoverStart(index);
  }, [teamId, index, onHoverStart]);

  // Plain <li>, not <motion.li layout>. The layout animation re-measured
  // every slot's bounding box on every render — and this list re-renders on
  // every pointer move during a drag — while never actually animating
  // anything: the list is a fixed set of slots keyed by index, so a slot never
  // changes position, only its contents do. That measurement pass was the
  // single biggest cost in the parent's predictions page and profile edit
  // popup (2026-08-06).
  return (
    <li
      ref={combinedRef}
      style={style}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={onMouseLeave}
      className={cn(
        // 42px * 1.3, rounded — the frame around this list doesn't grow, so
        // taller rows just mean more of the list needs a scroll to reach.
        "flex h-[55px] items-center gap-2 rounded-lg border px-2 py-2 select-none",
        "transition-[border-color,background-color,box-shadow,opacity] duration-200 ease-[var(--ease-cotton)]",
        teamId !== null
          ? [
              // Champion/relegation tint only once a club is actually sitting
              // in the slot — an empty dashed slot tinted yellow or red reads
              // as an error state, not a hint about the position.
              isChampion
                ? "border-color_champion/50 bg-color_champion/[0.07]"
                : isRelegation
                  ? "border-color_remove/45 bg-color_remove/[0.07]"
                  : "border-color_border1/80 bg-background",
              "hover:border-color_border1 hover:bg-foreground/[0.03]",
              isDragging && "opacity-0 border-color_accent/40",
            ]
          : [
              "border-dashed bg-foreground/[0.01]",
              isOver
                ? "border-color_accent/80 bg-foreground/[0.06]"
                : "border-color_border1/40 hover:border-color_border1/60",
            ],
        highlighted && cn("bg-foreground/[0.06]", !isOrigin && "animate-pulse")
      )}
    >
      {/* Rank number */}
      <span className="w-5 shrink-0 text-right font-mono text-sm font-bold text-color_gold tnum">
        {index + 1}
      </span>

      {teamId !== null && team ? (
        <>
          {/* Only the grip and the club itself start a drag. The parent
              spreads the drag listeners across the whole row; with buttons on
              the row that would swallow every click before it reached them. */}
          <span
            {...attributes}
            {...listeners}
            className="flex min-w-0 flex-1 cursor-grab items-center gap-2.5 active:cursor-grabbing"
          >
            <GripVerticalIcon aria-hidden className="size-3.5 shrink-0 text-color_textsecondary/40" />
            <TeamCrest teamId={team.id} className="size-7 shrink-0" />
            <span className="min-w-0 flex-1 truncate font-display text-sm text-color_text">
              {team.name}
            </span>
          </span>

          {/* Mert's call: dragging twenty clubs into place is fine once, and
              miserable when you just want to swap 7th and 8th. These are the
              same reorder as a drag, one row at a time. */}
          <span className="flex shrink-0 flex-col">
            <button
              type="button"
              aria-label={`Move ${team.name} up`}
              disabled={!canMoveUp}
              onClick={() => onMove(index, index - 1)}
              className="flex cursor-pointer items-center justify-center rounded text-color_textsecondary transition-colors duration-150 hover:text-color_text disabled:pointer-events-none disabled:opacity-25"
            >
              <ChevronUp className="size-3.5" aria-hidden />
            </button>
            <button
              type="button"
              aria-label={`Move ${team.name} down`}
              disabled={!canMoveDown}
              onClick={() => onMove(index, index + 1)}
              className="flex cursor-pointer items-center justify-center rounded text-color_textsecondary transition-colors duration-150 hover:text-color_text disabled:pointer-events-none disabled:opacity-25"
            >
              <ChevronDown className="size-3.5" aria-hidden />
            </button>
          </span>
        </>
      ) : (
        <span className="min-w-0 flex-1 font-display text-xs text-color_textsecondary/30 italic">
          Drag a club here
        </span>
      )}
    </li>
  );
});

/**
 * The left-side ranking column — one numbered drop slot per club, initially
 * all empty. Occupied slots are draggable so the user can reorder internally
 * or drag a club back to the pool, and carry up/down buttons for the same
 * reorder without a drag. Slots highlight (`isOver`) when a dragged item is
 * directly above them.
 */
export function TeamDropList({ ranking, teamsById, onMove }: TeamDropListProps) {
  const { activeIndex, handleMouseEnter, handleMouseLeave } = useBoundaryHover();

  return (
    <ol className="no-scrollbar flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-1">
      {ranking.map((teamId, index) => {
        const inBand =
          teamId !== null &&
          activeIndex !== null &&
          boundaryBandRole(index, activeIndex, ranking.length) !== "none";
        const isOrigin = index === activeIndex;
        return (
          <ListSlot
            key={index}
            index={index}
            teamId={teamId}
            team={teamId !== null ? teamsById.get(teamId) : undefined}
            inBand={inBand}
            isOrigin={isOrigin}
            canMoveUp={index > 0}
            canMoveDown={index < ranking.length - 1}
            onMove={onMove}
            onHoverStart={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            isChampion={index === 0}
            isRelegation={RELEGATION_POSITIONS.includes(index + 1)}
          />
        );
      })}
    </ol>
  );
}
