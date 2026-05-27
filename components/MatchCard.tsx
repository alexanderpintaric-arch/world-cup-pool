"use client";
import type { Match, OddsData, MatchResult } from "@/lib/types";

interface Props {
  match: Match;
  currentPick: MatchResult | null;
  odds: OddsData | null;
  onPick: (matchId: string, pick: MatchResult) => void;
  disabled: boolean;
  popularPick?: { H: number; A: number; T: number; total: number };
  result?: MatchResult; // actual result (post-match)
}

const FLAG_EMOJIS: Record<string, string> = {};

function probBar(prob: number | null) {
  if (prob === null) return null;
  return (
    <span className="text-xs text-slate-400 font-normal">{prob}%</span>
  );
}

export default function MatchCard({
  match, currentPick, odds, onPick, disabled, popularPick, result,
}: Props) {
  const isKnockout = match.round !== "GROUP";
  const options: { value: MatchResult; label: string; prob: number | null }[] = [
    { value: "H", label: match.homeTeam, prob: odds?.homeProb ?? null },
    ...(!isKnockout ? [{ value: "T" as MatchResult, label: "Draw", prob: odds?.drawProb ?? null }] : []),
    { value: "A", label: match.awayTeam, prob: odds?.awayProb ?? null },
  ];

  const isLive = match.status === "IN_PLAY" || match.status === "PAUSED" || match.status === "LIVE";
  const isFinished = match.status === "FINISHED";

  return (
    <div className={`rounded-xl border bg-white p-4 shadow-sm transition
      ${isLive ? "border-green-400 ring-1 ring-green-300" : "border-slate-200"}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-slate-400">
          {new Date(match.kickoffUtc).toLocaleString("en-CA", {
            month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
          })}
        </span>
        {isLive && (
          <span className="flex items-center gap-1 text-xs font-semibold text-green-600">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" /> LIVE
          </span>
        )}
        {isFinished && match.homeScore !== null && (
          <span className="text-xs font-mono font-bold text-slate-600">
            {match.homeScore} – {match.awayScore}
          </span>
        )}
      </div>

      {/* Pick buttons */}
      <div className={`grid gap-2 ${isKnockout ? "grid-cols-2" : "grid-cols-3"}`}>
        {options.map(opt => {
          const picked = currentPick === opt.value;
          const correct = isFinished && result === opt.value;
          const wrong = isFinished && picked && result !== opt.value;
          const pop = popularPick && popularPick.total > 0
            ? Math.round((popularPick[opt.value as "H"|"A"|"T"] / popularPick.total) * 100)
            : null;

          return (
            <button
              key={opt.value}
              onClick={() => !disabled && onPick(match.matchId, opt.value)}
              disabled={disabled}
              className={`relative flex flex-col items-center rounded-lg border-2 px-2 py-3 text-sm font-medium transition
                ${picked && !isFinished ? "border-blue-500 bg-blue-50 text-blue-700" : ""}
                ${correct ? "border-green-500 bg-green-50 text-green-700" : ""}
                ${wrong ? "border-red-300 bg-red-50 text-red-600 line-through" : ""}
                ${!picked && !correct && !wrong ? "border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700" : ""}
                ${disabled ? "cursor-default" : "cursor-pointer"}
              `}
            >
              <span className="text-center leading-tight">{opt.label}</span>
              {opt.prob !== null && !isFinished && (
                <span className="mt-1 text-xs opacity-60">{opt.prob}%</span>
              )}
              {pop !== null && (
                <span className="mt-1 text-xs opacity-50">{pop}% picked</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
