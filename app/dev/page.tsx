/**
 * DEV PREVIEW — no auth required, mock data only.
 * Only accessible in development (returns 404 in production).
 */
import { notFound } from "next/navigation";
import LeaderboardClient from "@/app/LeaderboardClient";
import type { Match, LeaderboardEntry, RoundState, OddsData } from "@/lib/types";

export default function DevPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <div>
      <div className="mb-6 px-3 py-2 rounded-md bg-gold/10 border border-gold/30 text-[12px] font-mono text-gold/80 inline-block">
        ⚡ DEV PREVIEW — mock data, no auth
      </div>
      <LeaderboardClient
        leaderboard={MOCK_LEADERBOARD}
        matches={MOCK_MATCHES}
        roundStates={MOCK_ROUND_STATES}
        activeRound={MOCK_ROUND_STATES[0]}
        popularPicks={MOCK_POPULAR_PICKS}
        odds={[]}
        currentUserEmail="alexanderpintaric@gmail.com"
        currentUserName="Alexander Pintaric"
        activeLeague={{ id: "dev-league", name: "The Lads 2026", code: "LADS26", memberCount: 8, buyIn: 25, isOwner: true }}
      />
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function daysAgo(d: number, h = 0): string {
  const t = new Date();
  t.setDate(t.getDate() - d);
  t.setHours(h, 0, 0, 0);
  return t.toISOString();
}
function daysFromNow(d: number, h = 15): string {
  const t = new Date();
  t.setDate(t.getDate() + d);
  t.setHours(h, 0, 0, 0);
  return t.toISOString();
}

// ── Mock matches ─────────────────────────────────────────────────────────────

const MOCK_MATCHES: Match[] = [
  // ── Finished ───────────────────────────────────────────────────────────────
  {
    matchId: "m1",  round: "GROUP", homeTeam: "Brazil",    awayTeam: "Mexico",
    result: "H",  status: "FINISHED", kickoffUtc: daysAgo(2, 14),
    pointsValue: 1, homeScore: 3, awayScore: 1,
  },
  {
    matchId: "m2",  round: "GROUP", homeTeam: "Germany",   awayTeam: "Japan",
    result: "T",  status: "FINISHED", kickoffUtc: daysAgo(2, 17),
    pointsValue: 1, homeScore: 2, awayScore: 2,
  },
  {
    matchId: "m3",  round: "GROUP", homeTeam: "France",    awayTeam: "Argentina",
    result: "A",  status: "FINISHED", kickoffUtc: daysAgo(1, 14),
    pointsValue: 1, homeScore: 0, awayScore: 2,
  },
  {
    matchId: "m4",  round: "GROUP", homeTeam: "Spain",     awayTeam: "Portugal",
    result: "H",  status: "FINISHED", kickoffUtc: daysAgo(1, 17),
    pointsValue: 1, homeScore: 1, awayScore: 0,
  },
  {
    matchId: "m5",  round: "GROUP", homeTeam: "England",   awayTeam: "USA",
    result: "T",  status: "FINISHED", kickoffUtc: daysAgo(0, 10),
    pointsValue: 1, homeScore: 1, awayScore: 1,
  },

  // ── Live ────────────────────────────────────────────────────────────────────
  {
    matchId: "m6",  round: "GROUP", homeTeam: "Netherlands", awayTeam: "Senegal",
    result: null, status: "IN_PLAY", kickoffUtc: daysAgo(0, 14),
    pointsValue: 1, homeScore: 2, awayScore: 0,
  },
  {
    matchId: "m7",  round: "GROUP", homeTeam: "Morocco",   awayTeam: "Croatia",
    result: null, status: "IN_PLAY", kickoffUtc: daysAgo(0, 14),
    pointsValue: 1, homeScore: 0, awayScore: 1,
  },

  // ── Upcoming ────────────────────────────────────────────────────────────────
  {
    matchId: "m8",  round: "GROUP", homeTeam: "Canada",    awayTeam: "Belgium",
    result: null, status: "SCHEDULED", kickoffUtc: daysFromNow(1, 14),
    pointsValue: 1, homeScore: null, awayScore: null,
  },
  {
    matchId: "m9",  round: "GROUP", homeTeam: "Uruguay",   awayTeam: "South Korea",
    result: null, status: "SCHEDULED", kickoffUtc: daysFromNow(1, 17),
    pointsValue: 1, homeScore: null, awayScore: null,
  },
  {
    matchId: "m10", round: "GROUP", homeTeam: "Italy",     awayTeam: "Colombia",
    result: null, status: "SCHEDULED", kickoffUtc: daysFromNow(2, 12),
    pointsValue: 1, homeScore: null, awayScore: null,
  },
  {
    matchId: "m11", round: "GROUP", homeTeam: "Australia", awayTeam: "Ecuador",
    result: null, status: "SCHEDULED", kickoffUtc: daysFromNow(2, 15),
    pointsValue: 1, homeScore: null, awayScore: null,
  },
  {
    matchId: "m12", round: "GROUP", homeTeam: "Nigeria",   awayTeam: "Switzerland",
    result: null, status: "SCHEDULED", kickoffUtc: daysFromNow(3, 14),
    pointsValue: 1, homeScore: null, awayScore: null,
  },

  // ── Knockout (not yet open) ──────────────────────────────────────────────────
  {
    matchId: "k1",  round: "ROUND_OF_32", homeTeam: "TBD", awayTeam: "TBD",
    result: null, status: "SCHEDULED", kickoffUtc: daysFromNow(20, 14),
    pointsValue: 2, homeScore: null, awayScore: null,
  },
  {
    matchId: "k2",  round: "ROUND_OF_16", homeTeam: "TBD", awayTeam: "TBD",
    result: null, status: "SCHEDULED", kickoffUtc: daysFromNow(28, 14),
    pointsValue: 3, homeScore: null, awayScore: null,
  },
  {
    matchId: "k3",  round: "QUARTER_FINALS", homeTeam: "TBD", awayTeam: "TBD",
    result: null, status: "SCHEDULED", kickoffUtc: daysFromNow(33, 14),
    pointsValue: 4, homeScore: null, awayScore: null,
  },
  {
    matchId: "k4",  round: "SEMI_FINALS", homeTeam: "TBD", awayTeam: "TBD",
    result: null, status: "SCHEDULED", kickoffUtc: daysFromNow(37, 14),
    pointsValue: 5, homeScore: null, awayScore: null,
  },
  {
    matchId: "k5",  round: "FINAL", homeTeam: "TBD", awayTeam: "TBD",
    result: null, status: "SCHEDULED", kickoffUtc: daysFromNow(39, 15),
    pointsValue: 6, homeScore: null, awayScore: null,
  },
];

