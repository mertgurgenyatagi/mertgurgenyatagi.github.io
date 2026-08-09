/**
 * The five-question quiz everyone answers once, before predicting.
 * Copy is Mert's, verbatim — don't paraphrase it.
 */

export type BallKnowledge = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type Device = "desktop" | "mobile" | "fifty-fifty" | "other";

export type SurveyResponse = {
  age: number;
  /** ISO 3166-1 alpha-2. */
  country: string;
  /** A club id, or "other" / "none". */
  clubSupported: string;
  ballKnowledge: BallKnowledge;
  device: Device;
  submittedAt: number;
};

export const AGE_MIN = 10;
export const AGE_MAX = 90;

export const BALL_KNOWLEDGE_OPTIONS: readonly { value: BallKnowledge; label: string }[] = [
  { value: 1, label: "Don't really follow the Prem, to be honest. Like, at all." },
  { value: 2, label: "I only tune in for major Premier League derbies." },
  { value: 3, label: "I exclusively follow my own team's matches." },
  {
    value: 4,
    label: "I watch matches most weekends and understand the general league landscape.",
  },
  {
    value: 5,
    label: "I am an avid fan who closely tracks league-wide developments across all clubs.",
  },
  { value: 6, label: "I follow the Premier League religiously." },
  { value: 7, label: "Tactical mastermind. Mid-blocks, inverted fullbacks, Genk wonderkids." },
];

export const DEVICE_OPTIONS: readonly { value: Device; label: string }[] = [
  { value: "desktop", label: "Desktop" },
  { value: "mobile", label: "Mobile" },
  { value: "fifty-fifty", label: "Fifty-fifty" },
  { value: "other", label: "Other" },
];

/** Non-club answers to "What team do you support?" */
export const SUPPORT_OTHER = "other";
export const SUPPORT_NONE = "none";

export function ballKnowledgeLabel(value: BallKnowledge): string {
  return BALL_KNOWLEDGE_OPTIONS.find((o) => o.value === value)?.label ?? String(value);
}

export function deviceLabel(value: Device): string {
  return DEVICE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}
