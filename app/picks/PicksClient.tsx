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
    <div className="space-y-6">

      {/* Page header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-stone-900">My Picks</h1>
          <p className="text-stone-500 text-sm mt-1">
            Hi {userName} — picks save instantly as you go
          </p>
        </div>
        {activeRound?.deadline && (
          <CountdownTimer deadline={activeRound.deadline} label={`${activeRound.label} deadline`} />
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Round tabs */}
      <div className="flex gap-2 flex-wrap">
        {roundsWithMatches.map(rs => (
          <button
            key={rs.round}
            onClick={() => setSelectedRound(rs.round)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-all
              ${selectedRound === rs.round
                ? "bg-green-800 text-white shadow-sm"
                : rs.isOpen
                  ? "bg-white border border-amber-300 text-stone-700 hover:border-amber-400 ring-2 ring-amber-100"
                  : "bg-white border border-stone-200 text-stone-600 hover:border-stone-300 hover:text-stone-900"
              }`}
          >
            {rs.label}
            {rs.isOpen && selectedRound !== rs.round && (
              <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-amber-400 align-middle" />
            )}
            {rs.isComplete && (
              <span className="ml-1.5 text-xs text-green-600">✓</span>
            )}
          </button>
        ))}
        {roundsWithMatches.length === 0 && (
          <p className="text-stone-400 text-sm">Waiting for match schedule…</p>
        )}
      </div>

      {/* Progress */}
      {totalCount > 0 && (
        <div className="bg-white rounded-xl border border-stone-200 px-5 py-4 shadow-sm">
          <div className="flex items-center justify-between text-sm mb-3">
            <span className="font-medium text-stone-700">
              {pickedCount} <span className="text-stone-400 font-normal">of</span> {totalCount} picks made
            </span>
            <span className="text-stone-400 text-xs">
              {!isOpen && currentRoundState?.isComplete && <span className="text-green-700 font-medium">Round complete</span>}
              {!isOpen && !currentRoundState?.isComplete && <span>Picks locked</span>}
              {isOpen && pct === 100 && <span className="text-green-700 font-medium">All done!</span>}
              {isOpen && pct < 100 && <span>{currentRoundState?.pointsValue}pt per correct pick</span>}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-stone-100 overflow-hidden">
            <div
              className="h-1.5 rounded-full bg-green-700 transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Match grid */}
      {roundMatches.length === 0 ? (
        <div className="rounded-xl border border-stone-200 bg-white p-12 text-center text-stone-400 shadow-sm">
          <p className="text-sm">
            {selectedRound === "GROUP"
              ? "Group stage matches will appear here once the schedule is loaded."
              : "This round's bracket will be available once the previous round completes."}
          </p>
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
                <div className="absolute top-2.5 right-3 text-[11px] text-stone-400 font-medium animate-pulse">
                  saving…
                </div>
              )}
              {saved[match.matchId] && (
                <div className="absolute top-2.5 right-3 text-[11px] text-green-600 font-semibold">
                  saved ✓
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {currentRoundState && totalCount > 0 && (
        <p className="text-center text-xs text-stone-400 pb-2">
          {currentRoundState.label} · {currentRoundState.pointsValue} point{currentRoundState.pointsValue !== 1 ? "s" : ""} per correct pick
        </p>
      )}
    </div>
  );
}
