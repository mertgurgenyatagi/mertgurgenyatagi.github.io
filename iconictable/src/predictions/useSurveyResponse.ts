import { doc, setDoc } from "firebase/firestore";
import { db } from "@/firebase";
import { useDoc } from "@/lib/useDoc";
import type { BallKnowledge, Device, SurveyResponse } from "./surveyTypes";

function toSurvey(data: Record<string, unknown>): SurveyResponse {
  return {
    age: typeof data.age === "number" ? data.age : 0,
    country: typeof data.country === "string" ? data.country : "",
    clubSupported: typeof data.clubSupported === "string" ? data.clubSupported : "",
    ballKnowledge: (typeof data.ballKnowledge === "number"
      ? data.ballKnowledge
      : 1) as BallKnowledge,
    device: (typeof data.device === "string" ? data.device : "other") as Device,
    submittedAt: typeof data.submittedAt === "number" ? data.submittedAt : 0,
  };
}

export function useSurveyResponse(uid: string | null) {
  return useDoc<SurveyResponse>(uid ? `surveyResponses/${uid}` : null, toSurvey);
}

/** Create-only by design — the rules forbid update and delete, so a quiz
 *  answer is a one-time record rather than something to revise later. */
export async function saveSurveyResponse(
  uid: string,
  response: Omit<SurveyResponse, "submittedAt">
): Promise<void> {
  await setDoc(doc(db, "surveyResponses", uid), {
    ...response,
    submittedAt: Date.now(),
  });
}
