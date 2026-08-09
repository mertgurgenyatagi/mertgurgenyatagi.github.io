import { ReactNode } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useIsMobile } from "@/lib/useIsMobile";

/**
 * A dialog that becomes a bottom sheet on a phone.
 *
 * All four of this app's popups (Team, Participant, Matchup, Thread) are
 * centred dialogs sized in `sm:max-w-*` steps. At 390px that degrades into a
 * near-full-width card floating in the middle of the screen with backdrop
 * above and below it — which is neither a dialog nor a sheet, and puts its
 * close button at the top of the screen where a thumb can't reach.
 *
 * The wireframe tool models popups as sheets with a drag handle, so that is
 * what they become: anchored to the bottom edge, rising to 92dvh, with the
 * handle as the affordance and the remaining sliver of backdrop as the way
 * out.
 *
 * `desktopClassName` is passed through to DialogContent unchanged, so every
 * existing desktop width/height override keeps working exactly as it did.
 */
export function ResponsiveDialog({
  open,
  onOpenChange,
  desktopClassName,
  mobileClassName,
  showCloseButton = true,
  children,
  ...rest
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  desktopClassName?: string;
  mobileClassName?: string;
  showCloseButton?: boolean;
  children: ReactNode;
  "aria-label"?: string;
}) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          showCloseButton={showCloseButton}
          className={mobileClassName ?? "p-0"}
          {...rest}
        >
          {children}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={desktopClassName} showCloseButton={showCloseButton} {...rest}>
        {children}
      </DialogContent>
    </Dialog>
  );
}
