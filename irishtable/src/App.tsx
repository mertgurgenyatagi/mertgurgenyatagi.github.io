import { Suspense, lazy } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/auth/AuthProvider";
import { ProfileGate } from "@/profile/ProfileGate";
import { AppShell } from "@/shell/AppShell";
import { ErrorBoundary } from "@/shell/ErrorBoundary";
import { Skeleton } from "@/components/ui/skeleton";
import { HomePage } from "@/pages/HomePage";

/**
 * Home ships in the main bundle — it's the page every link lands on, and a
 * loading flash there is the first impression. Everything else is split out,
 * which keeps the drag-and-drop and animation libraries off the critical path
 * for a visitor who only ever reads the landing page.
 */
const AboutPage = lazy(() =>
  import("@/pages/AboutPage").then((m) => ({ default: m.AboutPage }))
);
const ScoringPage = lazy(() =>
  import("@/pages/ScoringPage").then((m) => ({ default: m.ScoringPage }))
);
const ForumPage = lazy(() =>
  import("@/pages/ForumPage").then((m) => ({ default: m.ForumPage }))
);
const PredictionsPage = lazy(() =>
  import("@/pages/PredictionsPage").then((m) => ({ default: m.PredictionsPage }))
);
const ProfilePage = lazy(() =>
  import("@/pages/ProfilePage").then((m) => ({ default: m.ProfilePage }))
);

function RouteFallback() {
  return <Skeleton className="h-[60vh] w-full rounded-[14px]" />;
}

export function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ProfileGate>
          {/* Opted into v7 behaviour now rather than shipping two future-flag
              warnings into everyone's console. */}
          <HashRouter
            future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
          >
            <AppShell>
              <Suspense fallback={<RouteFallback />}>
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/about" element={<AboutPage />} />
                  <Route path="/scoring" element={<ScoringPage />} />
                  <Route path="/forum" element={<ForumPage />} />
                  <Route path="/predictions" element={<PredictionsPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </AppShell>
          </HashRouter>
          <Toaster
            position="bottom-center"
            toastOptions={{
              style: {
                background: "var(--color_secondary)",
                border: "1px solid var(--color_border1)",
                color: "var(--color_text)",
              },
            }}
          />
        </ProfileGate>
      </AuthProvider>
    </ErrorBoundary>
  );
}