// ── Mock leaderboard ─────────────────────────────────────────────────────────

const MOCK_LEADERBOARD: LeaderboardEntry[] = [
  {
    email: "alexanderpintaric@gmail.com", name: "Alexander Pintaric",
    totalScore: 7, maxPossibleScore: 72, correctPicks: 4, totalPicks: 5,
    scoreByRound: { GROUP: 7, ROUND_OF_32: 0, ROUND_OF_16: 0, QUARTER_FINALS: 0, SEMI_FINALS: 0, FINAL: 0 },
  },
  {
    email: "sarah@example.com", name: "Sarah Chen",
    totalScore: 6, maxPossibleScore: 72, correctPicks: 3, totalPicks: 5,
    scoreByRound: { GROUP: 6, ROUND_OF_32: 0, ROUND_OF_16: 0, QUARTER_FINALS: 0, SEMI_FINALS: 0, FINAL: 0 },
  },
  {
    email: "mike@example.com", name: "Mike Torres",
    totalScore: 5, maxPossibleScore: 72, correctPicks: 4, totalPicks: 5,
    scoreByRound: { GROUP: 5, ROUND_OF_32: 0, ROUND_OF_16: 0, QUARTER_FINALS: 0, SEMI_FINALS: 0, FINAL: 0 },
  },
  {
    email: "jana@example.com", name: "Jana Novak",
    totalScore: 4, maxPossibleScore: 72, correctPicks: 3, totalPicks: 5,
    scoreByRound: { GROUP: 4, ROUND_OF_32: 0, ROUND_OF_16: 0, QUARTER_FINALS: 0, SEMI_FINALS: 0, FINAL: 0 },
  },
  {
    email: "liam@example.com", name: "Liam Walsh",
    totalScore: 4, maxPossibleScore: 72, correctPicks: 3, totalPicks: 5,
    scoreByRound: { GROUP: 4, ROUND_OF_32: 0, ROUND_OF_16: 0, QUARTER_FINALS: 0, SEMI_FINALS: 0, FINAL: 0 },
  },
  {
    email: "priya@example.com", name: "Priya Sharma",
    totalScore: 3, maxPossibleScore: 72, correctPicks: 2, totalPicks: 5,
    scoreByRound: { GROUP: 3, ROUND_OF_32: 0, ROUND_OF_16: 0, QUARTER_FINALS: 0, SEMI_FINALS: 0, FINAL: 0 },
  },
  {
    email: "tom@example.com", name: "Tom Eriksen",
    totalScore: 2, maxPossibleScore: 72, correctPicks: 2, totalPicks: 5,
    scoreByRound: { GROUP: 2, ROUND_OF_32: 0, ROUND_OF_16: 0, QUARTER_FINALS: 0, SEMI_FINALS: 0, FINAL: 0 },
  },
  {
    email: "cam@example.com", name: "Cameron Hill",
    totalScore: 1, maxPossibleScore: 72, correctPicks: 1, totalPicks: 5,
    scoreByRound: { GROUP: 1, ROUND_OF_32: 0, ROUND_OF_16: 0, QUARTER_FINALS: 0, SEMI_FINALS: 0, FINAL: 0 },
  },
];

