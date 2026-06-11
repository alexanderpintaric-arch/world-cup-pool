/**
 * DEV PREVIEW — no auth required, mock data only.
 * Only accessible in development (returns 404 in production).
 * Mirrors /community: one live match (names revealed), one upcoming (locked).
 */
import { notFound } from "next/navigation";
import CommunityClient from "@/app/community/CommunityClient";
import { getRoundStates, getActiveRound } from "@/lib/services/scoring";
import type { Match } from "@/lib/types";

const ME = "alexanderpintaric@gmail.com";

const FIRST_NAMES = [
  "Gary", "Marco", "Ravi", "Jo", "Felipe", "Mona", "Sven", "Dmitri", "Maya",
  "Uma", "Jorge", "Gus", "Mateo", "Marie", "Liam", "Nadia", "Omar", "Petra",
  "Quinn", "Rosa", "Sam", "Tariq", "Vera", "Wes", "Ximena", "Yusuf",
];
const POOL = FIRST_NAMES.map((first, i) => ({
  name: `${first} ${"Lineker Polo Shastri Bloggs Dias Osman Goran Rusk Marin Chen Alva Gali Vidal Curie Otis Petrov Aziz Kovac Reyes Diaz Iqbal Hadid Volk Webb Cruz Riad".split(" ")[i]}`,
  email: `user${i}@example.com`,
}));

function hoursFromNow(h: number): string {
  return new Date(Date.now() + h * 3600_000).toISOString();
}

const MOCK_MATCHES: Match[] = [
  {
    matchId: "dev-live-1",
    round: "GROUP",
    homeTeam: "Mexico",
    awayTeam: "South Africa",
    result: null,
    // Status intentionally stale (SCHEDULED) with kickoff in the past — the
    // reveal must key off kickoff time, not synced status.
    status: "SCHEDULED",
    kickoffUtc: hoursFromNow(-1),
    pointsValue: 2,
    homeScore: null,
    awayScore: null,
  },
  {
    matchId: "dev-upcoming-1",
    round: "GROUP",
    homeTeam: "Canada",
    awayTeam: "Qatar",
    result: null,
    status: "SCHEDULED",
    kickoffUtc: hoursFromNow(6),
    pointsValue: 2,
    homeScore: null,
    awayScore: null,
  },
];

// 27 on Mexico (me + 26), 1 on Draw — matches the real opening-game split.
const mexicoPickers = [{ name: "Alexander Pintaric", email: ME }, ...POOL.slice(0, 25)];
const drawPickers   = [POOL[25]];

const counts = {
  "dev-live-1":     { H: mexicoPickers.length, A: 0, T: drawPickers.length, total: mexicoPickers.length + drawPickers.length },
  "dev-upcoming-1": { H: 5, A: 9, T: 3, total: 17 },
};

// Named picks exist only for the kicked-off match, like the real page.
const named = {
  "dev-live-1": { H: mexicoPickers, A: [], T: drawPickers },
};

export default function DevCommunityPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  const roundStates = getRoundStates(MOCK_MATCHES);

  return (
    <div>
      <div className="mb-6 px-3 py-2 rounded-md bg-gold/10 border border-gold/30 text-[12px] font-mono text-gold/80 inline-block">
        ⚡ DEV PREVIEW — mock data, no auth
      </div>
      <CommunityClient
        matches={MOCK_MATCHES}
        roundStates={roundStates}
        activeRound={getActiveRound(roundStates)}
        counts={counts}
        named={named}
        myPicks={{ "dev-live-1": "H", "dev-upcoming-1": "A" }}
        userEmail={ME}
        bracketCounts={{}}
        bracketNamed={{}}
        myBracket={{}}
        bracketLocked={false}
      />
    </div>
  );
}
