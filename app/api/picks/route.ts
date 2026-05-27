export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPicksForUser, upsertPicksBatch, getAllMatches } from "@/lib/services/supabase";
import { getRoundStates } from "@/lib/services/scoring";
import type { Pick } from "@/lib/types";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const picks = await getPicksForUser(session.user.email);
  return NextResponse.json(picks);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const picks: { matchId: string; pick: string }[] = body.picks;

  if (!Array.isArray(picks) || picks.length === 0) {
    return NextResponse.json({ error: "No picks provided" }, { status: 400 });
  }

  // Validate picks are for an open round and deadline hasn't passed
  const allMatches = await getAllMatches();
  const roundStates = getRoundStates(allMatches);
  const openRounds = new Set(roundStates.filter(r => r.isOpen).map(r => r.round));
  const matchMap = new Map(allMatches.map(m => [m.matchId, m]));

  const now = new Date().toISOString();
  const validPicks: Pick[] = [];

  for (const p of picks) {
    const match = matchMap.get(p.matchId);
    if (!match) continue;
    if (!openRounds.has(match.round)) continue;
    if (!["H", "A", "T"].includes(p.pick)) continue;
    // No ties in knockout rounds
    if (p.pick === "T" && match.round !== "GROUP") continue;

    validPicks.push({
      email:       session.user.email!,
      matchId:     p.matchId,
      round:       match.round,
      pick:        p.pick as Pick["pick"],
      submittedAt: now,
      updatedAt:   now,
    });
  }

  if (validPicks.length === 0) {
    return NextResponse.json({ error: "No valid picks — round may be closed" }, { status: 400 });
  }

  await upsertPicksBatch(validPicks);
  return NextResponse.json({ saved: validPicks.length });
}
