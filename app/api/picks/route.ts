export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { getPicksForUser, upsertPicksBatch, deletePick, getAllMatches, getAllOdds } from "@/lib/services/supabase";
import { getUserLeagues } from "@/lib/services/leagues";
import { getRoundStates } from "@/lib/services/scoring";
import type { Pick } from "@/lib/types";

const LEAGUE_COOKIE = "wcp_league";
const COOKIE_OPTS = {
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
  httpOnly: true,
  sameSite: "lax" as const,
};

/**
 * Resolve the active league for the current user.
 * Uses the wcp_league cookie when it points to a league the user belongs to;
 * otherwise falls back to their first league and re-persists the cookie so it
 * matches what the page renders. Returns null only if the user has no leagues.
 */
async function resolveActiveLeagueId(email: string): Promise<string | null> {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(LEAGUE_COOKIE)?.value;

  const leagues = await getUserLeagues(email);
  if (leagues.length === 0) return null;

  if (fromCookie && leagues.some(l => l.id === fromCookie)) return fromCookie;

  const fallback = leagues[0].id;
  cookieStore.set(LEAGUE_COOKIE, fallback, COOKIE_OPTS);
  return fallback;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const leagueId = await resolveActiveLeagueId(session.user.email);
  if (!leagueId) {
    return NextResponse.json({ error: "No active league" }, { status: 400 });
  }

  const picks = await getPicksForUser(session.user.email, leagueId);
  return NextResponse.json(picks);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const leagueId = await resolveActiveLeagueId(session.user.email);
  if (!leagueId) {
    return NextResponse.json({ error: "No active league — please join or create a league first" }, { status: 400 });
  }

  const body = await req.json();
  const picks: { matchId: string; pick: string | null }[] = body.picks;

  if (!Array.isArray(picks) || picks.length === 0) {
    return NextResponse.json({ error: "No picks provided" }, { status: 400 });
  }

  const [allMatches, allOdds] = await Promise.all([getAllMatches(), getAllOdds()]);
  const roundStates = getRoundStates(allMatches);
  const roundStateMap = new Map(roundStates.map(r => [r.round, r]));
  const availableRounds = new Set(roundStates.filter(r => r.isAvailable).map(r => r.round));
  const matchMap = new Map(allMatches.map(m => [m.matchId, m]));
  const oddsMap = new Map(allOdds.map(o => [o.matchId, o]));

  // Decimal odds of the chosen outcome at this moment — snapshotted onto the pick
  const oddsForPick = (matchId: string, pick: "H" | "A" | "T"): number | null => {
    const o = oddsMap.get(matchId);
    if (!o) return null;
    if (pick === "H") return o.homeOdds ?? null;
    if (pick === "A") return o.awayOdds ?? null;
    return o.drawOdds ?? null;
  };

  const nowMs = Date.now();
  const now = new Date().toISOString();
  const validPicks: Pick[] = [];
  const deleteMatchIds: string[] = [];

  for (const p of picks) {
    const match = matchMap.get(p.matchId);
    if (!match) continue;
    if (!availableRounds.has(match.round)) continue;
    // Reject if the round deadline (first kickoff) has passed — whole round locks at once
    const rs = roundStateMap.get(match.round);
    if (rs?.deadline && nowMs >= new Date(rs.deadline).getTime()) continue;
    if (match.status !== "SCHEDULED") continue;

    // null pick = undo / remove
    if (p.pick === null) {
      deleteMatchIds.push(p.matchId);
      continue;
    }

    if (!["H", "A", "T"].includes(p.pick)) continue;
    if (p.pick === "T" && match.round !== "GROUP") continue;

    validPicks.push({
      email:       session.user.email!,
      matchId:     p.matchId,
      round:       match.round,
      pick:        p.pick as Pick["pick"],
      leagueId,
      odds:        oddsForPick(p.matchId, p.pick as "H" | "A" | "T"),
      submittedAt: now,
      updatedAt:   now,
    });
  }

  if (validPicks.length === 0 && deleteMatchIds.length === 0) {
    return NextResponse.json({ error: "No valid picks — round unavailable or match already started" }, { status: 400 });
  }

  try {
    // Run upserts and deletes in parallel
    await Promise.all([
      validPicks.length > 0 ? upsertPicksBatch(validPicks) : Promise.resolve(),
      ...deleteMatchIds.map(matchId =>
        deletePick(session.user!.email!, matchId, leagueId)
      ),
    ]);
  } catch (e) {
    const msg = e instanceof Error ? e.message : ((e as any)?.message ?? JSON.stringify(e));
    console.error("picks save error:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({ saved: validPicks.length, deleted: deleteMatchIds.length });
}
