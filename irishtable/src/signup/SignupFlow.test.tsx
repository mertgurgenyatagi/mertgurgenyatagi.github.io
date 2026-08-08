import { render, screen, fireEvent, act } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { SignupFlow } from "./SignupFlow";

// AnimatePresence's exit animations never resolve under fake timers (motion
// drives them off rAF, not setTimeout), which leaves the outgoing step
// stuck in the DOM mid-test. Swapped for an immediate passthrough — this
// test is about the step machine's logic, not motion's own animation
// timing.
vi.mock("motion/react", async () => {
  const actual = await vi.importActual<typeof import("motion/react")>("motion/react");
  const passthrough =
    (tag: string) =>
    ({ children, initial, animate, exit, variants, transition, whileInView, viewport, ...rest }: any) => {
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

const mockSetDoc = vi.fn();
const mockSaveSurveyResponse = vi.fn();

// Unlike the parent, irishtable writes the profile inline rather than through
// a saveProfile() helper, so the Firestore call itself is what gets mocked.
vi.mock("firebase/firestore", () => ({
  doc: (_db: unknown, ...path: string[]) => ({ path: path.join("/") }),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
}));

// photosEnabled false is the real deployed configuration — Storage needs a
// paid plan and irishtable is on Spark. The photo step drops out of the order
// entirely in that state, which is exactly what the order test below asserts.
vi.mock("@/firebase", () => ({
  db: {},
  storage: {},
  photosEnabled: false,
}));

vi.mock("@/predictions/useSurveyResponse", () => ({
  saveSurveyResponse: (...args: unknown[]) => mockSaveSurveyResponse(...args),
}));

vi.mock("./steps/NameStep", () => ({
  NameStep: ({
    onSubmit,
    disabled,
    initialDisplayName,
  }: {
    onSubmit: (name: string) => void;
    disabled?: boolean;
    initialDisplayName?: string;
  }) => (
    <div>
      {initialDisplayName && <span>initial-name:{initialDisplayName}</span>}
      <button disabled={disabled} onClick={() => onSubmit("Mert")}>
        submit-name
      </button>
    </div>
  ),
}));

vi.mock("./steps/AgeRollerStep", () => ({
  AgeRollerStep: ({ onConfirm, defaultValue }: { onConfirm: (v: number) => void; defaultValue: number }) => (
    <div>
      <span>age-default:{defaultValue}</span>
      <button onClick={() => onConfirm(30)}>confirm-age</button>
    </div>
  ),
}));

vi.mock("./steps/CountryStep", () => ({
  CountryStep: ({
    onSelect,
    initialSelection,
  }: {
    onSelect: (code: string) => void;
    initialSelection?: string | null;
  }) => (
    <div>
      {initialSelection && <span>initial-country:{initialSelection}</span>}
      <button onClick={() => onSelect("IE")}>pick-country</button>
    </div>
  ),
}));

vi.mock("./steps/ClubStep", () => ({
  ClubStep: ({
    onSelect,
    initialSelection,
  }: {
    onSelect: (id: string) => void;
    initialSelection?: string | null;
  }) => (
    <div>
      {initialSelection && <span>initial-club:{initialSelection}</span>}
      <button onClick={() => onSelect("arsenal")}>pick-club</button>
    </div>
  ),
}));

vi.mock("./ChoiceStep", () => ({
  ChoiceStep: ({
    question,
    onSelect,
    disabled,
    initialValue,
  }: {
    question: string;
    onSelect: (v: string) => void;
    disabled?: boolean;
    initialValue?: string | null;
  }) => (
    <div>
      <span>question:{question}</span>
      {initialValue && <span>initial-value:{initialValue}</span>}
      <button disabled={disabled} onClick={() => onSelect("4")}>
        choose
      </button>
    </div>
  ),
}));

// waitFor/findBy poll via setTimeout internally, which never fires under
// fake timers — flushing the microtask queue directly and re-querying
// synchronously sidesteps that instead of fighting the two timer systems.
async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function reachNameStep() {
  await act(async () => {
    vi.advanceTimersByTime(2600); // past the welcome message's AutoAdvance
  });
}

/** Name → profile write → past the bounce screen, landing on quiz-age. */
async function reachQuiz() {
  await reachNameStep();
  fireEvent.click(screen.getByText("submit-name"));
  await flushMicrotasks();
  await act(async () => {
    vi.advanceTimersByTime(2000);
  });
}

describe("SignupFlow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockSetDoc.mockReset();
    mockSetDoc.mockResolvedValue(undefined);
    mockSaveSurveyResponse.mockReset();
    mockSaveSurveyResponse.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts at the welcome message, then auto-advances past it", async () => {
    render(<SignupFlow uid="uid1" onDone={vi.fn()} />);
    expect(screen.getByText(/welcome/i)).toBeInTheDocument();

    await reachNameStep();
    expect(screen.getByText("submit-name")).toBeInTheDocument();
  });

  it("skips the photo step entirely when photo uploads are off", async () => {
    render(<SignupFlow uid="uid1" onDone={vi.fn()} />);
    await reachNameStep();
    expect(screen.queryByLabelText("Choose a profile photo")).not.toBeInTheDocument();
  });

  it("writes the profile after the name step, then the survey after the last question, then calls onDone", async () => {
    const onDone = vi.fn();
    render(<SignupFlow uid="uid1" onDone={onDone} />);

    await reachNameStep();
    fireEvent.click(screen.getByText("submit-name"));
    await flushMicrotasks();
    expect(mockSetDoc).toHaveBeenCalledWith(
      { path: "profiles/uid1" },
      { displayName: "Mert", photoURL: "", createdAt: expect.any(Number) }
    );

    expect(screen.getByText(/five quick questions/i)).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    fireEvent.click(screen.getByText("confirm-age"));
    fireEvent.click(screen.getByText("pick-country"));
    fireEvent.click(screen.getByText("pick-club"));

    expect(screen.getByText("question:How would you rate your ball knowledge?")).toBeInTheDocument();
    fireEvent.click(screen.getByText("choose"));

    // The last question, which triggers the survey write.
    expect(screen.getByText("question:Which device will you mostly be using?")).toBeInTheDocument();
    fireEvent.click(screen.getByText("choose"));
    await flushMicrotasks();

    expect(mockSaveSurveyResponse).toHaveBeenCalledWith("uid1", {
      age: 30,
      country: "IE",
      clubSupported: "arsenal",
      ballKnowledge: 4,
      device: "4",
    });

    expect(screen.getByText(/all set/i)).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("shows an inline error and stays on the name step when the profile write fails", async () => {
    mockSetDoc.mockRejectedValue(new Error("network"));
    render(<SignupFlow uid="uid1" onDone={vi.fn()} />);

    await reachNameStep();
    fireEvent.click(screen.getByText("submit-name"));
    await flushMicrotasks();

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("submit-name")).toBeInTheDocument();
  });

  it("shows an inline error and stays on the last question when the survey write fails", async () => {
    mockSaveSurveyResponse.mockRejectedValue(new Error("network"));
    render(<SignupFlow uid="uid1" onDone={vi.fn()} />);

    await reachQuiz();
    fireEvent.click(screen.getByText("confirm-age"));
    fireEvent.click(screen.getByText("pick-country"));
    fireEvent.click(screen.getByText("pick-club"));
    fireEvent.click(screen.getByText("choose")); // knowledge
    fireEvent.click(screen.getByText("choose")); // device
    await flushMicrotasks();

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("question:Which device will you mostly be using?")).toBeInTheDocument();
  });

  it("hides the back button on the welcome and bounce screens", async () => {
    render(<SignupFlow uid="uid1" onDone={vi.fn()} />);
    expect(screen.queryByLabelText("Back")).not.toBeInTheDocument();

    await reachNameStep();
    // The name step is index 1 here (no photo step), so there is a step
    // behind it — but it's the welcome screen, which is auto-advancing.
    fireEvent.click(screen.getByText("submit-name"));
    await flushMicrotasks();
    expect(screen.queryByLabelText("Back")).not.toBeInTheDocument(); // bounce
  });

  it("going back from a quiz question skips the bounce screen and lands on the previous answerable step", async () => {
    render(<SignupFlow uid="uid1" onDone={vi.fn()} />);
    await reachQuiz();
    expect(screen.getByText("confirm-age")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Back"));
    expect(screen.getByText("submit-name")).toBeInTheDocument();
  });

  it("preserves previously entered answers when going back and forward again", async () => {
    render(<SignupFlow uid="uid1" onDone={vi.fn()} />);
    await reachQuiz();

    fireEvent.click(screen.getByText("confirm-age")); // age = 30, now on country
    fireEvent.click(screen.getByLabelText("Back")); // back to quiz-age
    expect(screen.getByText("age-default:30")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Back")); // skips bounce-profile, lands on name
    expect(screen.getByText("initial-name:Mert")).toBeInTheDocument();
  });

  it("resumes at the quiz when a profile already exists", async () => {
    render(<SignupFlow uid="uid1" hasProfile onDone={vi.fn()} />);
    expect(screen.getByText("confirm-age")).toBeInTheDocument();
  });
});
