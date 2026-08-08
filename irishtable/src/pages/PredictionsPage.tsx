import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { usePrediction } from "../predictions/usePrediction";
import { useSurveyResponse } from "../predictions/useSurveyResponse";
import { PredictionSequence } from "../predictions/PredictionSequence";
import { TEAMS, teamCrestSrc } from "../predictions/teams";
import { useImagePreload } from "@/lib/useImagePreload";
import { predictionsAreOpen } from "@/data/deadlines";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/lib/useIsMobile";
import { cn } from "@/lib/utils";

// Every crest this flow can ever show — the ScoringExampleDiagram's window,
// the club pool, and the two cup pickers — preloaded up front so nothing pops
// in mid-sequence even though the ranker isn't reached until a few beats in.
const TEAM_CREST_URLS = TEAMS.map((t) => teamCrestSrc(t.id));

// This page is a full-viewport animated sequence, not a data grid, and
// usePrediction's loading is a single fast read that usually ends in an
// immediate redirect — a couple of centred bars, not a pixel-matched mockup
// of a UI that's about to be replaced or redirected away from.
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
 * /predictions is a one-time door, not a page you keep coming back to: first
 * submission only. Revising an existing prediction lives on ProfilePage's own
 * widget — the same `PredictionSequence` in "edit" mode — so reaching this
 * page with a prediction already saved, or after the deadline regardless of
 * submission status, just sends you home.
 *
 * Shaped like SignupFlow.tsx on purpose: a full-viewport animated sequence
 * rather than a Frame/bento page, reusing that flow's own AutoAdvance/
 * BounceCheck/transition pieces instead of inventing new ones.
 *
 * This component is now only the route's guard and frame; every stage lives
 * in PredictionSequence, so the page and the profile dialog cannot drift.
 */
export function PredictionsPage() {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: prediction, loading } = usePrediction(user?.uid ?? null);
  const { data: survey } = useSurveyResponse(user?.uid ?? null);

  const imagesReady = useImagePreload(TEAM_CREST_URLS);

  if (loading || !imagesReady) return <PredictionsLoadingSkeleton />;

  if (!user || prediction || !predictionsAreOpen()) {
    return <Navigate to="/" replace />;
  }

  return (
    <div
      className={cn(
        // `pt-14` reserves a band for the progress bar and the back chevron,
        // which are absolutely positioned. The parent gets away without one
        // because its stages are three short sentences with slack to spare;
        // the 20-slot ranker fills its box, and its instruction line lands
        // directly under the bar.
        "relative flex w-full cursor-default items-center justify-center overflow-hidden bg-background px-6 pt-14 pb-10",
        // h-dvh is a full viewport, but this page renders *below* the shell
        // header. On mobile the shell is itself a fixed viewport now, so this
        // just fills what it's given; on desktop it keeps its own h-dvh.
        isMobile ? "h-full pb-6" : "h-dvh"
      )}
    >
      <PredictionSequence
        uid={user.uid}
        favouriteClubId={survey?.clubSupported}
        onDone={() => navigate("/")}
      />
    </div>
  );
}
