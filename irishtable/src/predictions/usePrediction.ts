import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/firebase";
import { useDoc } from "@/lib/useDoc";
import { AWARD_IDS } from "@/data/awards";
import type { Prediction, PredictionDraft } from "./predictionTypes";

function toPrediction(data: Record<string, unknown>): Prediction {
  const awards = Object.fromEntries(
    AWARD_IDS.map((id) => [id, typeof data[id] === "string" ? (data[id] as string) : ""])
  ) as Omit<Prediction, "table" | "submittedAt" | "updatedAt">;

  return {
    table: Array.isArray(data.table) ? (data.table as string[]) : [],
    ...awards,
    submittedAt: typeof data.submittedAt === "number" ? data.submittedAt : 0,
    updatedAt: typeof data.updatedAt === "number" ? data.updatedAt : 0,
  };
}

export function usePrediction(uid: string | null) {
  return useDoc<Prediction>(uid ? `predictions/${uid}` : null, toPrediction);
}

/**
 * Write a prediction, creating or overwriting.
 *
 * `submittedAt` is preserved across edits — it records when someone first
 * committed, which is the interesting number; `updatedAt` moves every time.
 */
export async function savePrediction(uid: string, draft: PredictionDraft): Promise<void> {
  const ref = doc(db, "predictions", uid);
  const existing = await getDoc(ref);
  const now = Date.now();

  const awards = Object.fromEntries(AWARD_IDS.map((id) => [id, draft.awards[id] ?? ""]));

  await setDoc(ref, {
    table: draft.table,
    ...awards,
    submittedAt:
      existing.exists() && typeof existing.data().submittedAt === "number"
        ? existing.data().submittedAt
        : now,
    updatedAt: now,
  });
}
