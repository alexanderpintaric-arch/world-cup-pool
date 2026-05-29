export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import {
  getBracketPicks, replaceBracketPicks, getAllMatches, getAllOdds,
} from "@/lib/services/supabase";
import { getUserLeagues } from "@/lib/services/leagues";
import { getRoundStates } from "@/lib/services/scoring";
import {
  BRACKET_NODE_MAP, KNOCKOUT_ROUNDS, nodesInRound, orderedR32Matches,
  sanitizeBracket,
} from "@/lib/services/bracket";
import type { BracketPick } from "@/lib/types";

const LEAGUE_COOKIE = "wcp_league";
const COOKIE_OPTS = {
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
  httpOnly: true,
  sameSite: "lax" as const,
};

async function resolveActiveLeagueId(email: string): Promise<string | null> {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(LEAGUE_COOKIE)?.value;

  const leagues = await getUserLeagues(email);
  if (leagues.length === 0) return null;
  if (fromCookie && leagues.some(l => l.id === fromCookie)) return fromCookie;

  const fallback = leagues[0].id;
  cookieStore.set(LEAGUE_COOKIE, fallback, COOKIE_OPTS);
  return fallback;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const leagueId = await resolveActiveLeagueId(session.user.email);
  if (!leagueId) {
    return NextResponse.json({ error: "No active league" }, { status: 400 });
  }
  const picks = await getBracketPicks(session.user.email, leagueId);
  return NextResponse.json(picks);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const email = session.user.email;

  const leagueId = await resolveActiveLeagueId(email);
  if (!leagueId) {
    return NextResponse.json({ error: "No active league — please join or create a league first" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const incoming: Record<string, string | null | undefined> = body?.bracket ?? {};
  if (typeof incoming !== "object" || incoming === null) {
    return NextResponse.json({ error: "Invalid bracket payload" }, { status: 400 });
  }

  const [allMatches, allOdds] = await Promise.all([getAllMatches(), getAllOdds()]);

  // ── Availability: the bracket opens once the group stage is complete ──────
  const roundStates = getRoundStates(allMatches);
  const r32State = roundStates.find(r => r.round === "ROUND_OF_32");
  if (!r32State?.isAvailable) {
    return NextResponse.json({ error: "The bracket opens once the group stage is complete." }, { status: 400 });
  }

  // ── Lock: whole bracket locks at the first R32 kickoff ───────────────────
  const r32Slots = orderedR32Matches(allMatches);
  const r32Kickoffs = r32Slots
    .filter((m): m is NonNullable<typeof m> => !!m)
    .map(m => new Date(m.kickoffUtc).getTime());
  const firstKickoff = r32Kickoffs.length > 0 ? Math.min(...r32Kickoffs) : null;
  if (firstKickoff !== null && Date.now() >= firstKickoff) {
    return NextResponse.json({ error: "The bracket is locked — the Round of 32 has begun." }, { status: 400 });
  }

  // ── Sanitize: keep only internally-consistent picks (leaves → root) ──────
  const raw: Record<string, string | undefined> = {};
  for (const [nodeId, team] of Object.entries(incoming)) {
    if (!BRACKET_NODE_MAP.has(nodeId)) continue;
    if (typeof team === "string" && team.length > 0) raw[nodeId] = team;
  }
  const clean = sanitizeBracket(raw, r32Slots);

  // ── Snapshot R32 odds for the picked team ────────────────────────────────
  const oddsMap = new Map(allOdds.map(o => [o.matchId, o]));
  const now = new Date().toISOString();

  const picks: BracketPick[] = [];
  for (const round of KNOCKOUT_ROUNDS) {
    for (const node of nodesInRound(round)) {
      const team = clean[node.id];
      if (!team) continue;

      let odds: number | null = null;
      if (round === "ROUND_OF_32") {
        const m = r32Slots[node.matchSlot ?? -1] ?? null;
        const o = m ? oddsMap.get(m.matchId) : undefined;
        if (m && o) odds = team === m.homeTeam ? (o.homeOdds ?? null) : (o.awayOdds ?? null);
      }

      picks.push({
        email, leagueId, nodeId: node.id, round, team,
        odds, submittedAt: now, updatedAt: now,
      });
    }
  }

  try {
    await replaceBracketPicks(email, leagueId, picks);
  } catch (e) {
    const msg = e instanceof Error ? e.message : ((e as { message?: string })?.message ?? JSON.stringify(e));
    console.error("bracket save error:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // Echo back the cleaned bracket so the client can reconcile any dropped picks.
  return NextResponse.json({ saved: picks.length, bracket: clean });
}
