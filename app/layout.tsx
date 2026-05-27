import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "next-auth/react";
import { handleSignIn, handleSignOut } from "./actions";

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
        <SessionProvider>
          {/* Nav */}
          <nav className="sticky top-0 z-50 border-b border-emerald-900/20 bg-emerald-900 shadow-md">
            <div className="mx-auto max-w-4xl flex items-center justify-between px-4 h-14">
              <a href="/" className="flex items-center gap-2 whitespace-nowrap flex-shrink-0">
                <span className="text-xl">⚽</span>
                <span className="font-bold text-white text-base tracking-tight">
                  WC Pool <span className="text-emerald-300">2026</span>
                </span>
              </a>
              <div className="flex items-center gap-1 sm:gap-3 text-sm ml-4">
                <a href="/" className="px-2 py-1 rounded text-emerald-100 hover:text-white hover:bg-emerald-800 transition">
                  Leaderboard
                </a>
                <a href="/picks" className="px-2 py-1 rounded text-emerald-100 hover:text-white hover:bg-emerald-800 transition">
                  My Picks
                </a>
                <AuthButton />
              </div>
            </div>
          </nav>

          {/* Page hero strip */}
          <div className="bg-emerald-900 pb-6 pt-1">
            <div className="mx-auto max-w-4xl px-4">
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-emerald-700/50" />
                <span className="text-emerald-400 text-xs font-medium tracking-widest uppercase">FIFA World Cup · Canada · Mexico · USA</span>
                <div className="h-px flex-1 bg-emerald-700/50" />
              </div>
            </div>
          </div>

          <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
        </SessionProvider>
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
        <button type="submit" className="px-3 py-1.5 rounded-lg text-sm font-medium bg-emerald-800 text-emerald-100 hover:bg-emerald-700 transition">
          Sign out
        </button>
      </form>
    );
  }
  return (
    <a href="/api/auth/signin/google?callbackUrl=/" className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-yellow-400 text-emerald-900 hover:bg-yellow-300 transition shadow-sm">
      Sign in
    </a>
  );
}
