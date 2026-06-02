import { createClient } from "@supabase/supabase-js";
import type { League, LeagueWithRole } from "../types";

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Unambiguous uppercase chars for join codes (no 0/O, 1/I/L)
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateCode(): string {
  return Array.from({ length: 6 }, () =>
    CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  ).join("");
}

// ── Create ─────────────────────────────────────────────────────────────────

export async function createLeague(name: string, creatorEmail: string): Promise<League> {
  const client = getClient();

  // Find a unique code (collisions are extremely rare but handle them)
  let code = generateCode();
  for (let i = 0; i < 9; i++) {
    const { data } = await client.from("leagues").select("id").eq("code", code).maybeSingle();
    if (!data) break;
    code = generateCode();
  }

  const { data, error } = await client
    .from("leagues")
    .insert({ name, code, created_by: creatorEmail })
    .select()
    .single();
  if (error) throw error;

  const { error: mErr } = await client
    .from("league_members")
    .insert({ league_id: data.id, email: creatorEmail, role: "owner" });
  if (mErr) throw mErr;

  return rowToLeague(data);
}

// ── Join ───────────────────────────────────────────────────────────────────

export async function joinLeagueByCode(
  code: string,
  email: string
): Promise<{ success: boolean; league?: League; error?: string; alreadyMember?: boolean }> {
  const client = getClient();

  const { data: league, error } = await client
    .from("leagues")
    .select("*")
    .eq("code", code.toUpperCase().trim())
    .maybeSingle();

  if (error) throw error;
  if (!league) return { success: false, error: "No league found with that code. Check for typos." };

  // Already a member — just return success so they can switch to it
  const { data: existing } = await client
    .from("league_members")
    .select("email")
    .eq("league_id", league.id)
    .eq("email", email)
    .maybeSingle();

  if (existing) return { success: true, league: rowToLeague(league), alreadyMember: true };

  const { error: jErr } = await client
    .from("league_members")
    .insert({ league_id: league.id, email, role: "member" });
  if (jErr) throw jErr;

  return { success: true, league: rowToLeague(league), alreadyMember: false };
}

/** Every league with its member emails — used for per-league recap emails. */
export async function getAllLeaguesWithMembers(): Promise<{ id: string; name: string; memberEmails: string[] }[]> {
  const client = getClient();
  const [{ data: leagues, error: lErr }, { data: members, error: mErr }] = await Promise.all([
    client.from("leagues").select("id, name"),
    client.from("league_members").select("league_id, email"),
  ]);
  if (lErr) throw lErr;
  if (mErr) throw mErr;

  const byLeague = new Map<string, string[]>();
  for (const m of members ?? []) {
    const lid = m.league_id as string;
    if (!byLeague.has(lid)) byLeague.set(lid, []);
    byLeague.get(lid)!.push(m.email as string);
  }
  return (leagues ?? []).map(l => ({
    id: l.id as string,
    name: l.name as string,
    memberEmails: byLeague.get(l.id as string) ?? [],
  }));
}

/** Distinct emails of everyone who belongs to at least one league. */
export async function getAllMemberEmails(): Promise<Set<string>> {
  const { data, error } = await getClient()
    .from("league_members")
    .select("email");
  if (error) throw error;
  return new Set((data ?? []).map(r => r.email as string));
}

// ── Queries ────────────────────────────────────────────────────────────────

export async function getUserLeagues(email: string): Promise<LeagueWithRole[]> {
  const client = getClient();

  const { data: memberships, error: mErr } = await client
    .from("league_members")
    .select("league_id, role")
    .eq("email", email);
  if (mErr) throw mErr;
  if (!memberships || memberships.length === 0) return [];

  const leagueIds = memberships.map(m => m.league_id as string);

  const { data: leagues, error: lErr } = await client
    .from("leagues")
    .select("*")
    .in("id", leagueIds);
  if (lErr) throw lErr;

  // Fetch all member counts in a single query
  const { data: allMembers } = await client
    .from("league_members")
    .select("league_id")
    .in("league_id", leagueIds);

  const countMap: Record<string, number> = {};
  for (const m of allMembers ?? []) {
    const lid = m.league_id as string;
    countMap[lid] = (countMap[lid] ?? 0) + 1;
  }

  return (leagues ?? []).map(l => {
    const membership = memberships.find(m => m.league_id === l.id);
    return {
      ...rowToLeague(l),
      role: (membership?.role ?? "member") as LeagueWithRole["role"],
      memberCount: countMap[l.id as string] ?? 0,
    };
  });
}

export async function getLeagueMembers(
  leagueId: string
): Promise<{ email: string; role: string; joinedAt: string }[]> {
  const { data, error } = await getClient()
    .from("league_members")
    .select("email, role, joined_at")
    .eq("league_id", leagueId);
  if (error) throw error;
  return (data ?? []).map(r => ({
    email:    r.email    as string,
    role:     r.role     as string,
    joinedAt: r.joined_at as string,
  }));
}

// ── Helpers ────────────────────────────────────────────────────────────────

function rowToLeague(r: Record<string, unknown>): League {
  return {
    id:        r.id         as string,
    name:      r.name       as string,
    code:      r.code       as string,
    createdBy: r.created_by as string,
    createdAt: r.created_at as string,
    buyIn:     (r.buy_in as number) ?? 0,
  };
}

// ── Buy-in ─────────────────────────────────────────────────────────────────

export async function setLeagueBuyIn(
  leagueId: string,
  callerEmail: string,
  amount: number
): Promise<void> {
  const client = getClient();

  // Ownership check — only the owner may change the buy-in
  const { data: membership } = await client
    .from("league_members")
    .select("role")
    .eq("league_id", leagueId)
    .eq("email", callerEmail)
    .maybeSingle();

  if (membership?.role !== "owner") {
    throw new Error("Only the league owner can set the buy-in.");
  }

  const { error } = await client
    .from("leagues")
    .update({ buy_in: Math.max(0, Math.floor(amount)) })
    .eq("id", leagueId);

  if (error) throw error;
}
