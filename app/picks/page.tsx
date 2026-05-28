import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  getAllMatches, getPicksForUser, getAllOdds, getAllPicks, getAllUsers,
} from "@/lib/services/supabase";
import { getRoundStates, getActiveRound } from "@/lib/services/scoring";
import PicksClient from "./PicksClient";

const isMock = !process.env.NEXT_PUBLIC_SUPABASE_URL;

export default async function PicksPage() {
  const session = await auth();
  if (!isMock && !session?.user?.email) redirect("/api/auth/signin");

  const mockEmail = "alex@example.com";
  const email = session?.user?.email ?? mockEmail;
  const name  = session?.user?.name  ?? "Alex P.";

  const [matches, userPicks, odds, allPicks, allUsers] = await Promise.all([
    getAllMatches(),
    getPicksForUser(email),
    getAllOdds(),
    getAllPicks(),
    getAllUsers(),
  ]);

  const roundStates  = getRoundStates(matches);
  const activeRound  = getActiveRound(roundStates);

  // ── Named pick breakdown ────────────────────────────────────────────────
  // Only revealed AFTER a match kicks off (status ≠ SCHEDULED).
  // Maps matchId → { H: string[], A: string[], T: string[] } of first names.
  const matchMap = new Map(matches.map(m => [m.matchId, m]));
  const userMap  = new Map(allUsers.map(u => [u.email, u]));

  const breakdowns: Record<string, { H: string[]; A: string[]; T: string[] }> = {};
  for (const pick of allPicks) {
    const match = matchMap.get(pick.matchId);
    if (!match || match.status === "SCHEDULED") continue; // keep picks secret before kickoff
    if (!breakdowns[pick.matchId]) breakdowns[pick.matchId] = { H: [], A: [], T: [] };
    const firstName = (userMap.get(pick.email)?.name ?? pick.email).split(/\s+/)[0];
    const bd = breakdowns[pick.matchId];
    if (pick.pick === "H")      bd.H.push(firstName);
    else if (pick.pick === "A") bd.A.push(firstName);
    else if (pick.pick === "T") bd.T.push(firstName);
  }

  // ── Anonymous vote counts ───────────────────────────────────────────────
  // Used only for the "X votes in" footer badge on SCHEDULED matches.
  // We do NOT show per-option %s before kickoff to keep picks private.
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
      breakdowns={breakdowns}
      popularCounts={popularCounts}
    />
  );
}
