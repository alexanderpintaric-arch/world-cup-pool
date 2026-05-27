import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAllMatches, getPicksForUser, getAllOdds } from "@/lib/services/supabase";
import { getRoundStates, getActiveRound } from "@/lib/services/scoring";
import PicksClient from "./PicksClient";

export default async function PicksPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/api/auth/signin");

  const [matches, userPicks, odds] = await Promise.all([
    getAllMatches(),
    getPicksForUser(session.user.email),
    getAllOdds(),
  ]);

  const roundStates = getRoundStates(matches);
  const activeRound = getActiveRound(roundStates);

  return (
    <PicksClient
      matches={matches}
      userPicks={userPicks}
      odds={odds}
      roundStates={roundStates}
      activeRound={activeRound}
      userEmail={session.user.email}
      userName={session.user.name ?? ""}
    />
  );
}
