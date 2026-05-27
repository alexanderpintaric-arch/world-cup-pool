import { NextResponse } from "next/server";
import { getAllMatches, getAllPicks, getAllUsers, getAllOdds } from "@/lib/services/supabase";
import { computeLeaderboard, getRoundStates, getActiveRound } from "@/lib/services/scoring";

export const dynamic = "force-dynamic";

export async function GET() {
  const [matches, picks, users, odds] = await Promise.all([
    getAllMatches(),
    getAllPicks(),
    getAllUsers(),
    getAllOdds(),
  ]);

  const leaderboard = computeLeaderboard(users, picks, matches);
  const roundStates = getRoundStates(matches);
  const activeRound = getActiveRound(roundStates);

  // Attach popular picks stats (post-deadline)
  const popularPicks: Record<string, { H: number; A: number; T: number; total: number }> = {};
  const now = new Date();

  for (const rs of roundStates) {
    if (!rs.deadline || now < new Date(rs.deadline)) continue; // only after deadline
    const roundMatches = matches.filter(m => m.round === rs.round);
    for (const match of roundMatches) {
      const matchPicks = picks.filter(p => p.matchId === match.matchId);
      popularPicks[match.matchId] = { H: 0, A: 0, T: 0, total: matchPicks.length };
      for (const p of matchPicks) {
        if (p.pick) popularPicks[match.matchId][p.pick as "H"|"A"|"T"]++;
      }
    }
  }

  return NextResponse.json({
    leaderboard,
    matches,
    roundStates,
    activeRound,
    popularPicks,
    odds,
  });
}
