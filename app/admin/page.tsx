import { auth, isAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getLastSync } from "@/lib/services/supabase";
import AdminClient from "./AdminClient";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user?.email || !isAdmin(session.user.email)) redirect("/");

  const lastSync = await getLastSync();

  return <AdminClient lastSync={lastSync} />;
}
