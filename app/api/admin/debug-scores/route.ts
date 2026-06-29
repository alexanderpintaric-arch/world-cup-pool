export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// TEMPORARY verification endpoint — proves the on-traffic self-heal is firing.
// refreshMatchesOnly() bumps matches.updated_at but writes NO sync_log row, so
// if matchesLastUpdated is newer than the latest full-sync synced_at, the gap
// can only have come from the autosync path. Token-gated; removed after check.
const TOKEN = "espn-trace-9f3a";

export async function GET(req: Request) {
  if (new URL(req.url).searchParams.get("key") !== TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: m } = await supabase
    .from("matches").select("updated_at").order("updated_at", { ascending: false }).limit(1).single();
  const { data: s } = await supabase
    .from("sync_log").select("synced_at").order("synced_at", { ascending: false }).limit(1).single();

  const matchesLastUpdated = m?.updated_at as string | undefined;
  const lastFullSync = s?.synced_at as string | undefined;
  const gapMs = matchesLastUpdated && lastFullSync
    ? new Date(matchesLastUpdated).getTime() - new Date(lastFullSync).getTime()
    : null;

  return NextResponse.json({
    now: new Date().toISOString(),
    matchesLastUpdated,
    lastFullSync,
    matchesNewerThanLastFullSyncByMs: gapMs,
    autosyncProven: gapMs != null && gapMs > 2000,
  });
}
