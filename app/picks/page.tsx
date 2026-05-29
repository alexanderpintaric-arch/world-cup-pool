export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import {
  getAllMatches, getPicksForUser, getAllOdds, getPicksForLeague, getBracketPicks,
} from "@/lib/services/supabase";
import { getUserLeagues } from "@/lib/services/leagues";
import { getRoundStates, getActiveRound } from "@/lib/services/scoring";
import { orderedR32Matches } from "@/lib/services/bracket";
import PicksClient from "./PicksClient";

const isMock = !process.env.NEXT_PUBLIC_SUPABASE_URL;

export default async function PicksPage() {
  const session = await auth();
  if (!isMock && !session?.user?.email) redirect("/auth/signin");

  const mockEmail = "alex@example.com";
  const email = session?.user?.email ?? mockEmail;
  const name  = session?.user?.name  ?? "Alex P.";

  // League gate
  let leagueId: string;
  if (isMock) {
    leagueId = "mock-league";
  } else {
    const leagues = await getUserLeagues(email);
    if (leagues.length === 0) redirect("/onboarding");

    const cookieStore = await cookies();
    const activeLeagueId = cookieStore.get("wcp_league")?.value;
    const activeLeague = leagues.find(l => l.id === activeLeagueId) ?? leagues[0];
    leagueId = activeLeague.id;
  }

  const [matches, userPicks, odds, allPicks, bracketPicks] = await Promise.all([
    getAllMatches(),
    getPicksForUser(email, leagueId),
    getAllOdds(),
    getPicksForLeague(leagueId),
    getBracketPicks(email, leagueId),
  ]);

  const roundStates = getRoundStates(matches);
  const activeRound = getActiveRound(roundStates);

  // ── Bracket gate ─────────────────────────────────────────────────────────
  // The knockout bracket opens once the group stage is complete (R32 available)
  // and locks all at once at the first Round-of-32 kickoff.
  const r32State = roundStates.find(r => r.round === "ROUND_OF_32");
  const bracketAvailable = r32State?.isAvailable ?? false;
  const r32Slots = orderedR32Matches(matches);
  const r32Kickoffs = r32Slots
    .filter((m): m is NonNullable<typeof m> => !!m)
    .map(m => new Date(m.kickoffUtc).getTime());
  const bracketDeadline = r32Kickoffs.length > 0
    ? new Date(Math.min(...r32Kickoffs)).toISOString()
    : null;
  const bracketLocked = bracketDeadline !== null && Date.now() >= new Date(bracketDeadline).getTime();

  // ── Anonymous vote counts ───────────────────────────────────────────────
  // Used only for the "X picks in" footer badge on SCHEDULED matches.
  // We do NOT break out per-option splits here — those live on /community.
  const popularCounts: Record<string, { H: number; A: number; T: number; total: number }> = {};
  for (const pick of allPicks) {
    if (!popularCounts[pick.matchId]) popularCounts[pick.matchId] = { H: 0, A: 0, T: 0, total: 0 };
    const pc = popularCounts[pick.matchId];
    if (pick.pick === "H")      pc.H++;
    else if (pick.pick === "A") pc.A++;
    else if (pick.pick === "T") pc.T++;
    pc.total++;
  }

  return (
    <PicksClient
      matches={matches}
      userPicks={userPicks}
      odds={odds}
      roundStates={roundStates}
      activeRound={activeRound}
      userEmail={email}
      userName={name}
      popularCounts={popularCounts}
      bracketPicks={bracketPicks}
      bracketAvailable={bracketAvailable}
      bracketLocked={bracketLocked}
      bracketDeadline={bracketDeadline}
    />
  );
}
