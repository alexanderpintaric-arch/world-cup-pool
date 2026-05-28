import { createClient } from "@supabase/supabase-js";
import type { Match, Pick, User, OddsData } from "../types";
import { ROUND_CONFIG } from "../constants";
import { MOCK_MATCHES, MOCK_PICKS, MOCK_USERS, MOCK_ODDS } from "./mockData";

const isMock = !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY;

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ── Matches ────────────────────────────────────────────────────────────────

export async function getAllMatches(): Promise<Match[]> {
  if (isMock) return MOCK_MATCHES;
  const { data, error } = await getClient().from("matches").select("*");
  if (error) throw error;
  return (data ?? []).map(rowToMatch);
}

function rowToMatch(r: Record<string, unknown>): Match {
  const round = r.round as Match["round"];
  return {
    matchId:     r.match_id as string,
    round,
    homeTeam:    r.home_team as string,
    awayTeam:    r.away_team as string,
    result:      (r.result as Match["result"]) ?? null,
    status:      r.status as Match["status"],
    kickoffUtc:  r.kickoff_utc as string,
    pointsValue: ROUND_CONFIG[round]?.pointsValue ?? 1,
    homeScore:   r.home_score as number | null,
    awayScore:   r.away_score as number | null,
  };
}

export async function upsertMatches(matches: Match[]): Promise<number> {
  if (isMock) return 0;
  if (matches.length === 0) return 0;

  const rows = matches.map(m => ({
    match_id:     m.matchId,
    round:        m.round,
    home_team:    m.homeTeam,
    away_team:    m.awayTeam,
    result:       m.result,
    status:       m.status,
    kickoff_utc:  m.kickoffUtc,
    points_value: m.pointsValue,
    home_score:   m.homeScore,
    away_score:   m.awayScore,
    updated_at:   new Date().toISOString(),
  }));

  const { error } = await getClient()
    .from("matches")
    .upsert(rows, { onConflict: "match_id", ignoreDuplicates: false });

  if (error) throw error;
  return matches.length;
}

// ── Picks ──────────────────────────────────────────────────────────────────

