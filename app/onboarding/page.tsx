import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import OnboardingClient from "./OnboardingClient";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.email) redirect("/auth/signin");

  const params = await searchParams;
  const defaultMode = params.mode === "join" ? "join" : "create";

  return <OnboardingClient defaultMode={defaultMode} />;
}
