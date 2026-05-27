import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { handleSignOut } from "./actions";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: "2026 World Cup Pool",
  description: "Predict every match. Climb the leaderboard.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geist.variable} ${geistMono.variable} antialiased min-h-screen`} style={{ background: "#f0f4f0" }}>

        {/* Nav */}
        <nav className="sticky top-0 z-50 bg-emerald-950 shadow-lg">
          <div className="mx-auto max-w-4xl flex items-center justify-between px-4 h-14">
            <a href="/" className="flex items-center gap-2.5 whitespace-nowrap flex-shrink-0">
              <span className="text-xl">⚽</span>
              <span className="font-black text-white text-base tracking-tight">
                WC Pool <span className="text-yellow-400">2026</span>
              </span>
            </a>
            <div className="flex items-center gap-1 sm:gap-2 text-sm ml-4">
              <a href="/" className="px-3 py-1.5 rounded-lg text-emerald-300 hover:text-white hover:bg-emerald-800 transition font-medium">
                Standings
              </a>
              <a href="/picks" className="px-3 py-1.5 rounded-lg text-emerald-300 hover:text-white hover:bg-emerald-800 transition font-medium">
                My Picks
              </a>
              <AuthButton />
            </div>
          </div>
        </nav>

        {/* Tournament banner */}
        <div className="bg-gradient-to-b from-emerald-950 to-emerald-900 py-5">
          <div className="mx-auto max-w-4xl px-4">
            <div className="flex flex-col items-center gap-1.5">
              <div className="flex items-center gap-3 text-sm text-emerald-300 font-medium">
                <span>🇨🇦</span>
                <span className="text-emerald-600">—</span>
                <span className="text-yellow-400 font-bold tracking-widest uppercase text-xs">FIFA World Cup 2026</span>
                <span className="text-emerald-600">—</span>
                <span>🇺🇸</span>
              </div>
              <div className="flex items-center gap-4 text-emerald-500 text-xs">
                <span>🇲🇽 Mexico · 🇨🇦 Canada · 🇺🇸 United States</span>
              </div>
              <p className="text-emerald-600 text-xs tracking-wide">June 11 – July 19, 2026 · 64 Matches</p>
            </div>
          </div>
        </div>

        <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>

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
        <button type="submit" className="px-3 py-1.5 rounded-lg text-sm font-medium bg-emerald-800 text-emerald-200 hover:bg-emerald-700 transition">
          Sign out
        </button>
      </form>
    );
  }
  return (
    <a href="/api/auth/signin?callbackUrl=/" className="px-4 py-1.5 rounded-lg text-sm font-bold bg-yellow-400 text-emerald-950 hover:bg-yellow-300 transition shadow-sm">
      Sign in
    </a>
  );
}
