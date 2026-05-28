import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  getAllMatches, getAllPicks, getAllUsers, getPicksForUser,
} from "@/lib/services/supabase";
import { getRoundStates, getActiveRound } from "@/lib/services/scoring";
import CommunityClient from "./CommunityClient";

const isMock = !process.env.NEXT_PUBLIC_SUPABASE_URL;

export default async function CommunityPage() {
  const session = await auth();
  if (!isMock && !session?.user?.email) redirect("/api/auth/signin");

  const mockEmail = "alex@example.com";
  const email = session?.user?.email ?? mockEmail;

  const [matches, allPicks, allUsers, userPicks] = await Promise.all([
    getAllMatches(),
    getAllPicks(),
    getAllUsers(),
    getPicksForUser(email),
  ]);

  const roundStates = getRoundStates(matches);
  const activeRound  = getActiveRound(roundStates);
  const matchMap     = new Map(matches.map(m => [m.matchId, m]));
  const userMap      = new Map(allUsers.map(u => [u.email, u]));

  // ── Pick counts (all matches, all picks) ───────────────────────────────
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

  return (
    <CommunityClient
      matches={matches}
      roundStates={roundStates}
      activeRound={activeRound}
      counts={counts}
      named={named}
      myPicks={myPicks}
      userEmail={email}
    />
  );
}
