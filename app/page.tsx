import { getAllMatches, getAllPicks, getAllUsers, getAllOdds } from "@/lib/services/supabase";
import { computeLeaderboard, getRoundStates, getActiveRound } from "@/lib/services/scoring";
import { auth } from "@/lib/auth";
import LeaderboardClient from "./LeaderboardClient";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let matches, picks, users, odds, session;
  try {
    [matches, picks, users, odds, session] = await Promise.all([
      getAllMatches(),
      getAllPicks(),
      getAllUsers(),
      getAllOdds(),
      auth(),
    ]);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : JSON.stringify(e, null, 2);
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800">
        <p className="font-bold mb-1">Startup error</p>
        <pre className="text-xs whitespace-pre-wrap">{msg}</pre>
      </div>
    );
  }

  const leaderboard = computeLeaderboard(users, picks, matches);
  const roundStates = getRoundStates(matches);
  const activeRound = getActiveRound(roundStates);

  const now = new Date();
  const popularPicks: Record<string, { H: number; A: number; T: number; total: number }> = {};
  for (const rs of roundStates) {
    if (!rs.deadline || now < new Date(rs.deadline)) continue;
    const roundMatches = matches.filter(m => m.round === rs.round);
    for (const match of roundMatches) {
      const mp = picks.filter(p => p.matchId === match.matchId);
      popularPicks[match.matchId] = { H: 0, A: 0, T: 0, total: mp.length };
      for (const p of mp) {
        if (p.pick) popularPicks[match.matchId][p.pick as "H"|"A"|"T"]++;
      }
    }
  }

  return (
    <LeaderboardClient
      leaderboard={leaderboard}
      matches={matches}
      roundStates={roundStates}
      activeRound={activeRound}
      popularPicks={popularPicks}
      odds={odds}
      currentUserEmail={session?.user?.email ?? null}
    />
  );
}
