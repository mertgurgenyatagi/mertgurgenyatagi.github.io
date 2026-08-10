import { Share2 } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { useAuth } from "../auth/AuthProvider";
import { useProfile } from "../profile/useProfile";
import { LoginButton } from "../auth/LoginButton";
import { LogoutButton } from "../auth/LogoutButton";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn, assetUrl } from "@/lib/utils";
import { useIsMobile } from "@/lib/useIsMobile";
import { MobileShell } from "./MobileShell";
import { navLinksFor } from "./navLinks";
import { SITE_NAME } from "@/data/site";

/**
 * The shell fork. Below 1024px the whole app runs a different shell and, from
 * there down, different page compositions. Cloned from kupatakipucl, including
 * the reason it is a fork rather than a set of breakpoint classes: desktop Home
 * is a multi-widget bento and mobile Home is stacked frames — genuinely
 * different children, not a `grid-cols-3 → 1` reflow. Expressing that in
 * breakpoint classes means shipping every desktop widget to every phone in
 * order to hide it.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();
  return isMobile ? <MobileShell>{children}</MobileShell> : <DesktopShell>{children}</DesktopShell>;
}

function DesktopShell({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const links = navLinksFor(Boolean(user));
  const { data: profile } = useProfile(user?.uid ?? null);

  // Deliberately no `bg-background` on the root below. The parent puts one
  // there because its own backdrop lives on a .ground-radiance layer *inside*
  // the shell; irishtable's ruled grid is painted on `body`, so an opaque
  // shell root hides the one thing Mert asked to keep.
  return (
    <div className="relative flex h-dvh min-h-0 cursor-default flex-col overflow-hidden">
      {/* The ambient wash. irishtable's own, kept — the parent's
          .ground-radiance and its five drifting DustHaze blobs are both
          deliberately not carried over, because the ruled grid is already the
          background and stacking a radiance on a ruled field is two competing
          textures. */}
      <div className="ground-glow" aria-hidden />

      {/* --- Top bar: identity, nav, account (all pages) ------------------
          The band colour, matching every frame's title band. Fixed to the top;
          the content region below fills the rest of the fixed viewport. */}
      <header className="relative z-20 shrink-0 border-b border-color_border1/50 bg-color_band px-5 py-2.5 sm:px-7 lg:px-9">
        <div className="relative mx-auto flex w-full max-w-[1600px] flex-wrap items-center justify-between gap-y-3">
          {/* Nameplate — no static count in the copy, so nothing here can
              drift from the live figures shown in-page. */}
          <div className="order-1 flex items-center gap-3">
            <Link
              to="/"
              className="group flex cursor-pointer items-center gap-2.5 rounded-sm leading-none no-underline outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-color_text"
            >
              <img
                src={assetUrl("/brand/vizehtable-logo.svg")}
                alt=""
                aria-hidden
                className="size-6 shrink-0 sm:size-7"
              />
              <span className="type-display text-xl tracking-[0.02em] text-color_text sm:text-2xl uppercase">
                #VIZEHTABLE
              </span>
            </Link>

            <button
              type="button"
              onClick={() => void handleShare()}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-color_secondary px-2.5 py-1 font-mono text-[0.72rem] font-medium tracking-[0.06em] text-color_text uppercase transition-colors duration-150 outline-none hover:bg-color_hoverfill focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-color_accent"
            >
              <Share2 className="size-3 shrink-0" />
              Share
            </button>
          </div>

          {/* Navigation — pinned, strictly horizontally centered on desktop. */}
          <nav
            aria-label="Main"
            className="no-scrollbar order-3 -mx-1 flex w-full items-center gap-x-1 overflow-x-auto px-1 lg:order-2 lg:mx-0 lg:w-auto lg:absolute lg:left-1/2 lg:-translate-x-1/2 lg:overflow-visible lg:px-0"
          >
            {links.map((link) => {
              const active =
                link.path === "/"
                  ? location.pathname === "/"
                  : location.pathname.startsWith(link.path);
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "type-label cursor-pointer rounded-full px-3.5 py-1.5 whitespace-nowrap transition-colors no-underline outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-color_accent",
                    active
                      ? "bg-accent/15 text-accent font-semibold"
                      : "text-textsecondary hover:bg-hoverfill hover:text-text"
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Account slot */}
          <div className="order-2 flex items-center gap-3 sm:gap-4 lg:order-3">
            {!loading && user && profile && (
              <Link
                to="/profile"
                className="flex cursor-pointer items-center gap-2.5 rounded-full border border-color_border1/80 bg-color_secondary/60 px-3.5 py-1.5 no-underline transition-all duration-150 ease-[var(--ease-cotton)] hover:border-color_accent hover:bg-hoverfill hover:shadow-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-color_accent"
              >
                <Avatar size="sm" className="size-7 shrink-0 ring-1 ring-color_accent/40">
                  <AvatarImage src={profile.photoURL ?? undefined} alt="" />
                  <AvatarFallback className="bg-color_accent/20 font-display text-xs text-color_text">
                    {(profile.displayName ?? "?").charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="type-display text-sm text-color_text font-medium uppercase tracking-wide">
                  {profile.displayName}
                </span>
              </Link>
            )}
            {!loading &&
              (user ? <LogoutButton /> : <LoginButton size="sm" variant="primary" label="Sign in" />)}
          </div>
        </div>
      </header>

      <Toaster closeButton />

      {/* --- Content region: routed pages compose their own framed cells --- */}
      <main className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div key={location.pathname} className="flex min-h-0 min-w-0 flex-1 flex-col animate-cotton-fade">
          {children}
        </div>
      </main>
    </div>
  );
}

/** Native share where the browser has it, clipboard everywhere else. A pitch
 *  link that spreads is the entire point of the button. */
async function handleShare() {
  const url = window.location.origin + window.location.pathname + window.location.hash;
  try {
    if (navigator.share) {
      await navigator.share({ title: SITE_NAME, url });
      return;
    }
    await navigator.clipboard.writeText(url);
  } catch {
    // A cancelled share sheet rejects. That is the user declining, not a
    // failure worth surfacing.
  }
}
