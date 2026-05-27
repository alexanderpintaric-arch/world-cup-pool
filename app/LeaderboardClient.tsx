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

const MEDAL = ["🥇", "🥈", "🥉"];
const RANK_BG = [
  "bg-yellow-50 border-l-4 border-yellow-400",
  "bg-slate-50 border-l-4 border-slate-400",
  "bg-orange-50 border-l-4 border-orange-400",
];

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
    <div className="space-y-5">

      {/* Live matches banner */}
      {liveMatches.length > 0 && (
        <div className="rounded-xl bg-emerald-700 text-white px-4 py-3 flex flex-wrap items-center gap-3 shadow">
          <span className="flex items-center gap-1.5 text-sm font-semibold">
            <span className="h-2 w-2 rounded-full bg-green-300 animate-pulse" /> Live now
          </span>
          {liveMatches.map(m => (
            <span key={m.matchId} className="text-sm text-emerald-100">
              {m.homeTeam} <span className="font-bold text-white">{m.homeScore ?? "–"} : {m.awayScore ?? "–"}</span> {m.awayTeam}
            </span>
          ))}
        </div>
      )}

      {/* Active round nudge */}
      {activeRound && (
        <div className="rounded-xl border border-emerald-200 bg-white px-5 py-4 flex items-center justify-between shadow-sm gap-4">
          <div>
            <p className="font-bold text-emerald-800 text-base">{activeRound.label} picks are open</p>
            {activeRound.deadline && (
              <p className="text-sm text-slate-500 mt-0.5">
                Deadline: {new Date(activeRound.deadline).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" })}
              </p>
            )}
          </div>
          <a href="/picks" className="flex-shrink-0 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 transition shadow-sm">
            Submit Picks →
          </a>
        </div>
      )}

      {/* Compare hint */}
      {leaderboard.length > 1 && (
        <p className="text-xs text-slate-400 text-center">
          {compareA
            ? `${entryA?.name} selected — click another name to compare`
            : "Tap any two rows to compare picks head-to-head"}
        </p>
      )}

      {/* Leaderboard table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="bg-emerald-900 px-5 py-3 flex items-center justify-between">
          <h2 className="text-white font-bold text-sm tracking-wide uppercase">Standings</h2>
          <span className="text-emerald-400 text-xs">{leaderboard.length} players</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs text-slate-400 uppercase tracking-wide bg-slate-50">
                <th className="px-4 py-3 w-10">#</th>
                <th className="px-4 py-3">Player</th>
                <th className="px-4 py-3 text-right">Score</th>
                <th className="px-4 py-3 text-right hidden sm:table-cell text-slate-300">Max</th>
                {(Object.keys(ROUND_CONFIG) as (keyof typeof ROUND_CONFIG)[]).map(r => (
                  <th key={r} className="px-2 py-3 text-right hidden md:table-cell text-xs">
                    {ROUND_CONFIG[r].label.split(" ")[0]}
                  </th>
                ))}
                <th className="px-4 py-3 text-right hidden sm:table-cell">Correct</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leaderboard.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-slate-400">
                    No entries yet — be the first to submit picks!
                  </td>
                </tr>
              )}
              {leaderboard.map((entry, i) => {
                const isMe = entry.email === currentUserEmail;
                const isSelected = entry.email === compareA || entry.email === compareB;
                const rankStyle = i < 3 ? RANK_BG[i] : "";
                return (
                  <tr
                    key={entry.email}
                    onClick={() => handleRowClick(entry.email)}
                    className={`transition cursor-pointer hover:bg-slate-50
                      ${isMe ? "bg-blue-50" : ""}
                      ${isSelected ? "!bg-yellow-50 ring-1 ring-inset ring-yellow-300" : ""}
                      ${!isMe && !isSelected && i < 3 ? rankStyle : ""}
                    `}
                  >
                    <td className="px-4 py-3 font-bold text-slate-400 w-10">
                      {i < 3 ? MEDAL[i] : <span className="text-slate-300">{i + 1}</span>}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {entry.name}
                      {isMe && <span className="ml-1.5 text-xs font-normal text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded-full">you</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-lg text-slate-900">{entry.totalScore}</td>
                    <td className="px-4 py-3 text-right text-slate-300 text-xs hidden sm:table-cell">{entry.maxPossibleScore}</td>
                    {(Object.keys(ROUND_CONFIG) as (keyof typeof ROUND_CONFIG)[]).map(r => (
                      <td key={r} className="px-2 py-3 text-right text-slate-400 text-xs hidden md:table-cell">
                        {entry.scoreByRound[r] ?? 0}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right text-slate-400 text-xs hidden sm:table-cell">
                      {entry.correctPicks}/{entry.totalPicks}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Round status pills */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {roundStates.filter(r => r.matchCount > 0).map(rs => (
          <div key={rs.round} className={`rounded-xl border p-3 text-sm bg-white shadow-sm
            ${rs.isComplete ? "border-emerald-200" : rs.isOpen ? "border-emerald-400 ring-1 ring-emerald-200" : "border-slate-200"}`}>
            <div className="flex items-center gap-1.5 mb-0.5">
              {rs.isComplete && <span className="text-emerald-500 text-xs">✓</span>}
              {rs.isOpen && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />}
              <p className="font-semibold text-slate-800 text-sm">{rs.label}</p>
            </div>
            <p className="text-xs text-slate-400">
              {rs.isComplete ? "Complete" : rs.isOpen ? "Open for picks" : "Coming soon"}
              {" · "}{rs.pointsValue}pt/pick
            </p>
          </div>
        ))}
      </div>

      {/* Head-to-head modal */}
      {showCompare && entryA && entryB && (
        <HeadToHead
          a={entryA} b={entryB}
          matches={matches}
          onClose={() => { setShowCompare(false); setCompareA(null); setCompareB(null); }}
        />
      )}
    </div>
  );
}

