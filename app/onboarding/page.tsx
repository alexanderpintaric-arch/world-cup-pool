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

  const params = await searchParams;
  const mode = params.mode === "join" ? "join" : params.mode === "create" ? "create" : null;

  // Only auto-bounce home when there's no explicit intent to create/join.
  // This lets existing members reach onboarding to add ANOTHER league, while
  // still keeping aimless visits (e.g. a stale /onboarding link) off the page.
  if (!mode) {
    const leagues = await getUserLeagues(session.user.email);
    if (leagues.length > 0) redirect("/");
  }

  return <OnboardingClient defaultMode={mode ?? "create"} />;
}
