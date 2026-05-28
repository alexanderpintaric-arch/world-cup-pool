import { getAllMatches, getAllPicks, getAllUsers, getAllOdds } from "@/lib/services/supabase";
import { getUserLeagues, getLeagueMembers } from "@/lib/services/leagues";
import { computeLeaderboard, getRoundStates, getActiveRound } from "@/lib/services/scoring";
import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import LeaderboardClient from "./LeaderboardClient";
import Landing from "./Landing";

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
      <div className="rounded-lg border border-[color:var(--accent)]/30 bg-accent-soft p-6 text-[color:var(--accent)]">
        <p className="font-serif font-medium text-lg mb-1">Startup error</p>
        <pre className="text-xs whitespace-pre-wrap font-mono ink-soft">{msg}</pre>
      </div>
    );
  }

  const roundStates = getRoundStates(matches);
  const activeRound = getActiveRound(roundStates);

  // Signed-out → landing
  if (!session?.user?.email) {
    return <Landing matches={matches} roundStates={roundStates} participantCount={users.length} />;
  }

  const email = session.user.email;

  // League gate — redirect to onboarding if user hasn't joined/created one yet
  const leagues = await getUserLeagues(email);
  if (leagues.length === 0) redirect("/onboarding");

  // Determine active league from cookie (fall back to first league)
  const cookieStore = await cookies();
  const activeLeagueId = cookieStore.get("wcp_league")?.value;
  const activeLeague = leagues.find(l => l.id === activeLeagueId) ?? leagues[0];

  // Filter leaderboard to league members only
  const members = await getLeagueMembers(activeLeague.id);
  const memberEmails = new Set(members.map(m => m.email));
  const leagueUsers = users.filter(u => memberEmails.has(u.email));
  const leaderboard = computeLeaderboard(leagueUsers, picks, matches);

  // Popular picks for closed rounds (anonymous vote counts for match cards)
  const now = new Date();
  const popularPicks: Record<string, { H: number; A: number; T: number; total: number }> = {};
  for (const rs of roundStates) {
    if (!rs.deadline || now < new Date(rs.deadline)) continue;
    const roundMatches = matches.filter(m => m.round === rs.round);
    for (const match of roundMatches) {
      const mp = picks.filter(p => p.matchId === match.matchId);
      popularPicks[match.matchId] = { H: 0, A: 0, T: 0, total: mp.length };
      for (const p of mp) {
        if (p.pick) popularPicks[match.matchId][p.pick as "H" | "A" | "T"]++;
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
      currentUserEmail={email}
      currentUserName={session.user.name ?? null}
      activeLeague={{
        name:        activeLeague.name,
        code:        activeLeague.code,
        memberCount: activeLeague.memberCount,
      }}
    />
  );
}
