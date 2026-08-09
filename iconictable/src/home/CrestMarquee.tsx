import { CLUBS } from "@/data/clubs";
import { assetUrl } from "@/lib/utils";

/**
 * Continuous seamless conveyor belt of the 20 Premier League club crests.
 * Scrolls horizontally in a quiet, smooth loop.
 */
export function CrestMarquee({ className }: { className?: string }) {
  // Duplicate clubs list to achieve infinite seamless loop
  const marqueeItems = [...CLUBS, ...CLUBS];

  return (
    <div
      className={`relative flex w-full overflow-hidden py-2 select-none ${className ?? ""}`}
      style={{
        maskImage:
          "linear-gradient(to right, transparent, black 10%, black 90%, transparent)",
        WebkitMaskImage:
          "linear-gradient(to right, transparent, black 10%, black 90%, transparent)",
      }}
      aria-label="Premier League Clubs"
    >
      <div className="flex shrink-0 animate-marquee items-center gap-6 sm:gap-8">
        {marqueeItems.map((club, index) => (
          <div
            key={`${club.id}-${index}`}
            className="flex shrink-0 items-center justify-center"
            title={club.name}
          >
            <img
              src={assetUrl(club.crest)}
              alt={club.name}
              loading="lazy"
              className="size-8 opacity-85 transition-all duration-200 [filter:drop-shadow(0_0_1.5px_rgba(255,255,255,0.5))] hover:scale-110 hover:opacity-100 sm:size-9 object-contain"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
