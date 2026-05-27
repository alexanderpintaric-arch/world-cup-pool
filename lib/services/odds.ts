import type { OddsData } from "../types";

const BASE = "https://api.the-odds-api.com/v4";

interface OddsApiOutcome {
  name: string;
  price: number;
}

interface OddsApiBookmaker {
  markets: { key: string; outcomes: OddsApiOutcome[] }[];
}

interface OddsApiGame {
  id: string;
  home_team: string;
  away_team: string;
  bookmakers: OddsApiBookmaker[];
}

function decimalToProb(decimal: number): number {
  return Math.round((1 / decimal) * 100 * 10) / 10;
}

// Normalize probabilities so they sum to 100 (remove the bookmaker margin)
function normalizeProbs(h: number, d: number | null, a: number): [number, number | null, number] {
  const total = h + (d ?? 0) + a;
  if (total === 0) return [h, d, a];
  const norm = (v: number) => Math.round((v / total) * 100 * 10) / 10;
  return [norm(h), d !== null ? norm(d) : null, norm(a)];
}

export async function fetchWCOdds(): Promise<OddsData[]> {
  const params = new URLSearchParams({
    apiKey: process.env.ODDS_API_KEY!,
    regions: "eu",
    markets: "h2h",
    oddsFormat: "decimal",
  });

  const res = await fetch(`${BASE}/sports/soccer_fifa_world_cup/odds?${params}`, {
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    // Non-fatal — odds are supplementary
    console.error(`Odds API error ${res.status}`);
    return [];
  }

  const games: OddsApiGame[] = await res.json();
  const now = new Date().toISOString();

  return games.map((g): OddsData => {
    // Average across bookmakers
    let homeSum = 0, drawSum = 0, awaySum = 0, count = 0;

    for (const bm of g.bookmakers) {
      const h2h = bm.markets.find(m => m.key === "h2h");
      if (!h2h) continue;
      const home = h2h.outcomes.find(o => o.name === g.home_team)?.price ?? 0;
      const away = h2h.outcomes.find(o => o.name === g.away_team)?.price ?? 0;
      const draw = h2h.outcomes.find(o => o.name === "Draw")?.price ?? 0;
      if (home && away) {
        homeSum += home;
        drawSum += draw;
        awaySum += away;
        count++;
      }
    }

    if (count === 0) {
      return { matchId: g.id, homeOdds: null, drawOdds: null, awayOdds: null,
               homeProb: null, drawProb: null, awayProb: null, updatedAt: now };
    }

    const homeOdds = Math.round((homeSum / count) * 100) / 100;
    const drawOdds = drawSum > 0 ? Math.round((drawSum / count) * 100) / 100 : null;
    const awayOdds = Math.round((awaySum / count) * 100) / 100;

    const rawHome = decimalToProb(homeOdds);
    const rawDraw = drawOdds ? decimalToProb(drawOdds) : null;
    const rawAway = decimalToProb(awayOdds);

    const [homeProb, drawProb, awayProb] = normalizeProbs(rawHome, rawDraw, rawAway);

    return { matchId: g.id, homeOdds, drawOdds, awayOdds, homeProb, drawProb, awayProb, updatedAt: now };
  });
}
