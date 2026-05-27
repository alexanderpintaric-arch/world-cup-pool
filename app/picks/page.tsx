import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAllMatches, getPicksForUser, getAllOdds } from "@/lib/services/supabase";
import { getRoundStates, getActiveRound } from "@/lib/services/scoring";
import PicksClient from "./PicksClient";

const isMock = !process.env.NEXT_PUBLIC_SUPABASE_URL;

export default async function PicksPage() {
  const session = await auth();
  if (!isMock && !session?.user?.email) redirect("/api/auth/signin");

  const mockEmail = "alex@example.com";
  const email = session?.user?.email ?? mockEmail;
  const name = session?.user?.name ?? "Alex P.";

  const [matches, userPicks, odds] = await Promise.all([
    getAllMatches(),
    getPicksForUser(email),
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
      userEmail={email}
      userName={name}
    />
  );
}
