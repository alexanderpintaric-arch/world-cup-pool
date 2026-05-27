"use client";
import { useState, useCallback } from "react";
import type { Match, Pick, OddsData, RoundState, MatchResult, Round } from "@/lib/types";
import { ROUND_CONFIG } from "@/lib/constants";
import MatchCard from "@/components/MatchCard";
import CountdownTimer from "@/components/CountdownTimer";

interface Props {
  matches: Match[];
  userPicks: Pick[];
  odds: OddsData[];
  roundStates: RoundState[];
  activeRound: RoundState | null;
  userEmail: string;
  userName: string;
}

export default function PicksClient({
  matches, userPicks, odds, roundStates, activeRound, userName,
}: Props) {
  const [selectedRound, setSelectedRound] = useState<Round>(
    activeRound?.round ?? "GROUP"
  );
  const [picks, setPicks] = useState<Record<string, MatchResult>>(() => {
    const init: Record<string, MatchResult> = {};
    for (const p of userPicks) init[p.matchId] = p.pick;
    return init;
  });
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const oddsMap = new Map(odds.map(o => [o.matchId, o]));
  const currentRoundState = roundStates.find(r => r.round === selectedRound);
  const isOpen = currentRoundState?.isOpen ?? false;

  const roundMatches = matches
    .filter(m => m.round === selectedRound)
    .sort((a, b) => new Date(a.kickoffUtc).getTime() - new Date(b.kickoffUtc).getTime());

  const pickedCount = roundMatches.filter(m => picks[m.matchId]).length;
  const totalCount = roundMatches.length;
  const pct = totalCount > 0 ? (pickedCount / totalCount) * 100 : 0;

  const savePick = useCallback(async (matchId: string, pick: MatchResult) => {
    setSaving(s => ({ ...s, [matchId]: true }));
    setError(null);
    try {
      const res = await fetch("/api/picks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ picks: [{ matchId, pick }] }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Save failed");
      } else {
        setSaved(s => ({ ...s, [matchId]: true }));
        setTimeout(() => setSaved(s => ({ ...s, [matchId]: false })), 1500);
      }
    } catch {
      setError("Network error — pick not saved");
    } finally {
      setSaving(s => ({ ...s, [matchId]: false }));
    }
  }, []);

  function handlePick(matchId: string, pick: MatchResult) {
    setPicks(p => ({ ...p, [matchId]: pick }));
    savePick(matchId, pick);
  }

  const roundsWithMatches = roundStates.filter(r => r.matchCount > 0);

  return (
    <div className="space-y-5">

      {/* Page header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Picks</h1>
          <p className="text-slate-500 text-sm mt-0.5">Hi {userName} — picks save instantly as you go</p>
        </div>
        {activeRound?.deadline && (
          <CountdownTimer deadline={activeRound.deadline} label={`${activeRound.label} deadline`} />
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Round tabs */}
      <div className="flex gap-2 flex-wrap">
        {roundsWithMatches.map(rs => (
          <button
            key={rs.round}
            onClick={() => setSelectedRound(rs.round)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition
              ${selectedRound === rs.round
                ? "bg-emerald-800 text-white shadow-sm"
                : "bg-white border border-slate-200 text-slate-600 hover:border-emerald-300 hover:text-emerald-700"
              }
              ${rs.isOpen && selectedRound !== rs.round ? "ring-2 ring-emerald-300 ring-offset-1" : ""}
            `}
          >
            {rs.label}
            {rs.isOpen && <span className="ml-1.5 text-emerald-300">●</span>}
            {rs.isComplete && <span className="ml-1.5 text-emerald-500">✓</span>}
          </button>
        ))}
        {roundsWithMatches.length === 0 && (
          <p className="text-slate-400 text-sm">Waiting for match schedule…</p>
        )}
      </div>

      {/* Progress bar */}
      {totalCount > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
          <div className="flex justify-between text-xs text-slate-500 mb-2">
            <span className="font-medium text-slate-700">{pickedCount} of {totalCount} picks made</span>
            <span>
              {!isOpen && currentRoundState?.isComplete && <span className="text-emerald-600 font-medium">✓ Round complete</span>}
              {!isOpen && !currentRoundState?.isComplete && <span className="text-slate-400">Picks locked</span>}
              {isOpen && pct === 100 && <span className="text-emerald-600 font-medium">All done!</span>}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-2 rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Match cards */}
      {roundMatches.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-400 shadow-sm">
          {selectedRound === "GROUP"
            ? "Group stage matches will appear here once the schedule is loaded."
            : "This round's bracket will be available once the previous round completes."}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {roundMatches.map(match => (
            <div key={match.matchId} className="relative">
              <MatchCard
                match={match}
                currentPick={picks[match.matchId] ?? null}
                odds={oddsMap.get(match.matchId) ?? null}
                onPick={handlePick}
                disabled={!isOpen}
                result={match.result}
              />
              {saving[match.matchId] && (
                <div className="absolute top-2 right-2 text-xs text-slate-300 animate-pulse bg-white/80 rounded px-1">saving…</div>
              )}
              {saved[match.matchId] && (
                <div className="absolute top-2 right-2 text-xs text-emerald-500 bg-white/80 rounded px-1">saved ✓</div>
              )}
            </div>
          ))}
        </div>
      )}

      {currentRoundState && (
        <p className="text-center text-xs text-slate-400 pb-2">
          {currentRoundState.label} · <span className="font-medium">{currentRoundState.pointsValue} point{currentRoundState.pointsValue !== 1 ? "s" : ""}</span> per correct pick
        </p>
      )}
    </div>
  );
}
