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

function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

const AVATAR_COLORS = [
  "bg-emerald-600", "bg-blue-600", "bg-violet-600",
  "bg-rose-600", "bg-amber-600", "bg-cyan-600",
];

export default function LeaderboardClient({
  leaderboard, matches, roundStates, activeRound, popularPicks, currentUserEmail,
}: Props) {
  const [compareA, setCompareA] = useState<string | null>(null);
  const [compareB, setCompareB] = useState<string | null>(null);
  const [showCompare, setShowCompare] = useState(false);

  const liveMatches = matches.filter(m => m.status === "IN_PLAY" || m.status === "PAUSED" || m.status === "LIVE");
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
        <div className="rounded-2xl bg-gradient-to-r from-emerald-700 to-emerald-600 text-white px-5 py-3.5 flex flex-wrap items-center gap-3 shadow-lg">
          <span className="flex items-center gap-2 text-sm font-bold">
            <span className="h-2.5 w-2.5 rounded-full bg-green-300 animate-pulse shadow-[0_0_8px_rgba(134,239,172,0.8)]" />
            LIVE
          </span>
          <div className="h-4 w-px bg-emerald-500" />
          {liveMatches.map(m => (
            <span key={m.matchId} className="text-sm text-emerald-100">
              {m.homeTeam} <span className="font-black text-white tabular-nums">{m.homeScore ?? "–"} : {m.awayScore ?? "–"}</span> {m.awayTeam}
            </span>
          ))}
        </div>
      )}

      {/* Hero section — shown when no entries yet */}
      {leaderboard.length === 0 && (
        <div className="rounded-2xl overflow-hidden shadow-xl">
          <div className="bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-800 px-8 py-12 text-center">
            <div className="text-6xl mb-5">🏆</div>
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-3 tracking-tight">
              Pick Every Match
            </h2>
            <p className="text-emerald-300 text-lg mb-2">
              Predict all 64 World Cup 2026 games and climb the leaderboard.
            </p>
            <p className="text-emerald-500 text-sm mb-8">
              Group stage opens June 11 · Results update automatically
            </p>
            {!isSignedIn ? (
              <a
                href="/api/auth/signin?callbackUrl=/picks"
                className="inline-flex items-center gap-2 bg-yellow-400 text-emerald-950 font-black text-lg px-8 py-3.5 rounded-xl hover:bg-yellow-300 transition shadow-lg hover:shadow-yellow-400/25 hover:-translate-y-0.5 transform"
              >
                Join the Pool →
              </a>
            ) : (
              <a
                href="/picks"
                className="inline-flex items-center gap-2 bg-yellow-400 text-emerald-950 font-black text-lg px-8 py-3.5 rounded-xl hover:bg-yellow-300 transition shadow-lg"
              >
                Submit Your Picks →
              </a>
            )}
          </div>
          <div className="bg-emerald-950/80 px-8 py-5 grid grid-cols-3 divide-x divide-emerald-800 text-center">
            {[["64", "Matches"], ["6", "Rounds"], ["136", "Max pts"]].map(([val, label]) => (
              <div key={label} className="px-4">
                <div className="text-2xl font-black text-yellow-400">{val}</div>
                <div className="text-xs text-emerald-500 uppercase tracking-widest mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active round CTA */}
      {activeRound && leaderboard.length > 0 && (
        <div className="rounded-2xl bg-gradient-to-r from-emerald-900 to-emerald-800 px-5 py-4 flex items-center justify-between shadow gap-4">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="h-2 w-2 rounded-full bg-yellow-400 animate-pulse" />
              <p className="font-bold text-white">{activeRound.label} picks are open</p>
            </div>
            {activeRound.deadline && (
              <p className="text-sm text-emerald-400 ml-4">
                Closes {new Date(activeRound.deadline).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" })}
              </p>
            )}
          </div>
          <a href="/picks" className="flex-shrink-0 rounded-xl bg-yellow-400 px-5 py-2.5 text-sm font-black text-emerald-950 hover:bg-yellow-300 transition shadow">
            Submit Picks →
          </a>
        </div>
      )}

      {/* Leaderboard table */}
      {leaderboard.length > 0 && (
        <div className="rounded-2xl overflow-hidden shadow-lg border border-slate-200/60">

          {/* Table header */}
          <div className="bg-gradient-to-r from-emerald-950 to-emerald-900 px-5 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-white font-black text-base tracking-wide">Standings</h2>
              <p className="text-emerald-500 text-xs mt-0.5">{leaderboard.length} player{leaderboard.length !== 1 ? "s" : ""}</p>
            </div>
            {leaderboard.length > 1 && (
              <p className="text-emerald-600 text-xs">
                {compareA ? "Select another to compare" : "Tap two rows to compare"}
              </p>
            )}
          </div>

          <div className="overflow-x-auto bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs text-slate-400 uppercase tracking-wider bg-slate-50/80">
                  <th className="px-4 py-3 w-10">#</th>
                  <th className="px-4 py-3">Player</th>
                  <th className="px-4 py-3 text-right font-bold text-slate-500">Score</th>
                  <th className="px-4 py-3 text-right hidden sm:table-cell">Max</th>
                  {(Object.keys(ROUND_CONFIG) as (keyof typeof ROUND_CONFIG)[]).map(r => (
                    <th key={r} className="px-2 py-3 text-right hidden md:table-cell">
                      {ROUND_CONFIG[r].label.split(" ")[0]}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right hidden sm:table-cell">Correct</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {leaderboard.map((entry, i) => {
                  const isMe = entry.email === currentUserEmail;
                  const isSelected = entry.email === compareA || entry.email === compareB;
                  const avatarColor = AVATAR_COLORS[i % AVATAR_COLORS.length];

                  return (
                    <tr
                      key={entry.email}
                      onClick={() => handleRowClick(entry.email)}
                      className={`transition-colors cursor-pointer
                        ${isSelected ? "bg-yellow-50 ring-1 ring-inset ring-yellow-300" : ""}
                        ${isMe && !isSelected ? "bg-blue-50/60" : ""}
                        ${!isMe && !isSelected ? "hover:bg-slate-50" : ""}
                      `}
                    >
                      <td className="px-4 py-3.5 w-10">
                        {i < 3
                          ? <span className="text-base">{MEDAL[i]}</span>
                          : <span className="text-slate-300 font-bold text-sm">{i + 1}</span>
                        }
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className={`h-8 w-8 rounded-full ${avatarColor} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                            {initials(entry.name)}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-900">{entry.name}</span>
                            {isMe && <span className="ml-2 text-xs font-medium text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded-full">you</span>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="font-black text-xl text-slate-900">{entry.totalScore}</span>
                      </td>
                      <td className="px-4 py-3.5 text-right text-slate-300 text-xs hidden sm:table-cell">{entry.maxPossibleScore}</td>
                      {(Object.keys(ROUND_CONFIG) as (keyof typeof ROUND_CONFIG)[]).map(r => (
                        <td key={r} className="px-2 py-3.5 text-right text-slate-400 text-xs hidden md:table-cell">
                          {entry.scoreByRound[r] ?? 0}
                        </td>
                      ))}
                      <td className="px-4 py-3.5 text-right hidden sm:table-cell">
                        <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
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
      )}

      {/* Round status grid */}
      {roundsWithMatches.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {roundsWithMatches.map(rs => (
            <div key={rs.round} className={`rounded-xl border p-4 bg-white shadow-sm transition-all
              ${rs.isComplete ? "border-emerald-200" : rs.isOpen ? "border-yellow-300 ring-1 ring-yellow-200" : "border-slate-200"}`}>
              <div className="flex items-center gap-2 mb-1">
                {rs.isComplete && <span className="h-2 w-2 rounded-full bg-emerald-500 flex-shrink-0" />}
                {rs.isOpen && <span className="h-2 w-2 rounded-full bg-yellow-400 animate-pulse flex-shrink-0" />}
                {!rs.isComplete && !rs.isOpen && <span className="h-2 w-2 rounded-full bg-slate-200 flex-shrink-0" />}
                <p className="font-bold text-slate-800 text-sm truncate">{rs.label}</p>
              </div>
              <p className="text-xs text-slate-400 pl-4">
                {rs.isComplete ? "✓ Complete" : rs.isOpen ? "Open for picks" : "Coming soon"}
              </p>
              <p className="text-xs font-bold text-emerald-600 pl-4 mt-1">{rs.pointsValue}pt per pick</p>
            </div>
          ))}
        </div>
      )}

      {/* Sign-in nudge if signed out and leaderboard has entries */}
      {!isSignedIn && leaderboard.length > 0 && (
        <div className="rounded-2xl bg-gradient-to-r from-emerald-950 to-emerald-900 px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow">
          <div>
            <p className="font-black text-white text-lg">Ready to compete?</p>
            <p className="text-emerald-400 text-sm mt-0.5">Sign in with Google to submit your picks and join the leaderboard.</p>
          </div>
          <a href="/api/auth/signin?callbackUrl=/picks" className="flex-shrink-0 bg-yellow-400 text-emerald-950 font-black px-6 py-2.5 rounded-xl hover:bg-yellow-300 transition shadow-lg text-sm whitespace-nowrap">
            Join the Pool →
          </a>
        </div>
      )}

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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-emerald-950 to-emerald-900 rounded-t-2xl px-5 py-4 flex items-center justify-between">
          <h2 className="font-black text-white text-base">Head to Head</h2>
          <button onClick={onClose} className="text-emerald-400 hover:text-white text-xl leading-none w-8 h-8 flex items-center justify-center rounded-lg hover:bg-emerald-800 transition">✕</button>
        </div>
        <div className="p-5">
          {/* Score summary */}
          <div className="grid grid-cols-3 text-center mb-5 bg-slate-50 rounded-xl p-4">
            <div>
              <p className="font-black text-emerald-700 text-2xl">{a.totalScore}</p>
              <p className="text-xs text-slate-500 font-medium truncate">{a.name}</p>
            </div>
            <div className="flex flex-col items-center justify-center">
              <p className="text-slate-300 text-xs uppercase tracking-wider">Total pts</p>
              <p className="text-slate-400 text-xs mt-1">vs</p>
            </div>
            <div>
              <p className="font-black text-blue-700 text-2xl">{b.totalScore}</p>
              <p className="text-xs text-slate-500 font-medium truncate">{b.name}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 text-sm font-bold mb-3">
            <span className="text-emerald-700 truncate">{a.name}</span>
            <span className="text-center text-slate-400 text-xs uppercase tracking-wide">Match</span>
            <span className="text-right text-blue-700 truncate">{b.name}</span>
          </div>
          <div className="space-y-1 text-sm">
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
              <p className="text-center text-slate-400 py-8 text-sm">No results yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
