import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Frame — a picture-frame / trophy-case cell (DESIGN-SPEC §0b, "the idea of
 * frames"). A soft, rounded mat with a diffuse navy-tinted shadow around a
 * press-white body, optionally topped by a header band. The composition device
 * that replaces the rejected single page-filling ledger: distinct cells with
 * room around them, each allowed its own internal scroll.
 *
 * Hand-rolled rather than shadcn's Card because Card is a flat bordered box;
 * this needs a two-part mat + banded-header composition with a navy tone
 * variant, built on the same tokens / cn conventions so it stays in-system.
 */
function Frame({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="frame"
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-[var(--radius-4xl)]",
        "border border-border/70 bg-card shadow-frame",
        className
      )}
      {...props}
    />
  );
}

const frameHeaderVariants = cva(
  "flex shrink-0 items-center justify-between gap-3 px-5 sm:px-6",
  {
    variants: {
      tone: {
        /** Press-white band with a hairline foot — the light default. */
        plain: "border-b border-border/70 py-3.5 text-ink",
        /** The navy mat: navy carries real surface area here, per-frame
         *  rather than as one full-bleed field (DESIGN-SPEC §0b, §3). A
         *  touch taller than a plain header — Mert's "slightly more
         *  dominant" note, a nudge not a reversal. Trimmed from py-5 to
         *  py-4 when the leaderboard's real (chrome-subtracted) viewport
         *  turned out far shorter than assumed — every fixed pixel here
         *  is a pixel not available to the team table's 18 flexible rows. */
        navy: "bg-navy py-4 text-navy-ink",
      },
    },
    defaultVariants: { tone: "plain" },
  }
);

function FrameHeader({
  className,
  tone,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof frameHeaderVariants>) {
  return (
    <div
      data-slot="frame-header"
      className={cn(frameHeaderVariants({ tone }), className)}
      {...props}
    />
  );
}

/** Editorial serif title — the Bodoni voice, not a UI label. */
function FrameTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      data-slot="frame-title"
      className={cn(
        "font-display text-lg leading-none font-semibold tracking-[-0.01em] sm:text-xl",
        className
      )}
      {...props}
    />
  );
}

/** Mono meta label — the plaque engraving voice. */
function FrameMeta({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="frame-meta"
      className={cn(
        "font-mono text-[0.62rem] tracking-[0.22em] uppercase",
        className
      )}
      {...props}
    />
  );
}

function FrameBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="frame-body"
      className={cn("flex min-h-0 flex-1 flex-col", className)}
      {...props}
    />
  );
}

export { Frame, FrameHeader, FrameTitle, FrameMeta, FrameBody };
