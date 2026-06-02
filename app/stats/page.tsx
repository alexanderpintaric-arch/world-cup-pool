export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import {
  getAllMatches, getPicksForLeague, getBracketPicksForLeague, getAllUsers,
} from "@/lib/services/supabase";
import { getUserLeagues, getLeagueMembers } from "@/lib/services/leagues";
import { computeLeaderboard } from "@/lib/services/scoring";
import { computePlayerStats } from "@/lib/services/stats";
import StatsClient from "./StatsClient";

const isMock = !process.env.NEXT_PUBLIC_SUPABASE_URL;

export default async function StatsPage() {
  const session = await auth();
  if (!isMock && !session?.user?.email) redirect("/auth/signin");

  const email = session?.user?.email ?? "alex@example.com";
  const name  = session?.user?.name  ?? "Alex P.";

  let leagueId: string;
  let leagueName: string;
  if (isMock) {
    leagueId = "mock-league";
    leagueName = "The Lads";
  } else {
    const leagues = await getUserLeagues(email);
    if (leagues.length === 0) redirect("/onboarding");
    const cookieStore = await cookies();
    const activeLeagueId = cookieStore.get("wcp_league")?.value;
    const activeLeague = leagues.find(l => l.id === activeLeagueId) ?? leagues[0];
    leagueId = activeLeague.id;
    leagueName = activeLeague.name;
  }

  const [matches, leaguePicks, leagueBracketPicks, members, users] = await Promise.all([
    getAllMatches(),
    getPicksForLeague(leagueId),
    getBracketPicksForLeague(leagueId),
    isMock ? Promise.resolve([]) : getLeagueMembers(leagueId),
    getAllUsers(),
  ]);

  // In mock mode there's no league_members table — score everyone we have.
  const leagueUsers = isMock
    ? users
    : users.filter(u => new Set(members.map(m => m.email)).has(u.email));
  const entries = computeLeaderboard(leagueUsers, leaguePicks, matches, leagueBracketPicks);

  const stats = computePlayerStats({
    email,
    leagueName,
    entries,
    matches,
    myPicks: leaguePicks.filter(p => p.email === email),
    allLeaguePicks: leaguePicks,
    myBracketPicks: leagueBracketPicks.filter(b => b.email === email),
  });

  return <StatsClient stats={stats} firstName={name.split(/\s+/)[0] || "you"} />;
}
