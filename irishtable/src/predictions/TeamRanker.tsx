import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  Modifier,
  MouseSensor,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useCallback, useMemo, useState } from "react";
import { Team } from "./teams";
import { TeamCrest } from "../leaderboard/TeamCrest";
import { TeamGrid } from "./TeamGrid";
import { MobileClubPool } from "./MobileClubPool";
import { TeamDropList } from "./TeamDropList";
import { Button } from "@/components/ui/button";
import { GripVerticalIcon } from "lucide-react";
import { useIsMobile } from "@/lib/useIsMobile";

interface TeamRankerProps {
  teams: readonly Team[];
  /**
   * Optional: pre-populate the ranking list on mount.
   * Must be a full-length array (same length as `teams`) to take effect —
   * a partial array is ignored and the list starts empty.
   * Used by the profile-page edit widget; the first-time prediction flow
   * leaves this unset so all slots start empty.
   */
  initialOrder?: string[];
  /** Label on the confirm button. The flow says "Continue" because there are
   *  eight award stages still to come; the profile edit widget says "Save". */
  submitLabel?: string;
  onSubmit: (order: string[]) => void;
}

/**
 * Modifier to center the drag overlay under the cursor regardless of where
 * the user grabbed the element.
 */
const snapCenterToCursor: Modifier = ({ transform, activatorEvent, draggingNodeRect }) => {
  if (activatorEvent && draggingNodeRect) {
    const event = activatorEvent as MouseEvent | TouchEvent;
    const clientX =
      "touches" in event && event.touches && event.touches[0]
        ? event.touches[0].clientX
        : (event as MouseEvent).clientX;
    const clientY =
      "touches" in event && event.touches && event.touches[0]
        ? event.touches[0].clientY
        : (event as MouseEvent).clientY;

    if (clientX != null && clientY != null) {
      const grabX = clientX - draggingNodeRect.left;
      const grabY = clientY - draggingNodeRect.top;
      return {
        ...transform,
        x: transform.x + (grabX - draggingNodeRect.width / 2),
        y: transform.y + (grabY - draggingNodeRect.height / 2),
      };
    }
  }
  return transform;
};

/**
 * Two-panel drag-and-drop ranking UI for the predicted table.
 */
