"use server";
import { signIn, signOut, auth } from "@/lib/auth";
import { createLeague as dbCreateLeague, joinLeagueByCode } from "@/lib/services/leagues";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { League } from "@/lib/types";

export async function handleSignIn() {
  await signIn("google");
}

export async function handleSignOut() {
  await signOut();
}

// ── League actions ─────────────────────────────────────────────────────────

export type LeagueActionState = { error?: string } | null;

const LEAGUE_COOKIE = "wcp_league";
const COOKIE_OPTS = {
  path:     "/",
  maxAge:   60 * 60 * 24 * 365,
  httpOnly: true,
  sameSite: "lax" as const,
};

export async function handleCreateLeague(
  _prev: LeagueActionState,
  formData: FormData
): Promise<LeagueActionState> {
  const session = await auth();
  if (!session?.user?.email) redirect("/api/auth/signin");

  const name = String(formData.get("name") ?? "").trim();
  if (!name)          return { error: "Please enter a league name." };
  if (name.length > 50) return { error: "League name must be 50 characters or less." };

  let league: League;
  try {
    league = await dbCreateLeague(name, session.user.email);
  } catch {
    return { error: "Something went wrong. Please try again." };
  }

  (await cookies()).set(LEAGUE_COOKIE, league.id, COOKIE_OPTS);
  redirect("/");
}

export async function handleJoinLeague(
  _prev: LeagueActionState,
  formData: FormData
): Promise<LeagueActionState> {
  const session = await auth();
  if (!session?.user?.email) redirect("/api/auth/signin");

  const code = String(formData.get("code") ?? "").trim();
  if (!code) return { error: "Please enter a league code." };

  let result: Awaited<ReturnType<typeof joinLeagueByCode>>;
  try {
    result = await joinLeagueByCode(code, session.user.email);
  } catch {
    return { error: "Something went wrong. Please try again." };
  }

  if (!result.success || !result.league) {
    return { error: result.error ?? "Could not join that league." };
  }

  (await cookies()).set(LEAGUE_COOKIE, result.league.id, COOKIE_OPTS);
  redirect("/");
}

/** Bound action: handleSwitchLeague.bind(null, leagueId) */
export async function handleSwitchLeague(leagueId: string): Promise<void> {
  (await cookies()).set(LEAGUE_COOKIE, leagueId, COOKIE_OPTS);
  redirect("/");
}
