import { Frame } from "@/components/ui/frame";
import { HeroCarousel } from "../leaderboard/HeroCarousel";
import { cn } from "@/lib/utils";

/**
 * The same crossfading portrait carousel as leaderboard/LeaderboardHero.tsx
 * and stats/StatsHero.tsx, minus whatever each of those docks to it —
 * chat-widget-round-01 Q1 confirmed it also belongs on logged-in Home,
 * between Forum and Sohbet, sized like its cell-row siblings (PAGEMAP_SPEC
 * §3 had already called this "still belongs there," just not yet built for
 * Home specifically). Takes the row's own CELL className/style (sizing,
 * stagger delay) rather than hardcoding its own, same as the other three
 * cells in HomeLandingLoggedIn.tsx.
 */
export function HomeHero({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <Frame className={cn("relative animate-cotton-rise border-color_border1/35", className)} {...props}>
      <HeroCarousel />
    </Frame>
  );
}
