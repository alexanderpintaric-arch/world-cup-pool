export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { auth, isAdmin } from "@/lib/auth";
import { runSync } from "@/lib/services/sync";

export async function POST(req: Request) {
  // Allow cron (bearer token) or admin session
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (!isCron) {
    const session = await auth();
    if (!isAdmin(session?.user?.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const result = await runSync();
  return NextResponse.json(result);
}

export async function GET() {
  // Return last sync info (public)
  const { getLastSync } = await import("@/lib/services/supabase");
  const last = await getLastSync();
  return NextResponse.json(last ?? { syncedAt: null });
}
