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
        <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center gap-x-6 gap-y-3">
          {/* Nameplate — no static count in the copy, so nothing here can
              drift from the live figures shown in-page. */}
          <div className="order-1 mr-auto flex items-center gap-3 lg:mr-0">
            <Link
              to="/"
              className="group flex items-center gap-2.5 rounded-sm leading-none no-underline outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-color_text"
            >
              <img
                src={assetUrl("/brand/irishtable-logo.svg")}
                alt=""
                aria-hidden
                className="size-6 shrink-0 sm:size-7"
              />
              <span className="font-display text-xl tracking-[0.01em] text-color_text sm:text-[1.55rem]">
                <span className="font-[450]">irish</span>
                <span className="font-thin">table</span>
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

          {/* Navigation — pinned, always visible. One row on desktop. */}
          <nav
            aria-label="Main"
            className="no-scrollbar order-3 -mx-1 flex w-full items-center gap-x-1 overflow-x-auto px-1 lg:order-2 lg:mx-0 lg:w-auto lg:flex-1 lg:justify-center lg:overflow-visible lg:px-0"
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
                    "relative shrink-0 rounded-md px-3 py-1.5 font-mono text-[0.72rem] tracking-[0.14em] uppercase no-underline transition-colors duration-150 ease-[var(--ease-cotton)] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-color_text",
                    active ? "text-color_text" : "text-color_textsecondary hover:text-color_text"
                  )}
                >
                  {link.label}
                  <span
                    aria-hidden
                    className={cn(
                      "absolute inset-x-3 -bottom-px h-[2px] rounded-full bg-color_accent transition-all duration-300 ease-[var(--ease-cotton)]",
                      active ? "opacity-100" : "opacity-0"
                    )}
                  />
                </Link>
              );
            })}
          </nav>

          {/* Account slot. No Dev Panel link — irishtable has no dev panel,
              because it has no phase to override and no fixtures to step
              through. */}
          <div className="order-2 flex items-center gap-3 sm:gap-4 lg:order-3">
            {!loading && user && profile && (
              <Link
                to="/profile"
                className="flex items-center gap-2 rounded-md px-2 py-1 no-underline outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-color_text"
              >
                <Avatar size="sm">
                  <AvatarImage src={profile.photoURL ?? undefined} alt="" />
                  <AvatarFallback className="font-mono text-[0.65rem] text-color_text">
                    {(profile.displayName ?? "?").charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="font-mono text-[0.72rem] tracking-[0.06em] text-color_text">
                  {profile.displayName}
                </span>
              </Link>
            )}
            {!loading &&
              (user ? <LogoutButton /> : <LoginButton size="sm" variant="outline" label="Sign in" />)}
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
