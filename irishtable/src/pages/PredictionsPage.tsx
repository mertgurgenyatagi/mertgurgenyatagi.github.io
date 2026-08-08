import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { usePrediction } from "../predictions/usePrediction";
import { useSurveyResponse } from "../predictions/useSurveyResponse";
import { PredictionSequence } from "../predictions/PredictionSequence";
import { awardsFrom } from "../predictions/predictionTypes";
import { TEAMS, teamCrestSrc } from "../predictions/teams";
import { useImagePreload } from "@/lib/useImagePreload";
import { predictionsAreOpen } from "@/data/deadlines";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/lib/useIsMobile";
import { cn } from "@/lib/utils";

const TEAM_CREST_URLS = TEAMS.map((t) => teamCrestSrc(t.id));

function PredictionsLoadingSkeleton() {
  return (
    <div
      className="flex h-full min-h-0 flex-1 flex-col items-center justify-center gap-4 p-8"
      aria-hidden
      data-testid="predictions-skeleton"
    >
      <Skeleton className="h-8 w-64 rounded-md" />
      <Skeleton className="h-4 w-80 rounded-sm" />
    </div>
  );
}

/**
 * /predictions is the standalone prediction flow.
 * Works for both initial submissions and editing an existing prediction with choices pre-filled.
 */
export function PredictionsPage() {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: prediction, loading } = usePrediction(user?.uid ?? null);
  const { data: survey } = useSurveyResponse(user?.uid ?? null);

  const imagesReady = useImagePreload(TEAM_CREST_URLS);

  if (loading || !imagesReady) return <PredictionsLoadingSkeleton />;

  if (!user || !predictionsAreOpen()) {
    return <Navigate to="/" replace />;
  }

  const initialTable = prediction?.table;
  const initialAwards = prediction ? awardsFrom(prediction) : undefined;

  return (
    <div
      className={cn(
        "relative flex w-full cursor-default items-center justify-center overflow-hidden bg-transparent px-6 pt-14 pb-10",
        isMobile ? "h-full pb-6" : "h-dvh"
      )}
    >
      <PredictionSequence
        uid={user.uid}
        mode={prediction ? "edit" : "create"}
        initialTable={initialTable}
        initialAwards={initialAwards}
        favouriteClubId={survey?.clubSupported}
        onDone={() => navigate("/")}
      />
    </div>
  );
}
