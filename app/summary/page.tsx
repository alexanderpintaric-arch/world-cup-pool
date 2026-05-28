export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getAllMatches, getPicksForUser } from "@/lib/services/supabase";
import { getUserLeagues } from "@/lib/services/leagues";
import { getRoundStates } from "@/lib/services/scoring";
import SummaryClient from "./SummaryClient";

export default async function SummaryPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/auth/signin");

  const email = session.user.email;
  const name  = session.user.name ?? email;

  const leagues = await getUserLeagues(email);
  if (leagues.length === 0) redirect("/onboarding");

  const cookieStore = await cookies();
  const activeLeagueId = cookieStore.get("wcp_league")?.value;
  const activeLeague = leagues.find(l => l.id === activeLeagueId) ?? leagues[0];

  const [matches, userPicks] = await Promise.all([
    getAllMatches(),
    getPicksForUser(email, activeLeague.id),
  ]);

  const roundStates = getRoundStates(matches);

  return (
    <SummaryClient
      matches={matches}
      userPicks={userPicks}
      roundStates={roundStates}
      userName={name}
      leagueName={activeLeague.name}
    />
  );
}
