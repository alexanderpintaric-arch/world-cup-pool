export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// TEMPORARY diagnostic endpoint — when did the SA/Canada result settle, and how
// often is the sync actually running? Token-gated; remove once diagnosed.
const TOKEN = "espn-trace-9f3a";

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get("key") !== TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // The exact match row, including updated_at (getAllMatches drops it).
  const { data: match } = await supabase
    .from("matches")
    .select("*")
    .eq("match_id", "537417")
    .single();

  // Recent sync history — synced_at cadence reveals how often the cron fires,
  // and matches_updated / error reveal whether syncs are doing their job.
  const { data: syncLog } = await supabase
    .from("sync_log")
    .select("synced_at, matches_updated, rounds_opened, emails_sent, error")
    .order("synced_at", { ascending: false })
    .limit(20);

  return NextResponse.json({
    now: new Date().toISOString(),
    match,
    recentSyncs: syncLog,
  });
}
