"use server";
import { signIn, signOut, auth } from "@/lib/auth";
import { createLeague as dbCreateLeague, joinLeagueByCode, setLeagueBuyIn } from "@/lib/services/leagues";
import { setUserSupportedTeam } from "@/lib/services/supabase";
import { sendLeagueWelcomeEmail } from "@/lib/services/email";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { League } from "@/lib/types";

export async function handleSignIn(formData: FormData) {
  const callbackUrl = (formData.get("callbackUrl") as string) || "/";
  await signIn("google", { redirectTo: callbackUrl });
}

export async function handleSignOut() {
  await signOut({ redirectTo: "/" });
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
  if (!session?.user?.email) redirect("/auth/signin");

  const name = String(formData.get("name") ?? "").trim();
  if (!name)          return { error: "Please enter a league name." };
  if (name.length > 50) return { error: "League name must be 50 characters or less." };

  let league: League;
  try {
    league = await dbCreateLeague(name, session.user.email);
  } catch {
    return { error: "Something went wrong. Please try again." };
  }

  // Welcome email (non-fatal — never block league creation on email)
  try {
    await sendLeagueWelcomeEmail(
      session.user.email,
      session.user.name ?? session.user.email,
      { leagueName: league.name, code: league.code, isCreator: true }
    );
  } catch (e) {
    console.error("Welcome email failed (create):", e);
  }

  (await cookies()).set(LEAGUE_COOKIE, league.id, COOKIE_OPTS);
  redirect("/");
}

export async function handleJoinLeague(
  _prev: LeagueActionState,
  formData: FormData
): Promise<LeagueActionState> {
  const session = await auth();
  if (!session?.user?.email) redirect("/auth/signin");

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

  // Welcome email — only for a genuinely new membership (non-fatal)
  if (!result.alreadyMember) {
    try {
      await sendLeagueWelcomeEmail(
        session.user.email,
        session.user.name ?? session.user.email,
        { leagueName: result.league.name, code: result.league.code, isCreator: false }
      );
    } catch (e) {
      console.error("Welcome email failed (join):", e);
    }
  }

  (await cookies()).set(LEAGUE_COOKIE, result.league.id, COOKIE_OPTS);
  redirect("/");
}

// ── Supported team ─────────────────────────────────────────────────────────

/** team = null to clear the selection */
export async function handleSetSupportedTeam(team: string | null): Promise<void> {
  const session = await auth();
  if (!session?.user?.email) return;
  await setUserSupportedTeam(session.user.email, team);
  revalidatePath("/", "layout");
}

// ── Buy-in ─────────────────────────────────────────────────────────────────

export async function handleSetLeagueBuyIn(leagueId: string, amount: number): Promise<void> {
  const session = await auth();
  if (!session?.user?.email) return;
  await setLeagueBuyIn(leagueId, session.user.email, amount);
  revalidatePath("/", "layout");
}

// ── Display name ──────────────────────────────────────────────────────────

export async function handleUpdateDisplayName(name: string): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user?.email) return { error: "Not signed in." };
  const trimmed = name.trim();
  if (!trimmed)            return { error: "Name can't be empty." };
  if (trimmed.length > 40) return { error: "Name must be 40 characters or less." };
  try {
    const { setUserDisplayName } = await import("@/lib/services/supabase");
    await setUserDisplayName(session.user.email, trimmed);
  } catch {
    return { error: "Something went wrong. Please try again." };
  }
  revalidatePath("/", "layout");
  return {};
}

// ── League switch ──────────────────────────────────────────────────────────

/** Bound action: handleSwitchLeague.bind(null, leagueId) */
export async function handleSwitchLeague(leagueId: string): Promise<void> {
  (await cookies()).set(LEAGUE_COOKIE, leagueId, COOKIE_OPTS);
  // Invalidate the full layout so every page re-fetches with the new league cookie
  revalidatePath("/", "layout");
  redirect("/");
}