function HeadToHead({ a, b, matches, onClose }: {
  a: LeaderboardEntry; b: LeaderboardEntry;
  matches: Match[];
  onClose: () => void;
}) {
  const finishedMatches = matches.filter(m => m.status === "FINISHED");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="bg-emerald-900 rounded-t-2xl px-5 py-4 flex items-center justify-between">
          <h2 className="font-bold text-white">Head to Head</h2>
          <button onClick={onClose} className="text-emerald-300 hover:text-white text-xl leading-none">✕</button>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-3 text-sm font-bold mb-3">
            <span className="text-emerald-700 truncate">{a.name}</span>
            <span className="text-center text-slate-400 text-xs uppercase tracking-wide">Match</span>
            <span className="text-right text-blue-700 truncate">{b.name}</span>
          </div>
          <div className="space-y-2 text-sm">
            {finishedMatches.map(m => {
              const resultLabel = m.result === "H" ? m.homeTeam : m.result === "A" ? m.awayTeam : "Draw";
              return (
                <div key={m.matchId} className="grid grid-cols-3 items-center py-2 border-b border-slate-50">
                  <span className="text-emerald-600 text-xs">—</span>
                  <span className="text-center text-xs text-slate-500 leading-tight">
                    {m.homeTeam} vs {m.awayTeam}<br />
                    <span className="text-slate-400 font-medium">{resultLabel}</span>
                  </span>
                  <span className="text-right text-blue-600 text-xs">—</span>
                </div>
              );
            })}
            {finishedMatches.length === 0 && (
              <p className="text-center text-slate-400 py-6 text-sm">No results yet</p>
            )}
          </div>
          <div className="mt-4 grid grid-cols-3 font-bold text-center border-t border-slate-100 pt-4">
            <span className="text-emerald-700 text-lg">{a.totalScore} <span className="text-xs font-normal text-slate-400">pts</span></span>
            <span className="text-slate-400 text-xs uppercase tracking-wide self-center">Total</span>
            <span className="text-blue-700 text-lg text-right">{b.totalScore} <span className="text-xs font-normal text-slate-400">pts</span></span>
          </div>
        </div>
      </div>
    </div>
  );
}