export async function getPicksForUser(email: string, leagueId?: string): Promise<Pick[]> {
  if (isMock) return MOCK_PICKS.filter(p => p.email === "alex@example.com");
  let query = getClient().from("picks").select("*").eq("email", email);
  if (leagueId) query = query.eq("league_id", leagueId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(rowToPick);
}

/** All picks within a specific league — used for community page and popular counts. */
export async function getPicksForLeague(leagueId: string): Promise<Pick[]> {
  if (isMock) return MOCK_PICKS;
  const { data, error } = await getClient()
    .from("picks")
    .select("*")
    .eq("league_id", leagueId);
  if (error) throw error;
  return (data ?? []).map(rowToPick);
}

/** @deprecated Use getPicksForLeague for scoped queries */
export async function getAllPicks(): Promise<Pick[]> {
  if (isMock) return MOCK_PICKS;
  const { data, error } = await getClient().from("picks").select("*");
  if (error) throw error;
  return (data ?? []).map(rowToPick);
}

function rowToPick(r: Record<string, unknown>): Pick {
  return {
    email:       r.email as string,
    matchId:     r.match_id as string,
    round:       (r.round ?? "GROUP") as Pick["round"],
    pick:        r.pick as Pick["pick"],
    leagueId:    (r.league_id ?? "unknown") as string,
    odds:        (r.odds as number | null) ?? null,
    submittedAt: (r.submitted_at ?? new Date().toISOString()) as string,
    updatedAt:   (r.updated_at ?? r.submitted_at ?? new Date().toISOString()) as string,
  };
}

export async function deletePick(email: string, matchId: string, leagueId: string): Promise<void> {
  if (isMock) return;
  const { error } = await getClient()
    .from("picks")
    .delete()
    .eq("email", email)
    .eq("match_id", matchId)
    .eq("league_id", leagueId);
  if (error) throw error;
}

export async function upsertPicksBatch(picks: Pick[]): Promise<void> {
  if (isMock || picks.length === 0) return;
  const now = new Date().toISOString();
  const baseRows = picks.map(p => ({
    email:        p.email,
    match_id:     p.matchId,
    round:        p.round,
    pick:         p.pick,
    league_id:    p.leagueId,
    submitted_at: now,
  }));
  const rowsWithOdds = baseRows.map((r, i) => ({ ...r, odds: picks[i].odds ?? null }));

  let { error } = await getClient()
    .from("picks")
    .upsert(rowsWithOdds, { onConflict: "email,match_id,league_id" });

  // Graceful fallback: if the `odds` column hasn't been migrated yet, the
  // upsert is rejected with a schema-cache error. Retry without odds so picks
  // still save. (Run migration 003 to enable odds capture.)
  if (error && /odds/i.test(error.message) && /(column|schema cache)/i.test(error.message)) {
    ({ error } = await getClient()
      .from("picks")
      .upsert(baseRows, { onConflict: "email,match_id,league_id" }));
  }

  if (error) throw error;
}

// ── Users ──────────────────────────────────────────────────────────────────

export async function getAllUsers(): Promise<User[]> {
  if (isMock) return MOCK_USERS;
  const { data, error } = await getClient().from("users").select("*");
  if (error) throw error;
  return (data ?? []).map(r => ({
    email:         r.email as string,
    name:          r.name as string,
    createdAt:     r.created_at as string,
    supportedTeam: (r.supported_team as string | null) ?? null,
  }));
}

export async function getUserByEmail(email: string): Promise<User | null> {
  if (isMock) return MOCK_USERS.find(u => u.email === email) ?? null;
  const { data, error } = await getClient()
    .from("users")
    .select("*")
    .eq("email", email)
    .single();
  if (error || !data) return null;
  return {
    email:         data.email as string,
    name:          data.name as string,
    createdAt:     data.created_at as string,
    supportedTeam: (data.supported_team as string | null) ?? null,
  };
}

export async function upsertUser(user: User): Promise<void> {
  if (isMock) return;
  // ignoreDuplicates: true — only inserts new users; never overwrites a custom display name
  const { error } = await getClient()
    .from("users")
    .upsert({ email: user.email, name: user.name, created_at: user.createdAt },
             { onConflict: "email", ignoreDuplicates: true });
  if (error) throw error;
}

export async function setUserDisplayName(email: string, name: string): Promise<void> {
  if (isMock) return;
  const { error } = await getClient()
    .from("users")
    .update({ name })
    .eq("email", email);
  if (error) throw error;
}

export async function setUserSupportedTeam(email: string, team: string | null): Promise<void> {
  if (isMock) return;
  const { error } = await getClient()
    .from("users")
    .update({ supported_team: team })
    .eq("email", email);
  if (error) throw error;
}

// ── Odds ───────────────────────────────────────────────────────────────────

export async function getAllOdds(): Promise<OddsData[]> {
  if (isMock) return MOCK_ODDS;
  const { data, error } = await getClient().from("odds").select("*");
  if (error) throw error;
  return (data ?? []).map(r => ({
    matchId:   r.match_id as string,
    homeOdds:  r.home_odds as number | null,
    drawOdds:  r.draw_odds as number | null,
    awayOdds:  r.away_odds as number | null,
    homeProb:  r.home_prob as number | null,
    drawProb:  r.draw_prob as number | null,
    awayProb:  r.away_prob as number | null,
    updatedAt: r.updated_at as string,
  }));
}

export async function upsertOdds(odds: OddsData[]): Promise<void> {
  if (isMock || odds.length === 0) return;
  const rows = odds.map(o => ({
    match_id:   o.matchId,
    home_odds:  o.homeOdds,
    draw_odds:  o.drawOdds,
    away_odds:  o.awayOdds,
    home_prob:  o.homeProb,
    draw_prob:  o.drawProb,
    away_prob:  o.awayProb,
    updated_at: o.updatedAt,
  }));
  const { error } = await getClient()
    .from("odds")
    .upsert(rows, { onConflict: "match_id" });
  if (error) throw error;
}

// ── Deadline-reminder dedup ──────────────────────────────────────────────────
// Tracks which rounds we've already sent a 24h reminder for, so a second sync
// run on the same day doesn't double-email. Defensive: if the round_reminders
// table hasn't been migrated yet, these degrade to no-ops (the once-daily cron
// provides natural dedup on its own).

export async function getRemindedRounds(): Promise<Set<string>> {
  if (isMock) return new Set();
  const { data, error } = await getClient().from("round_reminders").select("round");
  if (error) return new Set(); // table missing or unreadable — fall back to no dedup
  return new Set((data ?? []).map(r => r.round as string));
}

export async function markRoundReminded(round: string): Promise<void> {
  if (isMock) return;
  try {
    await getClient()
      .from("round_reminders")
      .upsert({ round, sent_at: new Date().toISOString() }, { onConflict: "round" });
  } catch {
    // table missing — ignore; relying on daily cron for dedup
  }
}

// ── Admin stats ────────────────────────────────────────────────────────────

export async function getAdminStats(): Promise<{ totalLeagues: number; totalUsers: number }> {
  if (isMock) return { totalLeagues: 1, totalUsers: 3 };
  const client = getClient();

  const [leaguesRes, usersRes] = await Promise.all([
    client.from("leagues").select("id", { count: "exact", head: true }),
    client.from("users").select("email", { count: "exact", head: true }),
  ]);

  return {
    totalLeagues: leaguesRes.count ?? 0,
    totalUsers:   usersRes.count   ?? 0,
  };
}

// ── Sync log ───────────────────────────────────────────────────────────────

export async function logSync(entry: {
  syncedAt: string;
  matchesUpdated: number;
  roundsOpened: string;
  emailsSent: number;
  error: string;
}): Promise<void> {
  if (isMock) return;
  const { error } = await getClient().from("sync_log").insert({
    synced_at:        entry.syncedAt,
    matches_updated:  entry.matchesUpdated,
    rounds_opened:    entry.roundsOpened,
    emails_sent:      entry.emailsSent,
    error:            entry.error,
  });
  if (error) throw error;
}

export async function getLastSync(): Promise<{ syncedAt: string; matchesUpdated: number; error: string } | null> {
  if (isMock) return { syncedAt: new Date().toISOString(), matchesUpdated: 12, error: "" };
  const { data, error } = await getClient()
    .from("sync_log")
    .select("*")
    .order("synced_at", { ascending: false })
    .limit(1)
    .single();
  if (error || !data) return null;
  return {
    syncedAt:       data.synced_at as string,
    matchesUpdated: data.matches_updated as number,
    error:          data.error as string,
  };
}
