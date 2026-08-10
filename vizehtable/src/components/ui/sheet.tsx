import { cva, type VariantProps } from "class-variance-authority";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Sheet — an edge-anchored dialog, the mobile counterpart to `dialog.tsx`'s
 * centred popup. Three sides serve three jobs:
 *
 *   left   — the nav drawer
 *   right  — the chat drawer
 *   bottom — every popup (Team/Participant/Matchup/Thread), which the
 *            wireframe tool itself models as a sheet with a drag handle
 *
 * Built directly on `@base-ui/react`'s Dialog primitives rather than through
 * `DialogContent`, for two reasons. One, `DialogContent`'s base class ends in
 * `sm:max-w-sm`, and a `sm:`-prefixed utility is emitted after unprefixed
 * ones — so any width passed in is silently overridden above 640px (the exact
 * trap documented in HANDOVER.md's 2026-08-06 entry). Two, a sheet's
 * positioning is the opposite of a centred popup's, so there is nothing to
 * inherit anyway. What it *does* reuse is the part worth reusing: Base UI's
 * focus trap, escape handling, scroll lock and backdrop click-away.
 *
 * Cursorify: sheets portal outside AppShell's DOM subtree, so its root
 * `cursor-default` doesn't cascade in — re-set at this boundary, same as
 * `DialogContent` does.
 */

const sheetVariants = cva(
  "fixed z-50 flex cursor-default flex-col bg-color_secondary text-color_text outline-none duration-250 ease-[var(--ease-cotton)] data-open:animate-in data-closed:animate-out",
  {
    variants: {
      side: {
        left: [
          "inset-y-0 left-0 h-dvh w-[min(20rem,85vw)] border-r border-color_border1/60",
          "data-open:slide-in-from-left data-closed:slide-out-to-left",
        ],
        right: [
          "inset-y-0 right-0 h-dvh w-[min(22rem,90vw)] border-l border-color_border1/60",
          "data-open:slide-in-from-right data-closed:slide-out-to-right",
        ],
        bottom: [
          // Not quite full height: the sliver of backdrop left at the top is
          // the affordance that says "this is a layer, tap above to leave."
          "inset-x-0 bottom-0 max-h-[92dvh] rounded-t-[var(--radius-4xl)] border-t border-color_border1/60",
          "data-open:slide-in-from-bottom data-closed:slide-out-to-bottom",
        ],
      },
    },
    defaultVariants: { side: "bottom" },
  }
);

interface SheetContentProps
  extends DialogPrimitive.Popup.Props,
    VariantProps<typeof sheetVariants> {
  /** Bottom sheets get a grab handle; the side drawers don't. */
  showHandle?: boolean;
  showCloseButton?: boolean;
}

function Sheet({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetContent({
  className,
  children,
  side = "bottom",
  showHandle,
  showCloseButton = false,
  ...props
}: SheetContentProps) {
  const handle = showHandle ?? side === "bottom";
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop
        data-slot="sheet-overlay"
        className="fixed inset-0 isolate z-50 bg-black/45 duration-250 ease-[var(--ease-cotton)] supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
      />
      <DialogPrimitive.Popup
        data-slot="sheet-content"
        className={cn(sheetVariants({ side }), className)}
        {...props}
      >
        {handle && (
          <div className="flex shrink-0 justify-center pt-2.5 pb-1" aria-hidden>
            <span className="h-1 w-9 rounded-full bg-color_border2" />
          </div>
        )}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="sheet-close"
            className="absolute top-3 right-3 z-10 inline-flex size-8 cursor-pointer items-center justify-center rounded-full text-color_textsecondary transition-colors duration-150 hover:bg-color_hoverfill hover:text-color_text outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-color_text"
          >
            <XIcon className="size-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
        {children}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  );
}

/** Sticky title row for a sheet. Sits above the sheet's own scroll region. */
function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn(
        "flex shrink-0 items-center gap-3 border-b border-color_border1/60 px-5 py-3.5",
        className
      )}
      {...props}
    />
  );
}

function SheetTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="sheet-title"
      className={cn(
        "font-mono text-[0.68rem] font-medium tracking-[0.2em] text-color_textsecondary uppercase",
        className
      )}
      {...props}
    />
  );
}

/** The scrolling region of a sheet — everything between header and edge. */
function SheetBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-body"
      className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain", className)}
      {...props}
    />
  );
}

const SheetClose = DialogPrimitive.Close;
const SheetDescription = DialogPrimitive.Description;

export {
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
};
