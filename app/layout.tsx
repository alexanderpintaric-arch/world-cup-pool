import type { Metadata } from "next";
import "./globals.css";
import { handleSignOut } from "./actions";
import type { LeagueWithRole } from "@/lib/types";
import { LeagueSwitcher } from "./LeagueSwitcher";
import MobileNavBar from "./MobileNavBar";
import DesktopNavLinks from "./DesktopNavLinks";

export const metadata: Metadata = {
  title: "WC Pool '26 — Friendly predictions for the 2026 World Cup",
  description: "A 2026 World Cup prediction pool. Pick every match. Climb the leaderboard.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">

        <header className="sticky top-0 z-40 bg-paper/85 backdrop-blur-md border-b border-line">
          <div className="mx-auto max-w-6xl flex items-center justify-between px-5 sm:px-8 h-14">

            {/* Brand */}
            <a href="/" className="flex items-baseline gap-2.5 group select-none">
              <span className="font-serif italic text-[19px] font-medium ink leading-none" style={{fontVariationSettings: '"opsz" 60'}}>
                WC&nbsp;Pool
              </span>
              <span className="font-mono text-[11px] font-medium tabular ink-faint group-hover:text-accent transition-colors">
                &rsquo;26
              </span>
            </a>

            {/* Nav — desktop only */}
            <nav className="flex items-center gap-1 sm:gap-2">
              {/* Nav links: hidden on mobile, shown on sm+ */}
              <div className="hidden sm:flex items-center gap-1">
                <NavLinksWrapper />
                <AdminNavLink />
              </div>
              <div className="ml-0 sm:ml-2">
                <LeagueNav />
              </div>
              <div className="ml-1 sm:ml-3">
                <AuthButton />
              </div>
            </nav>

          </div>
        </header>

        {/* Extra bottom padding on mobile to clear the fixed bottom nav */}
        <main className="relative z-10 mx-auto max-w-6xl px-5 sm:px-8 py-8 sm:py-12 pb-24 sm:pb-12">
          {children}
        </main>

        <footer className="relative z-10 mx-auto max-w-6xl px-5 sm:px-8 py-10 mt-12 mb-16 sm:mb-0">
          <div className="border-t border-line pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[12px] ink-faint">
            <p>
              <span className="font-serif italic">WC Pool &rsquo;26</span> &middot; A friend&rsquo;s pool. Built for friends.
            </p>
            <p className="font-mono tabular">
              Jun 11 &mdash; Jul 19, 2026 &middot; <span className="emoji">🇨🇦 🇲🇽 🇺🇸</span>
            </p>
          </div>
        </footer>

        {/* Mobile bottom navigation — only rendered when signed in */}
        <MobileNav />

      </body>
    </html>
  );
}

// ── Mobile bottom nav ──────────────────────────────────────────────────────
// Server wrapper: auth-gates the client tab bar so it never renders for guests.

async function MobileNav() {
  const { auth, isAdmin } = await import("@/lib/auth");
  const session = await auth();
  if (!session?.user) return null;
  return <MobileNavBar isAdmin={isAdmin(session.user.email)} />;
}

// ── Shared nav components ──────────────────────────────────────────────────

async function LeagueNav() {
  const { auth } = await import("@/lib/auth");
  const session = await auth();
  if (!session?.user?.email) return null;

  const { getUserLeagues } = await import("@/lib/services/leagues");
  const { cookies } = await import("next/headers");

  let leagues: LeagueWithRole[] = [];
  try { leagues = await getUserLeagues(session.user.email); } catch { return null; }
  if (leagues.length === 0) return null;

  const cookieStore = await cookies();
  const activeId = cookieStore.get("wcp_league")?.value;
  const active = leagues.find(l => l.id === activeId) ?? leagues[0];

  return <LeagueSwitcher active={active} all={leagues} />;
}

async function NavLinksWrapper() {
  const { auth } = await import("@/lib/auth");
  const session = await auth();
  if (!session?.user) return null;
  return <DesktopNavLinks />;
}

async function AdminNavLink() {
  const { auth, isAdmin } = await import("@/lib/auth");
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) return null;
  return (
    <a
      href="/admin"
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13.5px] font-medium ink-soft hover:ink hover:bg-paper-deep transition-colors"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-accent flex-shrink-0" />
      Admin
    </a>
  );
}

async function AuthButton() {
  const { auth } = await import("@/lib/auth");
  const session = await auth();
  if (session?.user) {
    const initials = (session.user.name ?? session.user.email ?? "?")
      .split(/\s+/).map(s => s[0]).join("").slice(0, 2).toUpperCase();
    return (
      <form action={handleSignOut} className="flex items-center gap-2">
        <div className="h-7 w-7 rounded-full bg-ink text-paper flex items-center justify-center text-[10px] font-semibold tracking-wide flex-shrink-0">
          {initials}
        </div>
        {/* "Sign out" text hidden on mobile — too cramped */}
        <button
          type="submit"
          className="hidden sm:inline text-[12.5px] font-medium ink-soft hover:text-accent transition-colors editorial-underline"
        >
          Sign&nbsp;out
        </button>
      </form>
    );
  }
  return (
    <a
      href="/auth/signin"
      className="px-3.5 py-1.5 rounded-md text-[13px] font-semibold bg-ink text-paper hover:bg-accent transition-colors"
    >
      Sign&nbsp;in
    </a>
  );
}
