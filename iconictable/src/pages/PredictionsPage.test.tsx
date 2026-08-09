import { render, screen, fireEvent, act } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { PredictionsPage } from "./PredictionsPage";
import { AWARDS } from "@/data/awards";
import { CLUBS } from "@/data/clubs";
import { PREDICTION_INTRO_BEATS } from "@/predictions/predictionIntroCopy";

// motion's exit animations never resolve in jsdom, which leaves the outgoing
// stage in the DOM. Passthrough — this is a test of the stage machine.
vi.mock("motion/react", async () => {
  const actual = await vi.importActual<typeof import("motion/react")>("motion/react");
  const passthrough =
    (tag: string) =>
    ({ children, initial, animate, exit, variants, transition, ...rest }: any) => {
      const Tag = tag as any;
      return <Tag {...rest}>{children}</Tag>;
    };
  return {
    ...actual,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: new Proxy({} as Record<string, ReturnType<typeof passthrough>>, {
      get: (_target, tag: string) => passthrough(tag),
    }),
  };
});

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Navigate: ({ to }: { to: string }) => <div>redirected-to:{to}</div>,
  };
});

const mockSavePrediction = vi.fn();
let mockPrediction: unknown = null;

vi.mock("@/predictions/usePrediction", async () => {
  const actual = await vi.importActual<typeof import("@/predictions/usePrediction")>(
    "@/predictions/usePrediction"
  );
  return {
    ...actual,
    usePrediction: () => ({ data: mockPrediction, loading: false, error: null }),
    savePrediction: (...args: unknown[]) => mockSavePrediction(...args),
  };
});

vi.mock("@/predictions/useSurveyResponse", async () => {
  const actual = await vi.importActual<typeof import("@/predictions/useSurveyResponse")>(
    "@/predictions/useSurveyResponse"
  );
  return {
    ...actual,
    useSurveyResponse: () => ({ data: { clubSupported: "arsenal" }, loading: false, error: null }),
  };
});

vi.mock("@/auth/AuthProvider", () => ({
  useAuth: () => ({ user: { uid: "uid1" }, loading: false }),
}));

// The real ranker is drag-driven and covered by its own suite; here it only
// has to be able to hand a finished table back to the page.
vi.mock("@/predictions/TeamRanker", () => ({
  TeamRanker: ({ onSubmit }: { onSubmit: (order: string[]) => void }) => (
    <button onClick={() => onSubmit(CLUBS.map((c) => c.id))}>submit-table</button>
  ),
}));

vi.mock("@/predictions/AwardPickerStage", () => ({
  AwardPickerStage: ({
    award,
    index,
    value,
    onPick,
  }: {
    award: { id: string; label: string };
    index: number;
    value?: string | null;
    onPick: (id: string) => void;
  }) => (
    <div>
      <span>stage:{award.id}</span>
      <span>stage-index:{index}</span>
      {value && <span>seeded:{value}</span>}
      <button onClick={() => onPick(`pick-${award.id}`)}>pick</button>
    </div>
  ),
}));

vi.mock("@/lib/useImagePreload", () => ({ useImagePreload: () => true }));

function renderPage() {
  return render(
    <MemoryRouter>
      <PredictionsPage />
    </MemoryRouter>
  );
}

/** Click through the intro beats and the table stage. */
function reachFirstAward() {
  for (let i = 0; i < PREDICTION_INTRO_BEATS.length; i++) {
    fireEvent.click(screen.getByText("Continue"));
  }
  fireEvent.click(screen.getByText("submit-table"));
}

/** Answer every award, landing on the review stage. */
function answerAllAwards() {
  for (let i = 0; i < AWARDS.length; i++) {
    fireEvent.click(screen.getByText("pick"));
  }
}

describe("PredictionsPage", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockSavePrediction.mockReset();
    mockSavePrediction.mockResolvedValue(undefined);
    mockPrediction = null;
  });

  it("walks intro → table → every award → review", () => {
    renderPage();
    expect(screen.getByText(PREDICTION_INTRO_BEATS[0].text)).toBeInTheDocument();

    reachFirstAward();
    expect(screen.getByText(`stage:${AWARDS[0].id}`)).toBeInTheDocument();

    answerAllAwards();
    expect(screen.getByText("One last look.")).toBeInTheDocument();
  });

  it("advances one award at a time, in the order awards.ts declares", () => {
    renderPage();
    reachFirstAward();
    AWARDS.forEach((award, i) => {
      expect(screen.getByText(`stage:${award.id}`)).toBeInTheDocument();
      expect(screen.getByText(`stage-index:${i + 1}`)).toBeInTheDocument();
      fireEvent.click(screen.getByText("pick"));
    });
  });

  it("back steps one award at a time, and out of the first award to the table", () => {
    renderPage();
    reachFirstAward();
    fireEvent.click(screen.getByText("pick")); // now on award 2

    fireEvent.click(screen.getByLabelText("Back"));
    expect(screen.getByText(`stage:${AWARDS[0].id}`)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Back"));
    expect(screen.getByText("submit-table")).toBeInTheDocument();
  });

  it("seeds a revisited award with the answer already given", () => {
    renderPage();
    reachFirstAward();
    fireEvent.click(screen.getByText("pick"));
    fireEvent.click(screen.getByLabelText("Back"));
    expect(screen.getByText(`seeded:pick-${AWARDS[0].id}`)).toBeInTheDocument();
  });

  // The review's per-row edit is a jump, not a rewind: confirming that one
  // stage has to come straight back rather than marching through the rest.
  it("returns to review after editing a single award from the review", () => {
    renderPage();
    reachFirstAward();
    answerAllAwards();

    fireEvent.click(screen.getByLabelText(`Edit ${AWARDS[2].label}`));
    expect(screen.getByText(`stage:${AWARDS[2].id}`)).toBeInTheDocument();

    fireEvent.click(screen.getByText("pick"));
    expect(screen.getByText("One last look.")).toBeInTheDocument();
  });

  it("returns to review after editing the table from the review", () => {
    renderPage();
    reachFirstAward();
    answerAllAwards();

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByText("submit-table")).toBeInTheDocument();

    fireEvent.click(screen.getByText("submit-table"));
    expect(screen.getByText("One last look.")).toBeInTheDocument();
  });

  it("writes the whole draft on submit, then shows the confirmation", async () => {
    renderPage();
    reachFirstAward();
    answerAllAwards();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send it" }));
    });

    expect(mockSavePrediction).toHaveBeenCalledWith("uid1", {
      table: CLUBS.map((c) => c.id),
      awards: Object.fromEntries(AWARDS.map((a) => [a.id, `pick-${a.id}`])),
    });
    expect(screen.getByText("Your prediction is in.")).toBeInTheDocument();
  });

  it("surfaces a failed write on the review stage instead of advancing", async () => {
    mockSavePrediction.mockRejectedValue(new Error("network"));
    renderPage();
    reachFirstAward();
    answerAllAwards();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send it" }));
    });

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("One last look.")).toBeInTheDocument();
  });

  it("allows editing when a prediction already exists with choices pre-filled", () => {
    mockPrediction = { table: CLUBS.map((c) => c.id) };
    renderPage();
    expect(screen.getByText("One last look.")).toBeInTheDocument();
  });
});
