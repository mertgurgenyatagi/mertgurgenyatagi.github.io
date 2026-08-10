import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { useProfile } from "./useProfile";
import { useSurveyResponse } from "@/predictions/useSurveyResponse";
import { SignupFlow } from "@/signup/SignupFlow";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Blocks the whole app until a signed-in visitor has both a profile and a
 * completed quiz, rendering onboarding instead if either is missing.
 *
 * Deliberately not resumable: closing the tab mid-quiz restarts from the top
 * next time. A half-finished profile is simply overwritten on the next
 * attempt rather than being tracked and resumed, which keeps the whole flow
 * a single forward path with no partial states to reason about.
 */
export function ProfileGate({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { data: profile, loading: profileLoading } = useProfile(user?.uid ?? null);
  const { data: survey, loading: surveyLoading } = useSurveyResponse(user?.uid ?? null);

  // The flow's closing checkmark holds the screen for two seconds after the
  // final write. Without this latch the profile listener lands first and
  // yanks the overlay away mid-animation; with it, `onDone` is what ends the
  // flow. Reset per uid so a sign-out/sign-in never inherits it.
  const [completed, setCompleted] = useState(false);
  useEffect(() => {
    setCompleted(false);
  }, [user?.uid]);

  if (authLoading) return <BootSkeleton />;

  // Logged out is a perfectly valid state — the landing page, About and
  // Scoring are all open. Onboarding only ever gates a signed-in visitor.
  if (!user) return <>{children}</>;

  if (profileLoading || surveyLoading) return <BootSkeleton />;

  if ((!profile || !survey) && !completed) {
    return (
      <SignupFlow
        uid={user.uid}
        hasProfile={Boolean(profile)}
        onDone={() => setCompleted(true)}
      />
    );
  }

  return <>{children}</>;
}

function BootSkeleton() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1100px] flex-col gap-6 px-4 py-10 sm:px-6">
      <Skeleton className="h-14 w-full rounded-[14px]" />
      <Skeleton className="h-64 w-full rounded-[14px]" />
      <Skeleton className="h-40 w-full rounded-[14px]" />
    </div>
  );
}
