/**
 * Clear out test leagues before going live.
 *
 *   npm run clear-test-data            # DRY RUN — shows counts, deletes nothing
 *   npm run clear-test-data -- --yes   # actually deletes
 *
 * Wipes (in FK-safe order): picks → league_members → leagues → round_reminders.
 * PRESERVES: users, matches, odds, sync_log.
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from the
 * environment, falling back to .env.local. The service-role key bypasses RLS,
 * so run this locally — never expose it client-side.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ── Load .env.local (no dotenv dependency) ──────────────────────────────────
function loadEnvFile(file) {
  try {
    const txt = readFileSync(resolve(process.cwd(), file), "utf8");
    for (const line of txt.split("\n")) {
      const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*?)\s*$/);
      if (!m) continue;
      const key = m[1];
      const val = m[2].replace(/^['"]|['"]$/g, "");
      // Fill in only when the current value is missing/empty (a real exported
      // value should win, but empty placeholders from the shell must not).
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    /* file optional */
  }
}
loadEnvFile(".env.local");

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !KEY) {
  console.error(
    "\n✗ Missing Supabase credentials (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).\n" +
    "  Your local .env.local likely has these blank — the real values live in Vercel.\n\n" +
    "  Option A — run inline (grab the service_role key from Supabase → Settings → API):\n" +
    "    NEXT_PUBLIC_SUPABASE_URL=\"https://xxxx.supabase.co\" \\\n" +
    "    SUPABASE_SERVICE_ROLE_KEY=\"<service_role_key>\" \\\n" +
    "    npm run clear-test-data -- --yes\n\n" +
    "  Option B — just run scripts/clear-test-data.sql in the Supabase SQL Editor.\n"
  );
  process.exit(1);
}

const APPLY = process.argv.includes("--yes");
const supabase = createClient(URL, KEY, { auth: { persistSession: false } });

// Order matters: children before parents (FK-safe).
const TABLES = [
  { table: "picks",           notNull: "email" },
  { table: "league_members",  notNull: "email" },
  { table: "leagues",         notNull: "id" },
  { table: "round_reminders", notNull: "round" },
];

async function countRows(table) {
  const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
  if (error) return null; // table missing / unreadable
  return count ?? 0;
}

async function wipe(table, notNull) {
  // PostgREST requires a filter on delete; `not null` on a NOT NULL column
  // matches every row.
  const { error } = await supabase.from(table).delete().not(notNull, "is", null);
  if (error) throw new Error(error.message);
}

async function printCounts(label) {
  console.log(`\n${label}`);
  for (const { table } of TABLES) {
    const c = await countRows(table);
    console.log(`  ${table.padEnd(16)} ${c === null ? "(table not found)" : `${c} rows`}`);
  }
}

(async () => {
  console.log(`\nSupabase project: ${URL}`);
  console.log("Will clear:  " + TABLES.map(t => t.table).join(", "));
  console.log("Preserved:   users, matches, odds, sync_log");

  await printCounts("Current row counts:");

  if (!APPLY) {
    console.log("\n⚠  DRY RUN — nothing was deleted.");
    console.log("   Re-run with --yes once you've confirmed the project above:\n");
    console.log("   npm run clear-test-data -- --yes\n");
    process.exit(0);
  }

  console.log("\nDeleting…");
  for (const { table, notNull } of TABLES) {
    try {
      await wipe(table, notNull);
      console.log(`  ✓ cleared ${table}`);
    } catch (e) {
      console.error(`  ✗ ${table}: ${e.message ?? e}`);
    }
  }

  await printCounts("After:");
  console.log("\n✓ Done. Sign in and create your real league — you'll land on /onboarding.\n");
  process.exit(0);
})();
