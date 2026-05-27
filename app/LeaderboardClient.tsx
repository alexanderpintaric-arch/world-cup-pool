"use client";
import { useState } from "react";
import type { LeaderboardEntry, Match, RoundState } from "@/lib/types";
import { ROUND_CONFIG } from "@/lib/constants";

interface Props {
  leaderboard: LeaderboardEntry[];
  matches: Match[];
  roundStates: RoundState[];
  activeRound: RoundState | null;
  popularPicks: Record<string, { H: number; A: number; T: number; total: number }>;
  currentUserEmail: string | null;
}

function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

const AVATAR_COLORS = [
  "bg-green-800",
  "bg-stone-700",
  "bg-amber-700",
  "bg-rose-700",
  "bg-blue-700",
  "bg-violet-700",
];

const RANK_LABEL = ["1st", "2nd", "3rd"];

export default function LeaderboardClient({
  leaderboard, matches, roundStates, activeRound, currentUserEmail,
}: Props) {
  const [compareA, setCompareA] = useState<string | null>(null);
  const [compareB, setCompareB] = useState<string | null>(null);
  const [showCompare, setShowCompare] = useState(false);

  const liveMatches = matches.filter(m =>
    m.status === "IN_PLAY" || m.status === "PAUSED" || m.status === "LIVE"
  );
  const isSignedIn = !!currentUserEmail;
  const roundsWithMatches = roundStates.filter(r => r.matchCount > 0);

  function handleRowClick(email: string) {
    if (!compareA) { setCompareA(email); return; }
    if (email === compareA) { setCompareA(null); return; }
    setCompareB(email);
    setShowCompare(true);
  }

  const entryA = leaderboard.find(e => e.email === compareA);
  const entryB = leaderboard.find(e => e.email === compareB);

  return (
    <div className="space-y-6">

      {/* Live matches banner */}
      {liveMatches.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-2 text-xs font-bold text-amber-700 uppercase tracking-wide">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
            Live
          </span>
          <div className="h-3 w-px bg-amber-200" />
          {liveMatches.map(m => (
            <span key={m.matchId} className="text-sm text-stone-700">
              {m.homeTeam}{" "}
              <span className="font-mono font-bold tabular-nums text-stone-900">
                {m.homeScore ?? "–"}&thinsp;–&thinsp;{m.awayScore ?? "–"}
              </span>{" "}
              {m.awayTeam}
            </span>
          ))}
        </div>
      )}

      {/* Empty state / hero */}
      {leaderboard.length === 0 && (
        <div className="rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden">
          <div className="px-8 py-14 text-center">
            <p className="text-3xl mb-6">🏆</p>
            <h2 className="font-display text-3xl font-semibold text-stone-900 mb-3 tracking-tight">
              Pick Every Match
            </h2>
            <p className="text-stone-500 text-base mb-1 max-w-sm mx-auto">
              Predict all 64 World Cup 2026 games and climb the leaderboard.
            </p>
            <p className="text-stone-400 text-sm mb-8">
              Group stage opens June 11 · Results update automatically
            </p>
            {!isSignedIn ? (
              <a
                href="/api/auth/signin?callbackUrl=/picks"
                className="inline-flex items-center gap-2 bg-green-800 text-white font-semibold text-[15px] px-7 py-3 rounded-xl hover:bg-green-700 transition-colors shadow-sm"
              >
                Join the Pool
              </a>
            ) : (
              <a
                href="/picks"
                className="inline-flex items-center gap-2 bg-green-800 text-white font-semibold text-[15px] px-7 py-3 rounded-xl hover:bg-green-700 transition-colors shadow-sm"
              >
                Submit Your Picks
              </a>
            )}
          </div>
          <div className="border-t border-stone-100 px-8 py-5 grid grid-cols-3 divide-x divide-stone-100 text-center bg-stone-50">
            {[["64", "Matches"], ["6", "Rounds"], ["136", "Max pts"]].map(([val, label]) => (
              <div key={label} className="px-4">
                <div className="font-display text-2xl font-semibold text-stone-900">{val}</div>
                <div className="text-xs text-stone-400 uppercase tracking-widest mt-0.5 font-medium">{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active round CTA */}
      {activeRound && leaderboard.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse flex-shrink-0" />
              <p className="font-semibold text-stone-900 text-[15px]">{activeRound.label} picks open</p>
            </div>
            {activeRound.deadline && (
              <p className="text-xs text-stone-500 ml-3.5">
                Closes {new Date(activeRound.deadline).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" })}
              </p>
            )}
          </div>
          <a
            href="/picks"
            className="flex-shrink-0 rounded-lg bg-green-800 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors shadow-sm"
          >
            Submit Picks
          </a>
        </div>
      )}

      {/* Leaderboard */}
      {leaderboard.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-xl font-semibold text-stone-900">Standings</h2>
              <p className="text-stone-400 text-sm mt-0.5">
                {leaderboard.length} player{leaderboard.length !== 1 ? "s" : ""}
              </p>
            </div>
            {leaderboard.length > 1 && (
              <p className="text-stone-400 text-xs">
                {compareA ? "Select another to compare" : "Tap two rows to compare"}
              </p>
            )}
          </div>

          <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-100 bg-stone-50 text-left text-xs text-stone-400 uppercase tracking-wide">
                    <th className="px-4 py-3 w-12 font-medium">#</th>
                    <th className="px-4 py-3 font-medium">Player</th>
                    <th className="px-4 py-3 text-right font-medium">Score</th>
                    <th className="px-4 py-3 text-right font-medium hidden sm:table-cell">Max</th>
                    {(Object.keys(ROUND_CONFIG) as (keyof typeof ROUND_CONFIG)[]).map(r => (
                      <th key={r} className="px-2 py-3 text-right font-medium hidden md:table-cell">
                        {ROUND_CONFIG[r].label.split(" ")[0]}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-right font-medium hidden sm:table-cell">Correct</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {leaderboard.map((entry, i) => {
                    const isMe = entry.email === currentUserEmail;
                    const isSelected = entry.email === compareA || entry.email === compareB;
                    const avatarColor = AVATAR_COLORS[i % AVATAR_COLORS.length];

                    return (
                      <tr
                        key={entry.email}
                        onClick={() => handleRowClick(entry.email)}
                        className={`cursor-pointer transition-colors
                          ${isSelected ? "bg-amber-50" : ""}
                          ${isMe && !isSelected ? "bg-green-50/60" : ""}
                          ${!isMe && !isSelected ? "hover:bg-stone-50/80" : ""}
                        `}
                      >
                        <td className="px-4 py-3.5">
                          {i < 3 ? (
                            <span className="text-xs font-semibold text-stone-500">{RANK_LABEL[i]}</span>
                          ) : (
                            <span className="text-xs text-stone-300 font-medium tabular-nums">{i + 1}</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className={`h-7 w-7 rounded-full ${avatarColor} flex items-center justify-center text-white text-[11px] font-semibold flex-shrink-0`}>
                              {initials(entry.name)}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-stone-900">{entry.name}</span>
                              {isMe && (
                                <span className="text-[11px] font-medium text-green-700 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-md">
                                  you
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <span className="font-display font-semibold text-xl tabular-nums text-stone-900">
                            {entry.totalScore}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right text-stone-300 text-xs tabular-nums hidden sm:table-cell">
                          {entry.maxPossibleScore}
                        </td>
                        {(Object.keys(ROUND_CONFIG) as (keyof typeof ROUND_CONFIG)[]).map(r => (
                          <td key={r} className="px-2 py-3.5 text-right text-stone-400 text-xs tabular-nums hidden md:table-cell">
                            {entry.scoreByRound[r] ?? 0}
                          </td>
                        ))}
                        <td className="px-4 py-3.5 text-right hidden sm:table-cell">
                          <span className="text-xs font-medium text-stone-500 bg-stone-100 px-2 py-0.5 rounded-md tabular-nums">
                            {entry.correctPicks}/{entry.totalPicks}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Round status grid */}
      {roundsWithMatches.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {roundsWithMatches.map(rs => (
            <div
              key={rs.round}
              className={`rounded-xl border bg-white p-4 shadow-sm transition-all
                ${rs.isComplete ? "border-green-200" : rs.isOpen ? "border-amber-200" : "border-stone-200"}`}
            >
              <div className="flex items-center gap-2 mb-1">
                {rs.isComplete && <span className="h-1.5 w-1.5 rounded-full bg-green-600 flex-shrink-0" />}
                {rs.isOpen && <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse flex-shrink-0" />}
                {!rs.isComplete && !rs.isOpen && <span className="h-1.5 w-1.5 rounded-full bg-stone-200 flex-shrink-0" />}
                <p className="font-medium text-stone-800 text-sm truncate">{rs.label}</p>
              </div>
              <p className="text-xs text-stone-400 pl-3.5">
                {rs.isComplete ? "Complete" : rs.isOpen ? "Open for picks" : "Coming soon"}
              </p>
              <p className="text-xs font-semibold text-green-700 pl-3.5 mt-1">
                {rs.pointsValue}pt / pick
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Sign-in nudge */}
      {!isSignedIn && leaderboard.length > 0 && (
        <div className="rounded-xl border border-stone-200 bg-white px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
          <div>
            <p className="font-display font-semibold text-stone-900 text-lg">Ready to compete?</p>
            <p className="text-stone-500 text-sm mt-0.5">
              Sign in with Google to submit your picks and join the leaderboard.
            </p>
          </div>
          <a
            href="/api/auth/signin?callbackUrl=/picks"
            className="flex-shrink-0 bg-green-800 text-white font-semibold px-5 py-2.5 rounded-lg hover:bg-green-700 transition-colors shadow-sm text-sm whitespace-nowrap"
          >
            Join the Pool
          </a>
        </div>
      )}

      {/* Head-to-head modal */}
      {showCompare && entryA && entryB && (
        <HeadToHead
          a={entryA}
          b={entryB}
          matches={matches}
          onClose={() => { setShowCompare(false); setCompareA(null); setCompareB(null); }}
        />
      )}
    </div>
  );
}

function HeadToHead({ a, b, matches, onClose }: {
  a: LeaderboardEntry;
  b: LeaderboardEntry;
  matches: Match[];
  onClose: () => void;
}) {
  const finishedMatches = matches.filter(m => m.status === "FINISHED");

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto border border-stone-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
          <h2 className="font-display font-semibold text-stone-900">Head to Head</h2>
          <button
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>

        <div className="p-5">
          {/* Score summary */}
          <div className="grid grid-cols-3 text-center mb-6 bg-stone-50 rounded-xl p-5 border border-stone-100">
            <div>
              <p className="font-display font-semibold text-2xl tabular-nums text-stone-900">{a.totalScore}</p>
              <p className="text-xs text-stone-500 font-medium mt-1 truncate">{a.name}</p>
            </div>
            <div className="flex flex-col items-center justify-center">
              <p className="text-stone-300 text-xs uppercase tracking-wider font-medium">pts</p>
              <p className="text-stone-300 text-xs mt-1">vs</p>
            </div>
            <div>
              <p className="font-display font-semibold text-2xl tabular-nums text-stone-900">{b.totalScore}</p>
              <p className="text-xs text-stone-500 font-medium mt-1 truncate">{b.name}</p>
            </div>
          </div>

          {/* Match-by-match */}
          <div className="grid grid-cols-3 text-xs font-semibold mb-3 text-stone-500 uppercase tracking-wide">
            <span className="truncate">{a.name}</span>
            <span className="text-center">Match</span>
            <span className="text-right truncate">{b.name}</span>
          </div>
          <div className="space-y-0 text-sm divide-y divide-stone-50">
            {finishedMatches.map(m => {
              const resultLabel = m.result === "H" ? m.homeTeam : m.result === "A" ? m.awayTeam : "Draw";
              return (
                <div key={m.matchId} className="grid grid-cols-3 items-center py-2.5">
                  <span className="text-stone-300 text-xs">—</span>
                  <span className="text-center text-xs text-stone-500 leading-tight">
                    {m.homeTeam} vs {m.awayTeam}
                    <br />
                    <span className="text-stone-400 font-medium">{resultLabel}</span>
                  </span>
                  <span className="text-right text-stone-300 text-xs">—</span>
                </div>
              );
            })}
            {finishedMatches.length === 0 && (
              <p className="text-center text-stone-400 py-10 text-sm">No results yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
