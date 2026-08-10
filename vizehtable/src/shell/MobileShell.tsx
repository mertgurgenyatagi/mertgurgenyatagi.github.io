import { type ReactNode, useEffect, useState } from "react";
import { Menu, MessageSquare } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { useAuth } from "../auth/AuthProvider";
import { useProfile } from "../profile/useProfile";
import { LoginButton } from "../auth/LoginButton";
import { LogoutButton } from "../auth/LogoutButton";
import { navLinksFor, type NavLink } from "./navLinks";
import { MobilePopupHost } from "./MobilePopupHost";
import { MobileChatDrawer } from "./MobileChatDrawer";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn, assetUrl } from "@/lib/utils";

/**
 * The mobile app shell — three slots in one bar.
 *
 *   left    nav drawer opener
 *   centre  the wordmark, or your own face once you're signed in
 *   right   sign-in, or the chat drawer opener once you're signed in
 *
 * The centre swap is cloned from kupatakipucl and is the one choice here most
 * likely to read as a mistake: **a signed-in user never sees the wordmark.**
 * It is deliberate. The brand is what you need before you have an account;
 * your own face is what you need after, and it buys back the header row a
 * separate account slot would have cost.
 *
 * Dropped from the desktop header, per the non-busyness rule: the Share button
 * (the OS share sheet is a long-press away) and the inline nav strip, which
 * below 1024px was a horizontally-scrolling row of links nobody could see the
 * end of — the thing this shell exists to replace.
 */
export function MobileShell({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const { data: profile } = useProfile(user?.uid ?? null);

  const [navOpen, setNavOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  // A drawer that survives a route change is a drawer covering a page you
  // just asked for.
  useEffect(() => {
    setNavOpen(false);
    setChatOpen(false);
  }, [location.pathname]);

  const signedIn = !loading && Boolean(user);

  return (
    <MobilePopupHost>
      {/* A fixed viewport, not a scrolling document — the same model the
          desktop shell uses. This is what gives every page below a *definite*
          height to divide, which `min-h-dvh` could not do. Any region that
          genuinely needs to overflow gets its own internal scroll container;
          the Forum feed is the only one that does. */}
      {/* No `bg-background` — see AppShell: it would hide the body's ruled grid. */}
      <div className="relative flex h-full cursor-default flex-col overflow-hidden">
        <div className="ground-glow" aria-hidden />

        <header className="sticky top-0 z-40 shrink-0 border-b border-color_border1/50 bg-color_band pt-[env(safe-area-inset-top)]">
          <div className="flex items-center gap-2 px-3 py-2">
            <button
              type="button"
              onClick={() => setNavOpen(true)}
              aria-label="Open menu"
              aria-expanded={navOpen}
              className="inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-color_border1 text-color_text transition-colors duration-150 ease-[var(--ease-cotton)] outline-none active:bg-color_hoverfill focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-color_text"
            >
              <Menu className="size-[1.15rem]" />
            </button>

            {/* Centre slot — the wordmark, or the signed-in viewer's own
                profile opener. */}
            <div className="flex min-w-0 flex-1 justify-center">
              {signedIn && profile ? (
                <Link
                  to="/profile"
                  className="flex min-w-0 items-center gap-2 rounded-full px-2 py-1 no-underline outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-color_text"
                >
                  <Avatar size="sm">
                    <AvatarImage src={profile.photoURL ?? undefined} alt="" />
                    <AvatarFallback className="font-mono text-[0.65rem] text-color_text">
                      {(profile.displayName ?? "?").charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate font-display text-sm font-medium text-color_text">
                    {profile.displayName}
                  </span>
                </Link>
              ) : (
                <Link
                  to="/"
                  className="flex items-center gap-2 rounded-sm leading-none no-underline outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-color_text"
                >
                  <img
                    src={assetUrl("/brand/vizehtable-logo.svg")}
                    alt=""
                    aria-hidden
                    className="size-5 shrink-0"
                  />
                  <span className="type-display text-lg tracking-[0.01em] text-color_text uppercase">
                    #VIZEHTABLE
                  </span>
                </Link>
              )}
            </div>

            {/* Right slot — chat once signed in, sign-in before that. */}
            {signedIn ? (
              <button
                type="button"
                onClick={() => setChatOpen(true)}
                aria-label="Open chat"
                aria-expanded={chatOpen}
                className="inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-color_border1 text-color_text transition-colors duration-150 ease-[var(--ease-cotton)] outline-none active:bg-color_hoverfill focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-color_text"
              >
                <MessageSquare className="size-[1.05rem]" />
              </button>
            ) : (
              <div className="shrink-0 [&_[role=alert]]:sr-only">
                {!loading && <LoginButton size="sm" variant="outline" label="Sign in" />}
              </div>
            )}
          </div>
        </header>

        <Toaster closeButton position="top-center" />

        <main className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {/* Capped and centred rather than stretched: everything below
              1024px renders the phone composition, and a 1000px-wide phone
              layout is worse than a centred column with air either side. */}
          <div
            key={location.pathname}
            className="mx-auto flex min-h-0 w-full min-w-0 max-w-[34rem] flex-1 flex-col overflow-hidden animate-cotton-fade"
          >
            {children}
          </div>
        </main>

        <MobileNavDrawer
          open={navOpen}
          onOpenChange={setNavOpen}
          links={navLinksFor(signedIn)}
          currentPath={location.pathname}
          signedIn={signedIn}
        />

        {signedIn && user && (
          <MobileChatDrawer open={chatOpen} onOpenChange={setChatOpen} uid={user.uid} />
        )}
      </div>
    </MobilePopupHost>
  );
}

function MobileNavDrawer({
  open,
  onOpenChange,
  links,
  currentPath,
  signedIn,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  links: NavLink[];
  currentPath: string;
  signedIn: boolean;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="p-0">
        <SheetHeader>
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>

        <nav aria-label="Main" className="min-h-0 flex-1 overflow-y-auto py-2">
          {links.map((link) => {
            const active =
              link.path === "/" ? currentPath === "/" : currentPath.startsWith(link.path);
            return (
              <Link
                key={link.path}
                to={link.path}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex items-center px-5 py-3.5 font-mono text-[0.75rem] tracking-[0.14em] uppercase no-underline transition-colors duration-150 ease-[var(--ease-cotton)] outline-none focus-visible:bg-color_hoverfill",
                  active ? "text-color_text" : "text-color_textsecondary"
                )}
              >
                {/* The accent rule sits on the leading edge here rather than
                    underlining the label, since a drawer row is read
                    left-to-right against a hard edge, not centred like the
                    desktop strip. */}
                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-color_accent transition-opacity duration-300 ease-[var(--ease-cotton)]",
                    active ? "opacity-100" : "opacity-0"
                  )}
                />
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="shrink-0 border-t border-color_border1/60 px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {signedIn && <LogoutButton />}
        </div>
      </SheetContent>
    </Sheet>
  );
}