export function TeamRanker({ teams, initialOrder, submitLabel = "Continue", onSubmit }: TeamRankerProps) {
  const [ranking, setRanking] = useState<(string | null)[]>(() => {
    if (initialOrder && initialOrder.length === teams.length) {
      return [...initialOrder];
    }
    return Array(teams.length).fill(null);
  });

  const [activeId, setActiveId] = useState<string | null>(null);
  const isMobile = useIsMobile();

  // Touch needs a fundamentally different activation gesture from a mouse.
  // A 5px-distance PointerSensor on a phone claims the very drag the page
  // needs for scrolling, so both of this screen's panels become unscrollable
  // the moment a finger lands on a club. Press-and-hold separates the two
  // intents cleanly: a swipe scrolls, a held finger drags.
  //
  // Desktop keeps PointerSensor exactly as it was — this branches rather
  // than replacing it outright so nothing about the mouse path changes.
  const mobileSensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const desktopSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const sensors = isMobile ? mobileSensors : desktopSensors;

  const sortedTeams = useMemo(
    () => [...teams].sort((a, b) => a.name.localeCompare(b.name)),
    [teams]
  );

  const teamsById = useMemo(() => new Map<string, Team>(teams.map((t) => [t.id, t])), [teams]);

  const placedTeamIds = useMemo(
    () => new Set(ranking.filter(Boolean) as string[]),
    [ranking]
  );

  // Resolve which club is riding under the pointer during a drag.
  const activeDragTeamId: string | null = useMemo(() => {
    if (!activeId) return null;
    if (activeId.startsWith("grid:")) return activeId.slice(5);
    if (activeId.startsWith("list:")) {
      const slot = parseInt(activeId.slice(5), 10);
      return ranking[slot] ?? null;
    }
    return null;
  }, [activeId, ranking]);

  const activeDragTeam = activeDragTeamId ? teamsById.get(activeDragTeamId) : null;

  // ── Reorder ────────────────────────────────────────────────────────────────

  /**
   * Swap two slots. The single reorder primitive — the drag path's
   * list→list branch and the up/down buttons both go through here, which is
   * what makes "reorder by drag" and "reorder by button" provably the same
   * operation rather than two implementations that agree today.
   */
  const moveSlot = useCallback((from: number, to: number) => {
    setRanking((r) => {
      if (from === to || to < 0 || to >= r.length) return r;
      const next = [...r];
      [next[from], next[to]] = [next[to], next[from]];
      return next;
    });
  }, []);

  // ── Drag handlers ──────────────────────────────────────────────────────────
  // useCallback so DndContext (which takes these as props) doesn't see a new
  // handler identity on every render — just on the renders that actually
  // change what a drag should do.

  const handleDragStart = useCallback(({ active }: DragStartEvent) => {
    setActiveId(String(active.id));
  }, []);

  const handleDragEnd = useCallback(({ active, over }: DragEndEvent) => {
    setActiveId(null);

    const activeStr = String(active.id);

    if (!over) {
      // Dropped over nothing: if it was a list item, return it to the pool.
      if (activeStr.startsWith("list:")) {
        const src = parseInt(activeStr.slice(5), 10);
        setRanking((r) => r.map((id, i) => (i === src ? null : id)));
      }
      return;
    }

    const overStr = String(over.id);

    if (overStr.startsWith("slot:")) {
      const targetSlot = parseInt(overStr.slice(5), 10);

      if (activeStr.startsWith("grid:")) {
        // ─ Pool → List ─
        const teamId = activeStr.slice(5);
        setRanking((r) => {
          const next = [...r];
          // If target slot was occupied, that club returns to the pool automatically
          next[targetSlot] = teamId;
          return next;
        });
      } else if (activeStr.startsWith("list:")) {
        // ─ List → List (reorder / swap) ─
        moveSlot(parseInt(activeStr.slice(5), 10), targetSlot);
      }
    } else if (overStr.startsWith("grid:") || overStr === "grid-return") {
      // ─ List → Pool (return or swap with a club in the pool) ─
      if (activeStr.startsWith("list:")) {
        const srcSlot = parseInt(activeStr.slice(5), 10);

        if (overStr.startsWith("grid:")) {
          const targetTeamId = overStr.slice(5);
          // Is targetTeamId currently in the pool (i.e. not placed on left)?
          if (!placedTeamIds.has(targetTeamId)) {
            // SWAP: pool club moves to srcSlot on left, left club returns to pool
            setRanking((r) => {
              const next = [...r];
              next[srcSlot] = targetTeamId;
              return next;
            });
            return;
          }
        }

        // Otherwise (empty pool cell or grid-return): return the club to the pool
        setRanking((r) => r.map((id, i) => (i === srcSlot ? null : id)));
      }
    }
  }, [moveSlot, placedTeamIds]);

  // ── Derived state ──────────────────────────────────────────────────────────

  const allPlaced = ranking.every((id) => id !== null);

  function handleReset() {
    setRanking(Array(teams.length).fill(null));
  }

  function handleSubmit() {
    onSubmit(ranking.filter(Boolean) as string[]);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        {/* Instruction — the mobile gesture is genuinely different, so the
            sentence describing it has to be too. */}
        <p className="text-center font-display text-sm text-color_textsecondary">
          {isMobile ? (
            <>
              Press and hold a club, then drag it into your table.{" "}
              <span className="text-color_textsecondary/60">
                Placed clubs can be pulled back out or reordered with the arrows.
              </span>
            </>
          ) : (
            <>
              Drag the clubs on the right into your table on the left.{" "}
              <span className="text-color_textsecondary/60">
                Placed clubs can be pulled back out or reordered with the arrows.
              </span>
            </>
          )}
        </p>

        {/* Two panels — side by side on desktop, stacked on mobile with the
            ranking on top and the pool beneath. */}
        <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
          {/* Ranking drop list */}
          <div className="flex min-h-0 flex-1 flex-col lg:w-72 lg:flex-none lg:shrink-0">
            <TeamDropList ranking={ranking} teamsById={teamsById} onMove={moveSlot} />
          </div>

          {/* Club pool, top-aligned to prevent flexbox overflow clipping */}
          <div className="no-scrollbar flex min-h-0 flex-1 flex-col justify-start overflow-y-auto py-2">
            {isMobile ? (
              <MobileClubPool teams={sortedTeams} placedTeamIds={placedTeamIds} />
            ) : (
              <TeamGrid teams={sortedTeams} placedTeamIds={placedTeamIds} />
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-2 pt-1">
          <Button variant="outline" className="cursor-pointer" onClick={handleReset}>
            Reset
          </Button>
          <Button className="cursor-pointer" disabled={!allPlaced} onClick={handleSubmit}>
            {submitLabel}
          </Button>
        </div>
      </div>

      {/* Drag overlay — centered under cursor, no drop animation (disappears instantly on drop) */}
      <DragOverlay modifiers={[snapCenterToCursor]} dropAnimation={null}>
        {activeDragTeam && (
          <div className="flex h-[42px] w-64 cursor-grabbing items-center gap-2.5 rounded-lg border border-color_border1/80 bg-background px-3 py-2 shadow-frame select-none">
            <GripVerticalIcon aria-hidden className="size-3.5 shrink-0 text-color_textsecondary/40" />
            <TeamCrest teamId={activeDragTeam.id} className="size-7 shrink-0" />
            <span className="min-w-0 flex-1 truncate font-display text-sm text-color_text">
              {activeDragTeam.name}
            </span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