// ── Mock round states ────────────────────────────────────────────────────────

const MOCK_ROUND_STATES: RoundState[] = [
  {
    round: "GROUP", label: "Group Stage", pointsValue: 1,
    isOpen: true, isAvailable: true, isComplete: false,
    deadline: daysAgo(2, 13),   // deadline already passed (first match kicked off)
    lastKickoff: daysFromNow(14, 17),
    matchCount: 13,
  },
  {
    round: "ROUND_OF_32", label: "Round of 32", pointsValue: 2,
    isOpen: false, isAvailable: false, isComplete: false,
    deadline: daysFromNow(20, 13),
    lastKickoff: daysFromNow(22, 17),
    matchCount: 1,
  },
  {
    round: "ROUND_OF_16", label: "Round of 16", pointsValue: 3,
    isOpen: false, isAvailable: false, isComplete: false,
    deadline: null, lastKickoff: null, matchCount: 1,
  },
  {
    round: "QUARTER_FINALS", label: "Quarterfinals", pointsValue: 4,
    isOpen: false, isAvailable: false, isComplete: false,
    deadline: null, lastKickoff: null, matchCount: 1,
  },
  {
    round: "SEMI_FINALS", label: "Semifinals", pointsValue: 5,
    isOpen: false, isAvailable: false, isComplete: false,
    deadline: null, lastKickoff: null, matchCount: 1,
  },
  {
    round: "FINAL", label: "Final", pointsValue: 6,
    isOpen: false, isAvailable: false, isComplete: false,
    deadline: null, lastKickoff: null, matchCount: 1,
  },
];

// ── Mock popular picks (8 pool members, 5 finished matches) ──────────────────
// Brazil 3–1 Mexico    (H won): 6 H, 1 A, 1 T
// Germany 2–2 Japan    (T won): 3 H, 2 A, 3 T
// France 0–2 Argentina (A won): 2 H, 4 A, 2 T
// Spain 1–0 Portugal   (H won): 5 H, 2 A, 1 T
// England 1–1 USA      (T won): 2 H, 1 A, 5 T

const MOCK_POPULAR_PICKS: Record<string, { H: number; A: number; T: number; total: number }> = {
  m1: { H: 6, A: 1, T: 1, total: 8 },   // Brazil won — 6/8 got it (75%)
  m2: { H: 3, A: 2, T: 3, total: 8 },   // Draw     — 3/8 got it (38%)
  m3: { H: 2, A: 4, T: 2, total: 8 },   // Argentina — 4/8 got it (50%)
  m4: { H: 5, A: 2, T: 1, total: 8 },   // Spain won — 5/8 got it (63%)
  m5: { H: 2, A: 1, T: 5, total: 8 },   // Draw     — 5/8 got it (63%)
  // Live matches — picks revealed
  m6: { H: 5, A: 2, T: 1, total: 8 },
  m7: { H: 2, A: 4, T: 2, total: 8 },
};
