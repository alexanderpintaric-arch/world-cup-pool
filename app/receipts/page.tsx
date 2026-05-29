export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getAllMatches, getPicksForUser, getBracketPicks } from "@/lib/services/supabase";
import { getUserLeagues } from "@/lib/services/leagues";
import { getRoundStates } from "@/lib/services/scoring";
import ReceiptsClient from "./ReceiptsClient";

export default async function ReceiptsPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/auth/signin");

  const email = session.user.email;
  const name  = session.user.name ?? email;

  const leagues = await getUserLeagues(email);
  if (leagues.length === 0) redirect("/onboarding");

  const cookieStore = await cookies();
  const activeLeagueId = cookieStore.get("wcp_league")?.value;
  const activeLeague = leagues.find(l => l.id === activeLeagueId) ?? leagues[0];

  const [matches, userPicks, userBracketPicks] = await Promise.all([
    getAllMatches(),
    getPicksForUser(email, activeLeague.id),
    getBracketPicks(email, activeLeague.id),
  ]);

  const roundStates = getRoundStates(matches);

  return (
    <ReceiptsClient
      matches={matches}
      userPicks={userPicks}
      userBracketPicks={userBracketPicks}
      roundStates={roundStates}
      userName={name}
      leagueName={activeLeague.name}
    />
  );
}
