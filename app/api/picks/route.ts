export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { getPicksForUser, upsertPicksBatch, getAllMatches } from "@/lib/services/supabase";
import { getRoundStates } from "@/lib/services/scoring";
import type { Pick } from "@/lib/types";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cookieStore = await cookies();
  const leagueId = cookieStore.get("wcp_league")?.value;
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

  const cookieStore = await cookies();
  const leagueId = cookieStore.get("wcp_league")?.value;
  if (!leagueId) {
    return NextResponse.json({ error: "No active league — please join or create a league first" }, { status: 400 });
  }

  const body = await req.json();
  const picks: { matchId: string; pick: string }[] = body.picks;

  if (!Array.isArray(picks) || picks.length === 0) {
    return NextResponse.json({ error: "No picks provided" }, { status: 400 });
  }

  const allMatches = await getAllMatches();
  const roundStates = getRoundStates(allMatches);
  // Round must be available (previous round complete) — match must not have started
  const availableRounds = new Set(roundStates.filter(r => r.isAvailable).map(r => r.round));
  const matchMap = new Map(allMatches.map(m => [m.matchId, m]));

  const now = new Date().toISOString();
  const validPicks: Pick[] = [];

  for (const p of picks) {
    const match = matchMap.get(p.matchId);
    if (!match) continue;
    if (!availableRounds.has(match.round)) continue;
    if (match.status !== "SCHEDULED") continue; // match already started or finished
    if (!["H", "A", "T"].includes(p.pick)) continue;
    if (p.pick === "T" && match.round !== "GROUP") continue;

    validPicks.push({
      email:       session.user.email!,
      matchId:     p.matchId,
      round:       match.round,
      pick:        p.pick as Pick["pick"],
      leagueId,
      submittedAt: now,
      updatedAt:   now,
    });
  }

  if (validPicks.length === 0) {
    return NextResponse.json({ error: "No valid picks — round unavailable or match already started" }, { status: 400 });
  }

  try {
    await upsertPicksBatch(validPicks);
  } catch (e) {
    const msg = e instanceof Error ? e.message : ((e as any)?.message ?? JSON.stringify(e));
    console.error("upsertPicksBatch error:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
  return NextResponse.json({ saved: validPicks.length });
}
