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
    match_id:    m.matchId,
    round:       m.round,
    home_team:   m.homeTeam,
    away_team:   m.awayTeam,
    result:      m.result,
    status:      m.status,
    kickoff_utc: m.kickoffUtc,
    home_score:  m.homeScore,
    away_score:  m.awayScore,
    updated_at:  new Date().toISOString(),
  }));

  const { error } = await getClient()
    .from("matches")
    .upsert(rows, { onConflict: "match_id", ignoreDuplicates: false });

  if (error) throw error;
  return matches.length;
}

// ── Picks ──────────────────────────────────────────────────────────────────

export async function getPicksForUser(email: string): Promise<Pick[]> {
  if (isMock) return MOCK_PICKS.filter(p => p.email === "alex@example.com");
  const { data, error } = await getClient()
    .from("picks")
    .select("*")
    .eq("email", email);
  if (error) throw error;
  return (data ?? []).map(rowToPick);
}

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
    submittedAt: (r.submitted_at ?? new Date().toISOString()) as string,
    updatedAt:   (r.updated_at ?? r.submitted_at ?? new Date().toISOString()) as string,
  };
}

export async function upsertPicksBatch(picks: Pick[]): Promise<void> {
  if (isMock || picks.length === 0) return;
  const rows = picks.map(p => ({
    email:        p.email,
    match_id:     p.matchId,
    pick:         p.pick,
    submitted_at: new Date().toISOString(),
  }));
  const { error } = await getClient()
    .from("picks")
    .upsert(rows, { onConflict: "email,match_id" });
  if (error) throw error;
}

// ── Users ──────────────────────────────────────────────────────────────────

export async function getAllUsers(): Promise<User[]> {
  if (isMock) return MOCK_USERS;
  const { data, error } = await getClient().from("users").select("*");
  if (error) throw error;
  return (data ?? []).map(r => ({
    email:     r.email as string,
    name:      r.name as string,
    createdAt: r.created_at as string,
  }));
}

export async function upsertUser(user: User): Promise<void> {
  if (isMock) return;
  const { error } = await getClient()
    .from("users")
    .upsert({ email: user.email, name: user.name, created_at: user.createdAt },
             { onConflict: "email" });
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
