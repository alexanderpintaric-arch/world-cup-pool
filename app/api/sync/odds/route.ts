export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { auth, isAdmin } from "@/lib/auth";
import { runOddsSync } from "@/lib/services/sync";

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`;
  if (!isCron) {
    const session = await auth();
    if (!isAdmin(session?.user?.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  const result = await runOddsSync();
  return NextResponse.json(result);
}
