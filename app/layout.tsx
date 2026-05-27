import type { Metadata } from "next";
import { Fraunces, DM_Sans } from "next/font/google";
import "./globals.css";
import { handleSignOut } from "./actions";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  axes: ["opsz"],
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
});

export const metadata: Metadata = {
  title: "WC Pool 2026",
  description: "Predict every match. Climb the leaderboard.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${fraunces.variable} ${dmSans.variable}`}>

        <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-stone-200">
          <div className="mx-auto max-w-5xl flex items-center justify-between px-5 h-14">
            <a href="/" className="flex items-center gap-2.5 select-none">
              <span className="text-base leading-none">⚽</span>
              <span className="font-display text-[15px] font-semibold text-stone-900 tracking-tight">
                WC Pool <span className="text-green-700">2026</span>
              </span>
            </a>
            <nav className="flex items-center gap-0.5 text-[14px]">
              <a href="/" className="px-3 py-1.5 rounded-lg text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-colors font-medium">
                Standings
              </a>
              <a href="/picks" className="px-3 py-1.5 rounded-lg text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-colors font-medium">
                My Picks
              </a>
              <div className="ml-2">
                <AuthButton />
              </div>
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-5 py-8">{children}</main>

      </body>
    </html>
  );
}

async function AuthButton() {
  const { auth } = await import("@/lib/auth");
  const session = await auth();
  if (session?.user) {
    return (
      <form action={handleSignOut}>
        <button
          type="submit"
          className="px-3 py-1.5 rounded-lg text-[14px] font-medium bg-stone-100 text-stone-700 hover:bg-stone-200 transition-colors"
        >
          Sign out
        </button>
      </form>
    );
  }
  return (
    <a
      href="/api/auth/signin?callbackUrl=/"
      className="px-4 py-1.5 rounded-lg text-[14px] font-semibold bg-green-800 text-white hover:bg-green-700 transition-colors shadow-sm"
    >
      Sign in
    </a>
  );
}
