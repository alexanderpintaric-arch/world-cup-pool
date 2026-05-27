"use client";
import type { Match, OddsData, MatchResult } from "@/lib/types";

interface Props {
  match: Match;
  currentPick: MatchResult | null;
  odds: OddsData | null;
  onPick: (matchId: string, pick: MatchResult) => void;
  disabled: boolean;
  result?: MatchResult;
}

export default function MatchCard({ match, currentPick, odds, onPick, disabled, result }: Props) {
  const isKnockout = match.round !== "GROUP";
  const isLive = match.status === "IN_PLAY" || match.status === "PAUSED" || match.status === "LIVE";
  const isFinished = match.status === "FINISHED";

  const options: { value: MatchResult; label: string; prob: number | null }[] = [
    { value: "H", label: match.homeTeam, prob: odds?.homeProb ?? null },
    ...(!isKnockout ? [{ value: "T" as MatchResult, label: "Draw", prob: odds?.drawProb ?? null }] : []),
    { value: "A", label: match.awayTeam, prob: odds?.awayProb ?? null },
  ];

  return (
    <div className={`rounded-xl border bg-white shadow-sm overflow-hidden transition-all
      ${isLive ? "border-emerald-400 ring-1 ring-emerald-300 shadow-emerald-100" : "border-slate-200"}`}>

      {/* Match header */}
      <div className={`px-4 py-2 flex items-center justify-between text-xs
        ${isLive ? "bg-emerald-700 text-white" : "bg-slate-50 text-slate-400 border-b border-slate-100"}`}>
        <span>
          {new Date(match.kickoffUtc).toLocaleString("en-CA", {
            month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
          })}
        </span>
        <span className="flex items-center gap-1.5 font-medium">
          {isLive && <><span className="h-1.5 w-1.5 rounded-full bg-green-300 animate-pulse" /> LIVE</>}
          {isFinished && match.homeScore !== null && (
            <span className="font-mono font-bold text-slate-600">{match.homeScore} – {match.awayScore}</span>
          )}
        </span>
      </div>

      {/* Pick buttons */}
      <div className={`p-3 grid gap-2 ${isKnockout ? "grid-cols-2" : "grid-cols-3"}`}>
        {options.map(opt => {
          const picked = currentPick === opt.value;
          const correct = isFinished && result === opt.value;
          const wrong = isFinished && picked && result !== opt.value;

          let btnClass = "relative flex flex-col items-center rounded-lg border-2 px-2 py-3 text-sm font-semibold transition cursor-pointer select-none ";
          if (correct)       btnClass += "border-emerald-500 bg-emerald-50 text-emerald-800 shadow-sm";
          else if (wrong)    btnClass += "border-red-200 bg-red-50 text-red-400 line-through";
          else if (picked)   btnClass += "border-emerald-500 bg-emerald-700 text-white shadow-sm";
          else               btnClass += "border-slate-200 text-slate-700 hover:border-emerald-300 hover:bg-emerald-50";

          if (disabled && !picked && !correct && !wrong) btnClass += " opacity-70 cursor-default";

          return (
            <button
              key={opt.value}
              onClick={() => !disabled && onPick(match.matchId, opt.value)}
              disabled={disabled && !picked}
              className={btnClass}
            >
              <span className="text-center leading-tight text-xs sm:text-sm">{opt.label}</span>
              {opt.prob !== null && !isFinished && (
                <span className={`mt-1 text-xs font-normal ${picked ? "text-emerald-200" : "text-slate-400"}`}>
                  {opt.prob}%
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
