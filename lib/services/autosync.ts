import { after } from "next/server";
import { getMatchesLastUpdated } from "./supabase";
import { refreshMatchesOnly } from "./sync";

// ── On-traffic self-healing sync ─────────────────────────────────────────────
// The scheduled cron (GitHub Actions) is throttled hard by GitHub and in
// practice fires only every 1–5 hours, so a finished game can sit unsettled for
// most of a day waiting on the next run. This closes that gap using the site's
// own traffic: on each visit, AFTER the response is sent (so it never slows the
// page), we check how long it's been since matches were last refreshed and, if
// stale, settle them in the background. The site gets steady traffic, so results
// now land within ~STALE_MS of a visit regardless of the cron's mood.
//
// Emails are intentionally NOT triggered here (see refreshMatchesOnly) — they
// stay on the scheduled runSync to avoid racing the per-round send dedup.

const STALE_MS = 5 * 60 * 1000; // refresh at most once per 5 min

// Per-instance guard: stops a single warm lambda from firing repeatedly within
// the window before its own write lands. Cross-instance bursts are still bounded
// by the DB freshness check below, and refreshMatchesOnly is idempotent and
// email-free, so a rare concurrent refresh is harmless (just a few extra calls).
let lastTriggered = 0;

/**
 * Schedule a background match refresh if the data is stale. Safe to call from
 * any server render (layout/page) — it returns immediately and the work runs
 * after the response via `after()`. Never throws into the render path.
 */
export function ensureFreshMatches(): void {
  after(async () => {
    try {
      const now = Date.now();
      if (now - lastTriggered < STALE_MS) return;       // this instance just refreshed
      const last = await getMatchesLastUpdated();
      if (last && now - last < STALE_MS) return;          // data already fresh
      lastTriggered = now;
      const { matchesUpdated, error } = await refreshMatchesOnly();
      console.log(`[autosync] background refresh: matchesUpdated=${matchesUpdated}${error ? ` error=${error}` : ""}`);
    } catch (e) {
      console.error("[autosync] background refresh failed (non-fatal):", e);
    }
  });
}
