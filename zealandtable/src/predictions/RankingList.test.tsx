import { render, screen, fireEvent, act } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { RankingList } from "./RankingList";
import { BOUNDARY_SPAN } from "./predictionBoundary";

const ranking = ["arsenal", "chelsea", "everton", "fulham"];

describe("RankingList", () => {
  it("renders each club with its rank number", () => {
    render(<RankingList ranking={ranking} />);
    expect(screen.getByText("Arsenal")).toBeInTheDocument();
    expect(screen.getByText("Chelsea")).toBeInTheDocument();
    expect(screen.getByText("Everton")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("shows the average position when given", () => {
    render(<RankingList ranking={ranking} averagePositions={{ arsenal: 4.5 }} />);
    expect(screen.getByText("4.5")).toBeInTheDocument();
  });

  it("glows a club that's currently correct", () => {
    render(<RankingList ranking={ranking} correctness={{ arsenal: true, chelsea: false }} />);
    expect(screen.getByText("Arsenal").closest("li")).toHaveClass("border-color_green/50");
    expect(screen.getByText("Chelsea").closest("li")).not.toHaveClass("border-color_green/50");
  });

  it("calls onSelectTeam with the club id when a row is clicked, and is non-interactive without it", () => {
    const onSelectTeam = vi.fn();
    const { rerender } = render(<RankingList ranking={ranking} onSelectTeam={onSelectTeam} />);
    fireEvent.click(screen.getByText("Chelsea"));
    expect(onSelectTeam).toHaveBeenCalledWith("chelsea");

    rerender(<RankingList ranking={ranking} />);
    expect(screen.getByText("Chelsea").closest("li")).not.toHaveClass("cursor-pointer");
  });

  describe("boundary hover", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    // The band is one row either side here, not the parent's two — BOUNDARY_SPAN
    // is derived from tablePointsFor, which stops paying past off-by-one.
    it("tints the band around a row hovered long enough, pulsing everywhere but the origin", () => {
      expect(BOUNDARY_SPAN).toBe(1);
      render(<RankingList ranking={ranking} />);
      const row = screen.getByText("Chelsea").closest("li")!;
      fireEvent.mouseEnter(row);
      act(() => vi.advanceTimersByTime(2000));
      expect(screen.getByText("Arsenal").closest("li")).toHaveClass("bg-foreground/[0.06]", "animate-pulse");
      expect(screen.getByText("Everton").closest("li")).toHaveClass("bg-foreground/[0.06]", "animate-pulse");
      expect(row).toHaveClass("bg-foreground/[0.06]");
      expect(row).not.toHaveClass("animate-pulse");
    });

    it("leaves rows outside the band untinted", () => {
      render(<RankingList ranking={ranking} />);
      fireEvent.mouseEnter(screen.getByText("Arsenal").closest("li")!);
      act(() => vi.advanceTimersByTime(2000));
      expect(screen.getByText("Everton").closest("li")).not.toHaveClass("bg-foreground/[0.06]");
    });

    it("does not tint anything before the dwell time passes", () => {
      render(<RankingList ranking={ranking} />);
      const row = screen.getByText("Chelsea").closest("li")!;
      fireEvent.mouseEnter(row);
      expect(row).not.toHaveClass("bg-foreground/[0.06]");
    });
  });
});
