export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import {
  getAllMatches, getPicksForLeague, getPicksForUser, getAllUsers,
  getBracketPicksForLeague,
} from "@/lib/services/supabase";
import { getUserLeagues, getLeagueMembers } from "@/lib/services/leagues";
import { getRoundStates, getActiveRound } from "@/lib/services/scoring";
import { orderedR32Matches } from "@/lib/services/bracket";
import CommunityClient from "./CommunityClient";

const isMock = !process.env.NEXT_PUBLIC_SUPABASE_URL;

export default async function CommunityPage() {
  const session = await auth();
  if (!isMock && !session?.user?.email) redirect("/auth/signin");

  const mockEmail = "alex@example.com";
  const email = session?.user?.email ?? mockEmail;

  // Determine active league (required for league-scoped picks)
  let leagueId: string;
  let allUsers: Awaited<ReturnType<typeof getAllUsers>>;

  if (isMock) {
    leagueId = "mock-league";
    allUsers = (await import("@/lib/services/mockData")).MOCK_USERS;
  } else {
    const leagues = await getUserLeagues(email);
    if (leagues.length === 0) redirect("/onboarding");

    const cookieStore = await cookies();
    const activeLeagueId = cookieStore.get("wcp_league")?.value;
    const activeLeague = leagues.find(l => l.id === activeLeagueId) ?? leagues[0];
    leagueId = activeLeague.id;

    // Filter allUsers to only league members so names/avatars are league-scoped
    const [fetchedUsers, members] = await Promise.all([
      getAllUsers(),
      getLeagueMembers(leagueId),
    ]);
    const memberEmails = new Set(members.map(m => m.email));
    allUsers = fetchedUsers.filter(u => memberEmails.has(u.email));
  }

  const [matches, allPicks, userPicks, leagueBracketPicks] = await Promise.all([
    getAllMatches(),
    getPicksForLeague(leagueId),
    getPicksForUser(email, leagueId),
    getBracketPicksForLeague(leagueId),
  ]);

  const roundStates = getRoundStates(matches);
  const activeRound  = getActiveRound(roundStates);
  const matchMap     = new Map(matches.map(m => [m.matchId, m]));
  const userMap      = new Map(allUsers.map(u => [u.email, u]));

  // ── Pick counts (all matches, league picks) ────────────────────────────
  // Used for bar widths — always visible regardless of kickoff status.
  const counts: Record<string, { H: number; A: number; T: number; total: number }> = {};
  for (const pick of allPicks) {
    if (!counts[pick.matchId]) counts[pick.matchId] = { H: 0, A: 0, T: 0, total: 0 };
    const c = counts[pick.matchId];
    if (pick.pick === "H")      c.H++;
    else if (pick.pick === "A") c.A++;
    else if (pick.pick === "T") c.T++;
    c.total++;
  }

  // ── Named picks (post-kickoff only) ────────────────────────────────────
  // Only revealed after a match has started; names stay hidden pre-kickoff.
  const named: Record<string, {
    H: { name: string; email: string }[];
    A: { name: string; email: string }[];
    T: { name: string; email: string }[];
  }> = {};
  for (const pick of allPicks) {
    const match = matchMap.get(pick.matchId);
    if (!match || match.status === "SCHEDULED") continue;
    if (!named[pick.matchId]) named[pick.matchId] = { H: [], A: [], T: [] };
    const user  = userMap.get(pick.email);
    const name  = user?.name ?? pick.email;
    const entry = { name, email: pick.email };
    const nd    = named[pick.matchId];
    if (pick.pick === "H")      nd.H.push(entry);
    else if (pick.pick === "A") nd.A.push(entry);
    else if (pick.pick === "T") nd.T.push(entry);
  }

  // ── Current user's picks (for "you" highlighting) ──────────────────────
  const myPicks: Record<string, "H" | "A" | "T"> = {};
  for (const p of userPicks) {
    if (p.pick === "H" || p.pick === "A" || p.pick === "T") {
      myPicks[p.matchId] = p.pick;
    }
  }

  // ── Knockout bracket consensus (per node) ──────────────────────────────
  // Knockout predictions live in bracket_picks; the pool's consensus is "which
  // team did members advance out of each bracket node". Counts are always
  // visible; names stay hidden until the bracket locks (first R32 kickoff).
  const r32Slots = orderedR32Matches(matches);
  const r32Kickoffs = r32Slots
    .filter((m): m is NonNullable<typeof m> => !!m)
    .map(m => new Date(m.kickoffUtc).getTime());
  const bracketLocked = r32Kickoffs.length > 0 && Date.now() >= Math.min(...r32Kickoffs);

  // Per node: team -> count (always), and team -> named pickers (post-lock only).
  const bracketCounts: Record<string, Record<string, number>> = {};
  const bracketNamed: Record<string, Record<string, { name: string; email: string }[]>> = {};
  for (const bp of leagueBracketPicks) {
    (bracketCounts[bp.nodeId] ??= {});
    bracketCounts[bp.nodeId][bp.team] = (bracketCounts[bp.nodeId][bp.team] ?? 0) + 1;
    if (bracketLocked) {
      (bracketNamed[bp.nodeId] ??= {});
      (bracketNamed[bp.nodeId][bp.team] ??= []);
      const name = userMap.get(bp.email)?.name ?? bp.email;
      bracketNamed[bp.nodeId][bp.team].push({ name, email: bp.email });
    }
  }

  // Current user's own bracket (for "you" highlighting).
  const myBracket: Record<string, string> = {};
  for (const bp of leagueBracketPicks) {
    if (bp.email === email) myBracket[bp.nodeId] = bp.team;
  }

  return (
    <CommunityClient
      matches={matches}
      roundStates={roundStates}
      activeRound={activeRound}
      counts={counts}
      named={named}
      myPicks={myPicks}
      userEmail={email}
      bracketCounts={bracketCounts}
      bracketNamed={bracketNamed}
      myBracket={myBracket}
      bracketLocked={bracketLocked}
    />
  );
}
