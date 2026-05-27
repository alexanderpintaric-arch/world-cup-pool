import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "next-auth/react";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: "2026 World Cup Pool",
  description: "Predict every match. Climb the leaderboard.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geist.variable} ${geistMono.variable} antialiased bg-slate-50 min-h-screen`}>
        <SessionProvider>
          <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur">
            <div className="mx-auto max-w-4xl flex items-center justify-between px-4 h-14">
              <a href="/" className="font-bold text-slate-900 hover:text-blue-600 transition">
                ⚽ 2026 WC Pool
              </a>
              <div className="flex items-center gap-4 text-sm">
                <a href="/" className="text-slate-600 hover:text-slate-900 transition">Leaderboard</a>
                <a href="/picks" className="text-slate-600 hover:text-slate-900 transition">My Picks</a>
                <AuthButton />
              </div>
            </div>
          </nav>
          <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
        </SessionProvider>
      </body>
    </html>
  );
}

async function AuthButton() {
  const { auth, signIn, signOut } = await import("@/lib/auth");
  const session = await auth();
  if (session?.user) {
    return (
      <form action={async () => { "use server"; await signOut(); }}>
        <button type="submit" className="text-slate-600 hover:text-slate-900 transition">
          Sign out
        </button>
      </form>
    );
  }
  return (
    <form action={async () => { "use server"; await signIn("google"); }}>
      <button type="submit" className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition">
        Sign in
      </button>
    </form>
  );
}
