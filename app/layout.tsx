import type { Metadata } from "next";
import "./globals.css";
import { handleSignOut } from "./actions";

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

            {/* Nav */}
            <nav className="flex items-center gap-1 sm:gap-2">
              <NavLink href="/">Standings</NavLink>
              <NavLink href="/picks">My Picks</NavLink>
              <div className="ml-1 sm:ml-3">
                <AuthButton />
              </div>
            </nav>

          </div>
        </header>

        <main className="relative z-10 mx-auto max-w-6xl px-5 sm:px-8 py-8 sm:py-12">
          {children}
        </main>

        <footer className="relative z-10 mx-auto max-w-6xl px-5 sm:px-8 py-10 mt-12">
          <div className="border-t border-line pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[12px] ink-faint">
            <p>
              <span className="font-serif italic">WC Pool &rsquo;26</span> &middot; A friend&rsquo;s pool. Built for friends.
            </p>
            <p className="font-mono tabular">
              Jun 11 &mdash; Jul 19, 2026 &middot; <span className="emoji">🇨🇦 🇲🇽 🇺🇸</span>
            </p>
          </div>
        </footer>

      </body>
    </html>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="px-3 py-1.5 rounded-md text-[13.5px] font-medium ink-soft hover:ink hover:bg-paper-deep transition-colors"
    >
      {children}
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
        <div className="h-7 w-7 rounded-full bg-ink text-paper flex items-center justify-center text-[10px] font-semibold tracking-wide">
          {initials}
        </div>
        <button
          type="submit"
          className="text-[12.5px] font-medium ink-soft hover:text-accent transition-colors editorial-underline"
        >
          Sign&nbsp;out
        </button>
      </form>
    );
  }
  return (
    <a
      href="/api/auth/signin?callbackUrl=/"
      className="px-3.5 py-1.5 rounded-md text-[13px] font-semibold bg-ink text-paper hover:bg-accent transition-colors"
    >
      Sign&nbsp;in
    </a>
  );
}
