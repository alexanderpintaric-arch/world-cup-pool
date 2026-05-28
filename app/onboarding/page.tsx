import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getUserLeagues } from "@/lib/services/leagues";
import OnboardingClient from "./OnboardingClient";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.email) redirect("/auth/signin");

  // Users who already belong to a league have nothing to do here
  const leagues = await getUserLeagues(session.user.email);
  if (leagues.length > 0) redirect("/");

  const params = await searchParams;
  const defaultMode = params.mode === "join" ? "join" : "create";

  return <OnboardingClient defaultMode={defaultMode} />;
}
