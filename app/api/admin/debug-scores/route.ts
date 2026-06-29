export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getAllMatches } from "@/lib/services/supabase";
import { fetchWCScoresFromEspn } from "@/lib/services/espn";

// TEMPORARY diagnostic endpoint — traces why a finished game isn't settling.
// Gated by a throwaway token (match/score data is public, but this keeps casual
// hits out). Remove once the score-settlement issue is diagnosed.
const TOKEN = "espn-trace-9f3a";

const ESPN = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard";

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get("key") !== TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  const WINDOW = 3 * 24 * 60 * 60 * 1000;

  const matches = await getAllMatches();

  // The fixture(s) the user is asking about + how the pending gate sees them.
  const interesting = matches
    .filter(m => /canada|south africa/i.test(`${m.homeTeam} ${m.awayTeam}`))
    .map(m => {
      const k = new Date(m.kickoffUtc).getTime();
      const pending =
        m.result == null && m.homeTeam !== "TBD" && m.awayTeam !== "TBD" &&
        k <= now && now - k <= WINDOW;
      return {
        matchId: m.matchId, round: m.round, status: m.status, result: m.result,
        homeTeam: m.homeTeam, awayTeam: m.awayTeam,
        homeScore: m.homeScore, awayScore: m.awayScore,
        kickoffUtc: m.kickoffUtc, hoursSinceKickoff: Math.round((now - k) / 36e5),
        pendingForFallback: pending,
      };
    });

  // Raw ESPN scoreboard for the day(s) around those fixtures.
  const days = new Set<string>();
  for (const m of matches.filter(m => /canada|south africa/i.test(`${m.homeTeam} ${m.awayTeam}`))) {
    const t = new Date(m.kickoffUtc).getTime();
    days.add(new Date(t).toISOString().slice(0, 10).replace(/-/g, ""));
    days.add(new Date(t + 864e5).toISOString().slice(0, 10).replace(/-/g, ""));
    days.add(new Date(t - 864e5).toISOString().slice(0, 10).replace(/-/g, ""));
  }

  const espnByDay: Record<string, unknown> = {};
  for (const day of days) {
    try {
      const res = await fetch(`${ESPN}?dates=${day}`, { next: { revalidate: 0 } });
      if (!res.ok) { espnByDay[day] = { httpStatus: res.status }; continue; }
      const board = await res.json();
      espnByDay[day] = {
        httpStatus: 200,
        eventCount: (board.events ?? []).length,
        events: (board.events ?? []).map((e: any) => ({
          name: e.name,
          date: e.date,
          completed: e.competitions?.[0]?.status?.type?.completed,
          statusName: e.competitions?.[0]?.status?.type?.name,
          competitors: (e.competitions?.[0]?.competitors ?? []).map((c: any) => ({
            team: c.team?.displayName, homeAway: c.homeAway,
            score: c.score, winner: c.winner, shootoutScore: c.shootoutScore,
          })),
        })),
      };
    } catch (e) {
      espnByDay[day] = { error: e instanceof Error ? e.message : String(e) };
    }
  }

  // What our ESPN settlement function actually produces for these fixtures.
  let espnUpdates: unknown;
  try {
    const pending = matches.filter(m => {
      const k = new Date(m.kickoffUtc).getTime();
      return m.result == null && m.homeTeam !== "TBD" && m.awayTeam !== "TBD" &&
        k <= now && now - k <= WINDOW;
    });
    espnUpdates = { pendingCount: pending.length, updates: await fetchWCScoresFromEspn(pending) };
  } catch (e) {
    espnUpdates = { error: e instanceof Error ? e.message : String(e) };
  }

  return NextResponse.json({ now: new Date(now).toISOString(), interesting, espnUpdates, espnByDay });
}
