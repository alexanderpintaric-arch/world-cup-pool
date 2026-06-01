export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getAllMatches, getBracketPicks } from "@/lib/services/supabase";
import { getUserLeagues } from "@/lib/services/leagues";
import BracketPrintView from "./BracketPrintView";

export default async function BracketPrintPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/auth/signin");

  const email = session.user.email;
  const name  = session.user.name ?? "Player";

  const leagues = await getUserLeagues(email);
  if (leagues.length === 0) redirect("/onboarding");

  const cookieStore = await cookies();
  const activeLeagueId = cookieStore.get("wcp_league")?.value;
  const activeLeague = leagues.find(l => l.id === activeLeagueId) ?? leagues[0];

  const [matches, bracketPicks] = await Promise.all([
    getAllMatches(),
    getBracketPicks(email, activeLeague.id),
  ]);

  return (
    <BracketPrintView
      bracketPicks={bracketPicks}
      matches={matches}
      userName={name}
      leagueName={activeLeague.name}
      generatedAt={new Date().toISOString()}
    />
  );
}
