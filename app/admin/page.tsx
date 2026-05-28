export const dynamic = "force-dynamic";

import { auth, isAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getLastSync, getAdminStats } from "@/lib/services/supabase";
import AdminClient from "./AdminClient";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) redirect("/");

  const [lastSync, stats] = await Promise.all([
    getLastSync(),
    getAdminStats(),
  ]);

  return <AdminClient lastSync={lastSync} stats={stats} />;
}
