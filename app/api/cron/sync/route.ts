export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { runSync } from "@/lib/services/sync";

// Called every 15 minutes by GitHub Actions (.github/workflows/sync.yml),
// plus a once-daily Vercel Cron fallback (vercel.json). Does not touch odds —
// those are refreshed manually from the admin console.
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runSync();
  return NextResponse.json(result);
}
