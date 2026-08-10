// src/forum/ForumImageThumb.tsx
import { useEffect, useState, type MouseEvent } from "react";
import { X, ImageOff } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface ForumImageThumbProps {
  src: string;
  className?: string;
}

type ImageStatus = "loading" | "loaded" | "error";

// Same mount-when-ready idiom as AvatarImage/HeroCarousel — probe via a
// detached Image() first, only render the real <img> once it has actually
// decoded. An earlier version of this component mounted the <img>
// immediately at opacity:0 and faded it in on load, but that just traded
// one empty-looking box for another (worse for a real Storage-hosted photo,
// which takes real network time, unlike this app's local dev assets):
// nothing distinguishable painted where the image should be for the whole
// fetch *plus* the fade's own 300ms, every single time (2026-08-03).
function useImageStatus(src: string): ImageStatus {
  const [status, setStatus] = useState<ImageStatus>("loading");

  useEffect(() => {
    setStatus("loading");
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled) setStatus("loaded");
    };
    img.onerror = () => {
      if (!cancelled) setStatus("error");
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);

  return status;
}

/**
 * 4chan-style image treatment: a small bounded thumbnail (never full width),
 * expanding to the full image only on click, in a lightbox overlay. Every
 * forum image call site uses this instead of its own inline <img> so the
 * "bounded until clicked" behavior stays in one place.
 *
 * Thumbnail and lightbox share one status probe — same src, so once the
 * thumbnail has decoded the browser already has the full image cached, and
 * the lightbox's own <img> paints instantly instead of needing its own
 * separate load.
 */
export function ForumImageThumb({ src, className }: ForumImageThumbProps) {
  const [expanded, setExpanded] = useState(false);
  const status = useImageStatus(src);

  function openLightbox(e: MouseEvent) {
    // Image click must never bubble into a post-row's own "open the thread
    // popup" click handler (RecentPostsPreview) — the thumbnail is its own
    // target, not a door into the popup.
    e.stopPropagation();
    setExpanded(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={openLightbox}
        aria-label="Enlarge image"
        className={className ?? "block size-16 shrink-0 cursor-pointer overflow-hidden rounded-md border border-color_border1/50"}
      >
        {status === "loading" && (
          <Skeleton className="size-full rounded-none" data-testid="forum-image-skeleton" />
        )}
        {status === "error" && (
          <div className="flex size-full items-center justify-center bg-muted" data-testid="forum-image-fallback">
            <ImageOff className="size-4 text-color_textsecondary/50" aria-hidden />
          </div>
        )}
        {status === "loaded" && <img src={src} alt="" className="size-full object-cover" />}
      </button>

      {expanded && (
        <div
          role="button"
          tabIndex={-1}
          aria-label="Close"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(false);
          }}
          className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-color_idk/80 p-6"
        >
          {status === "error" ? (
            <p className="text-sm text-white">Image failed to load.</p>
          ) : status === "loading" ? (
            <Skeleton className="h-64 w-64 rounded-lg" />
          ) : (
            <img
              src={src}
              alt=""
              onClick={(e) => e.stopPropagation()}
              className="max-h-full max-w-full cursor-default rounded-lg object-contain"
            />
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(false);
            }}
            aria-label="Close"
            className="absolute top-4 right-4 cursor-pointer rounded-full bg-color_idk/50 p-2 text-white outline-none transition-colors hover:bg-color_idk/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-color_accent"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
      )}
    </>
  );
}
