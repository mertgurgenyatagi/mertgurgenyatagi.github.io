import { Frame } from "@/components/ui/frame";
import { Skeleton } from "@/components/ui/skeleton";

// Matches HomeLandingLoggedOut's single hero-band shape (heading, subline,
// CTA pill, then the mission line + 4-digit countdown on the right).
export function HomeHeroBandSkeleton() {
  return (
    <div
      className="relative mx-auto grid w-full max-w-[1400px] grid-cols-1 items-center gap-10 px-6 py-10 sm:px-10 lg:grid-cols-[3fr_2fr] lg:gap-16"
      aria-hidden
      data-testid="home-hero-skeleton"
    >
      <div className="flex flex-col gap-6">
        <Skeleton className="h-14 w-full max-w-3xl rounded-lg" />
        <Skeleton className="h-5 w-full max-w-xl rounded-md" />
        <Skeleton className="h-12 w-40 rounded-full" />
      </div>
      <div className="flex flex-col gap-7 lg:border-l lg:border-color_border1/30 lg:pl-12">
        <Skeleton className="h-14 w-full rounded-lg" />
        <div className="flex items-start gap-5 sm:gap-7">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-12 rounded-md" />
          ))}
        </div>
      </div>
    </div>
  );
}

const HOME_BENTO_SHELL =
  "relative mx-auto flex w-full max-w-[1400px] min-w-0 flex-col gap-4 p-4 sm:p-6 lg:h-full lg:min-h-0 lg:flex-1 lg:gap-5 lg:p-6";

// Matches the bento shape shared by LoggedInHome/LoggedInHomeStarted/
// HomeLandingLoggedOutStarted — a welcome-banner-height bar above a row of
// Frame-shaped cells. Not pixel-matched per state (they use different exact
// column counts/widths) — this is a skeleton, not a preview. Shared (not
// owned by HomePage.tsx) so HomeLandingLoggedOutStarted can reuse it for its
// own posts+images gate without an import cycle back into HomePage.tsx.
export function HomeBentoSkeleton() {
  return (
    <div className={HOME_BENTO_SHELL} aria-hidden data-testid="home-bento-skeleton">
      <Skeleton className="h-20 w-full shrink-0 rounded-[var(--radius-4xl)]" />
      <div className="grid min-w-0 flex-1 gap-4 lg:grid-cols-4 lg:gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <Frame key={i} className="h-[26rem] lg:h-full" />
        ))}
      </div>
    </div>
  );
}
