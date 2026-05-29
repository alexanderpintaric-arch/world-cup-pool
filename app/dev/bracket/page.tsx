/**
 * DEV PREVIEW — knockout bracket sandbox. No auth, mock data, dev-only.
 * Lets you click through the whole bracket (Round of 32 → Final): pick winners,
 * watch them propagate, set your champion. Picks are NOT persisted (local state
 * only) — this is purely to exercise the UI.
 *
 * Visit /dev/bracket while running `npm run dev`.
 */
import { notFound } from "next/navigation";
import type { Match, OddsData } from "@/lib/types";
import BracketBoard from "@/app/picks/BracketBoard";

function daysFromNow(d: number, h = 15): string {
  const t = new Date();
  t.setDate(t.getDate() + d);
  t.setHours(h, 0, 0, 0);
  return t.toISOString();
}

// 16 made-up Round-of-32 matchups (32 teams). Kickoffs are in the future so the
// bracket reads as OPEN (editable) rather than locked.
const R32_PAIRS: [string, string][] = [
  ["Brazil", "South Korea"],
  ["France", "Senegal"],
  ["Argentina", "Australia"],
  ["England", "Switzerland"],
  ["Spain", "Japan"],
  ["Portugal", "Morocco"],
  ["Netherlands", "Ecuador"],
  ["Germany", "Mexico"],
  ["Belgium", "Canada"],
  ["Croatia", "Nigeria"],
  ["Uruguay", "Ghana"],
  ["Italy", "Norway"],
  ["Colombia", "Egypt"],
  ["Denmark", "Poland"],
  ["USA", "Qatar"],
  ["Sweden", "Peru"],
];

const MOCK_MATCHES: Match[] = R32_PAIRS.map(([home, away], i) => ({
  matchId:     `d${i + 1}`,
  round:       "ROUND_OF_32",
  homeTeam:    home,
  awayTeam:    away,
  result:      null,
  status:      "SCHEDULED",
  kickoffUtc:  daysFromNow(20 + Math.floor(i / 4), 12 + (i % 4) * 2),
  pointsValue: 2,
  homeScore:   null,
  awayScore:   null,
}));

// Simple favourite-leaning odds so the R32 cards show percentages.
const MOCK_ODDS: OddsData[] = MOCK_MATCHES.map((m, i) => {
  const homeProb = 70 - (i % 5) * 7; // 70,63,56,49,42 cycling
  const awayProb = 100 - homeProb - 0;
  return {
    matchId:   m.matchId,
    homeOdds:  +(100 / homeProb).toFixed(2),
    drawOdds:  null,
    awayOdds:  +(100 / awayProb).toFixed(2),
    homeProb,
    drawProb:  null,
    awayProb,
    updatedAt: new Date().toISOString(),
  };
});

export default async function DevBracketPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV !== "development") notFound();

  // ?preview → no real teams yet, so the board shows the official seed slots
  // (1E, 3A/B/C/D/F, …) read-only, exactly as it looks before the group stage.
  const preview = (await searchParams)?.preview !== undefined;

  return (
    <div className="space-y-6">
      <div className="px-3 py-2 rounded-md bg-gold/10 border border-gold/30 text-[12px] font-mono text-gold/80 inline-block">
        ⚡ DEV PREVIEW — bracket sandbox (mock data, not saved)
      </div>

      <header>
        <h1 className="font-serif font-medium tracking-[-0.02em] ink" style={{ fontSize: "clamp(2rem, 5vw, 3rem)" }}>
          Bracket <span className="italic text-accent">sandbox.</span>
        </h1>
        <p className="mt-2 text-[15px] ink-soft max-w-xl">
          Click a team to advance them. Winners flow into the next round automatically;
          change an early pick and the downstream slots that depended on it reset.
        </p>
        <div className="mt-3 flex gap-2 font-mono text-[12px]">
          <a href="/dev/bracket" className={`px-3 py-1.5 rounded-md border ${!preview ? "bg-ink text-paper border-ink" : "border-line ink-soft hover:ink"}`}>
            Determined
          </a>
          <a href="/dev/bracket?preview" className={`px-3 py-1.5 rounded-md border ${preview ? "bg-ink text-paper border-ink" : "border-line ink-soft hover:ink"}`}>
            Pre-draw preview
          </a>
        </div>
      </header>

      <BracketBoard
        matches={preview ? [] : MOCK_MATCHES}
        odds={preview ? [] : MOCK_ODDS}
        userBracketPicks={[]}
        available={!preview}
        locked={false}
        deadline={daysFromNow(20, 12)}
        sandbox
      />
    </div>
  );
}
