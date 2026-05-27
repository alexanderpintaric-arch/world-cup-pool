"use client";
import { useState } from "react";
import type { LeaderboardEntry, Match, RoundState, OddsData } from "@/lib/types";
import { ROUND_CONFIG } from "@/lib/constants";

interface Props {
  leaderboard: LeaderboardEntry[];
  matches: Match[];
  roundStates: RoundState[];
  activeRound: RoundState | null;
  popularPicks: Record<string, { H: number; A: number; T: number; total: number }>;
  odds: OddsData[];
  currentUserEmail: string | null;
}

export default function LeaderboardClient({
  leaderboard, matches, roundStates, activeRound, popularPicks, currentUserEmail,
}: Props) {
  const [compareA, setCompareA] = useState<string | null>(null);
  const [compareB, setCompareB] = useState<string | null>(null);
  const [showCompare, setShowCompare] = useState(false);

  const liveMatches = matches.filter(m => m.status === "IN_PLAY" || m.status === "PAUSED" || m.status === "LIVE");

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
        <div className="rounded-xl border border-green-300 bg-green-50 p-3 flex flex-wrap gap-3">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-green-700">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" /> Live now
          </span>
          {liveMatches.map(m => (
            <span key={m.matchId} className="text-sm text-green-800">
              {m.homeTeam} {m.homeScore ?? "–"} : {m.awayScore ?? "–"} {m.awayTeam}
            </span>
          ))}
        </div>
      )}

      {/* Active round nudge */}
      {activeRound && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 flex items-center justify-between">
          <div>
            <p className="font-semibold text-blue-800">{activeRound.label} picks are open</p>
            {activeRound.deadline && (
              <p className="text-sm text-blue-600">
                Deadline: {new Date(activeRound.deadline).toLocaleString("en-CA", {
                  dateStyle: "medium", timeStyle: "short",
                })}
              </p>
            )}
          </div>
          <a href="/picks" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition">
            Submit Picks →
          </a>
        </div>
      )}

      {/* Compare hint */}
      {leaderboard.length > 1 && (
        <p className="text-xs text-slate-400 text-center">
          {compareA ? `${entryA?.name} selected — click another row to compare` : "Click two rows to compare picks head-to-head"}
        </p>
      )}

      {/* Leaderboard table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs text-slate-500 uppercase tracking-wide">
                <th className="px-4 py-3 w-10">#</th>
                <th className="px-4 py-3">Player</th>
                <th className="px-4 py-3 text-right">Score</th>
                <th className="px-4 py-3 text-right hidden sm:table-cell">Max</th>
                {(Object.keys(ROUND_CONFIG) as (keyof typeof ROUND_CONFIG)[]).map(r => (
                  <th key={r} className="px-2 py-3 text-right hidden md:table-cell text-xs">
                    {ROUND_CONFIG[r].label.split(" ")[0]}
                  </th>
                ))}
                <th className="px-4 py-3 text-right hidden sm:table-cell">Correct</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {leaderboard.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-slate-400">
                    No entries yet — be the first to submit picks!
                  </td>
                </tr>
              )}
              {leaderboard.map((entry, i) => {
                const isMe = entry.email === currentUserEmail;
                const isSelected = entry.email === compareA || entry.email === compareB;
                return (
                  <tr
                    key={entry.email}
                    onClick={() => handleRowClick(entry.email)}
                    className={`transition cursor-pointer
                      ${isMe ? "bg-blue-50" : ""}
                      ${isSelected ? "bg-yellow-50 ring-1 ring-inset ring-yellow-300" : ""}
                      hover:bg-slate-50
                    `}
                  >
                    <td className="px-4 py-3 font-bold text-slate-400">{i + 1}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {entry.name}
                      {isMe && <span className="ml-1.5 text-xs text-blue-500">you</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900">{entry.totalScore}</td>
                    <td className="px-4 py-3 text-right text-slate-400 hidden sm:table-cell">{entry.maxPossibleScore}</td>
                    {(Object.keys(ROUND_CONFIG) as (keyof typeof ROUND_CONFIG)[]).map(r => (
                      <td key={r} className="px-2 py-3 text-right text-slate-500 hidden md:table-cell">
                        {entry.scoreByRound[r] ?? 0}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right text-slate-400 hidden sm:table-cell">
                      {entry.correctPicks}/{entry.totalPicks}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Head-to-head comparison modal */}
      {showCompare && entryA && entryB && (
        <HeadToHead
          a={entryA} b={entryB}
          matches={matches}
          popularPicks={popularPicks}
          onClose={() => { setShowCompare(false); setCompareA(null); setCompareB(null); }}
        />
      )}

      {/* Round progress */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {roundStates.filter(r => r.matchCount > 0).map(rs => (
          <div key={rs.round} className={`rounded-lg border p-3 text-sm
            ${rs.isComplete ? "border-green-200 bg-green-50" :
              rs.isOpen ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white"}`}>
            <p className="font-semibold text-slate-700">{rs.label}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {rs.isComplete ? "Complete" : rs.isOpen ? "Open for picks" : "Coming soon"}
              {" · "}{rs.pointsValue}pt/pick
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function HeadToHead({
  a, b, matches, popularPicks, onClose,
}: {
  a: LeaderboardEntry;
  b: LeaderboardEntry;
  matches: Match[];
  popularPicks: Record<string, { H: number; A: number; T: number; total: number }>;
  onClose: () => void;
}) {
  const finishedMatches = matches.filter(m => m.status === "FINISHED");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">Head to Head</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
        </div>
        <div className="grid grid-cols-3 text-sm font-semibold mb-2">
          <span className="text-blue-600 truncate">{a.name}</span>
          <span className="text-center text-slate-400">Match</span>
          <span className="text-right text-purple-600 truncate">{b.name}</span>
        </div>
        <div className="space-y-2 text-sm">
          {finishedMatches.map(m => {
            const pickA = a.email; // placeholder — real implementation needs picks passed in
            const pickB = b.email;
            const resultLabel = m.result === "H" ? m.homeTeam : m.result === "A" ? m.awayTeam : "Draw";
            return (
              <div key={m.matchId} className="grid grid-cols-3 items-center py-1.5 border-b border-slate-50">
                <span className="text-blue-600">—</span>
                <span className="text-center text-xs text-slate-500">
                  {m.homeTeam} vs {m.awayTeam}<br/>
                  <span className="text-slate-400">{resultLabel}</span>
                </span>
                <span className="text-right text-purple-600">—</span>
              </div>
            );
          })}
          {finishedMatches.length === 0 && (
            <p className="text-center text-slate-400 py-4">No results yet</p>
          )}
        </div>
        <div className="mt-4 grid grid-cols-3 font-bold text-center border-t pt-3">
          <span className="text-blue-600">{a.totalScore} pts</span>
          <span className="text-slate-400 text-sm">Total</span>
          <span className="text-purple-600">{b.totalScore} pts</span>
        </div>
      </div>
    </div>
  );
}
