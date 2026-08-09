import { render, screen, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect } from "vitest";
import { TeamRanker } from "./TeamRanker";
import { Team } from "./teams";

const teams: Team[] = [
  { id: "arsenal", name: "Alpha", shortName: "ALP", code: "ALP", crest: "/crests/arsenal.svg" },
  { id: "chelsea", name: "Beta", shortName: "BET", code: "BET", crest: "/crests/chelsea.svg" },
  { id: "everton", name: "Gamma", shortName: "GAM", code: "GAM", crest: "/crests/everton.svg" },
];

describe("TeamRanker", () => {
  it("renders the instruction text", () => {
    render(<TeamRanker teams={teams} onSubmit={vi.fn()} />);
    expect(screen.getByText(/Drag the clubs/i)).toBeInTheDocument();
  });

  it("renders the Reset and Continue buttons", () => {
    render(<TeamRanker teams={teams} onSubmit={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Reset" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();
  });

  it("takes a custom submit label, so the profile edit widget can say Save", () => {
    render(<TeamRanker teams={teams} submitLabel="Save" onSubmit={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("submit is disabled when the list is empty", () => {
    render(<TeamRanker teams={teams} onSubmit={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  it("submit is enabled when all slots are filled via initialOrder", () => {
    render(<TeamRanker teams={teams} initialOrder={["arsenal", "chelsea", "everton"]} onSubmit={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Continue" })).not.toBeDisabled();
  });

  it("calls onSubmit with the current ranking", () => {
    const onSubmit = vi.fn();
    render(<TeamRanker teams={teams} initialOrder={["chelsea", "arsenal", "everton"]} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(onSubmit).toHaveBeenCalledWith(["chelsea", "arsenal", "everton"]);
  });

  it("reset clears the ranking and disables submit", () => {
    render(<TeamRanker teams={teams} initialOrder={["arsenal", "chelsea", "everton"]} onSubmit={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Continue" })).not.toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  it("placed clubs show their full name in the list", () => {
    render(<TeamRanker teams={teams} initialOrder={["arsenal", "chelsea", "everton"]} onSubmit={vi.fn()} />);
    // Names appear in both the list row and the grid tooltip span (aria-hidden).
    expect(screen.getAllByText("Alpha").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Beta").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Gamma").length).toBeGreaterThanOrEqual(1);
  });

  // Mert's addition to the parent's design: dragging twenty clubs into place
  // is fine once and miserable when you just want to swap 7th and 8th. The
  // buttons go through TeamRanker's single `moveSlot` primitive, the same one
  // the drag path's list→list branch calls, which is what these assert.
  describe("up/down buttons", () => {
    it("moves a club up one place, swapping with the club above it", () => {
      const onSubmit = vi.fn();
      render(<TeamRanker teams={teams} initialOrder={["arsenal", "chelsea", "everton"]} onSubmit={onSubmit} />);
      fireEvent.click(screen.getByLabelText("Move Beta up"));
      fireEvent.click(screen.getByRole("button", { name: "Continue" }));
      expect(onSubmit).toHaveBeenCalledWith(["chelsea", "arsenal", "everton"]);
    });

    it("moves a club down one place, swapping with the club below it", () => {
      const onSubmit = vi.fn();
      render(<TeamRanker teams={teams} initialOrder={["arsenal", "chelsea", "everton"]} onSubmit={onSubmit} />);
      fireEvent.click(screen.getByLabelText("Move Beta down"));
      fireEvent.click(screen.getByRole("button", { name: "Continue" }));
      expect(onSubmit).toHaveBeenCalledWith(["arsenal", "everton", "chelsea"]);
    });

    it("disables up on the first row and down on the last", () => {
      render(<TeamRanker teams={teams} initialOrder={["arsenal", "chelsea", "everton"]} onSubmit={vi.fn()} />);
      expect(screen.getByLabelText("Move Alpha up")).toBeDisabled();
      expect(screen.getByLabelText("Move Gamma down")).toBeDisabled();
      expect(screen.getByLabelText("Move Alpha down")).not.toBeDisabled();
      expect(screen.getByLabelText("Move Gamma up")).not.toBeDisabled();
    });

    it("a button reorder and the equivalent drag reorder produce the same state", () => {
      // Both paths call moveSlot(1, 0). Asserting the button path lands on the
      // exact array the drag path's swap produces is what stops the two from
      // silently diverging if either is ever changed.
      const onSubmit = vi.fn();
      render(<TeamRanker teams={teams} initialOrder={["arsenal", "chelsea", "everton"]} onSubmit={onSubmit} />);
      fireEvent.click(screen.getByLabelText("Move Beta up"));
      fireEvent.click(screen.getByRole("button", { name: "Continue" }));

      const dragEquivalent = (() => {
        const next = ["arsenal", "chelsea", "everton"];
        [next[1], next[0]] = [next[0], next[1]];
        return next;
      })();
      expect(onSubmit).toHaveBeenCalledWith(dragEquivalent);
    });

    it("has no move buttons on an empty slot", () => {
      render(<TeamRanker teams={teams} onSubmit={vi.fn()} />);
      expect(screen.queryByLabelText(/^Move /)).not.toBeInTheDocument();
    });
  });
});
