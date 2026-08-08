import { useMemo } from "react";
import { useAuth } from "../auth/AuthProvider";
import { usePlayers } from "../profile/usePlayers";
import { HomeLandingLoggedOut } from "../home/HomeLandingLoggedOut";
import { LoggedInHome } from "../home/LoggedInHome";
import { HERO_IMAGES } from "../leaderboard/HeroCarousel";
import { useImagePreload } from "@/lib/useImagePreload";
import { HomeHeroBandSkeleton, HomeBentoSkeleton } from "../home/HomeSkeletons";
import { useIsMobile } from "@/lib/useIsMobile";
import { MobileHomeLoggedOut } from "../home/mobile/MobileHomeLoggedOut";

/**
 * Every image already known at this level (i.e. not still behind a deeper
 * data-fetching wrapper's own hook, like LoggedInHome's posts) — folded into
 * this page's own top-level loading gate so the whole bento reveals together
 * instead of the avatar/crest images popping in after.
 *
 * The parent branches five ways here on its VisibilityState; irishtable has
 * exactly two states, because the tournament never starts inside this app.
 */
function homeImageUrls(signedIn: boolean, players: { photoURL: string }[]): string[] {
  if (!signedIn) {
    // AvatarStack only ever renders the first 3 — no point preloading the
    // rest of the photos nobody will see.
    return players
      .slice(0, 3)
      .map((p) => p.photoURL)
      .filter(Boolean);
  }
  const avatarUrls = players.map((p) => p.photoURL).filter(Boolean);
  return [...avatarUrls, ...HERO_IMAGES];
}

export function HomePage() {
  const { user, loading: authLoading } = useAuth();
  const isMobile = useIsMobile();
  const { players, loading: playersLoading } = usePlayers();

  const signedIn = Boolean(user);
  const imageUrls = useMemo(() => homeImageUrls(signedIn, players), [signedIn, players]);
  const imagesReady = useImagePreload(imageUrls);

  if (authLoading || playersLoading || !imagesReady) {
    return signedIn ? <HomeBentoSkeleton /> : <HomeHeroBandSkeleton />;
  }

  // Mobile runs its own composition per state — a separate tree, not a reflow
  // of the desktop one. The logged-in branch forks one level deeper instead,
  // inside LoggedInHome, so the (substantial) fetching logic isn't duplicated.
  if (!signedIn) {
    return isMobile ? (
      <MobileHomeLoggedOut players={players} />
    ) : (
      <HomeLandingLoggedOut players={players} />
    );
  }

  return <LoggedInHome players={players} />;
}
