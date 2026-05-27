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

  const kickoff = new Date(match.kickoffUtc);
  const dateLabel = kickoff.toLocaleString("en-CA", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });

  return (
    <div className={`rounded-xl bg-white overflow-hidden transition-all
      ${isLive
        ? "border border-amber-300 shadow-[0_0_0_3px_rgba(251,191,36,0.12)]"
        : "border border-stone-200 shadow-sm hover:shadow-md hover:border-stone-300"
      }`}>

      {/* Date / status row */}
      <div className={`px-4 py-2.5 flex items-center justify-between
        ${isLive ? "bg-amber-50 border-b border-amber-200" : "border-b border-stone-100"}`}>
        <span className="text-xs text-stone-400 font-medium">{dateLabel}</span>
        <span className="flex items-center gap-1.5 text-xs font-semibold">
          {isLive && (
            <span className="flex items-center gap-1.5 text-amber-700">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              Live
            </span>
          )}
          {isFinished && match.homeScore !== null && (
            <span className="font-mono tabular-nums text-stone-500 font-bold">
              {match.homeScore} – {match.awayScore}
            </span>
          )}
        </span>
      </div>

      {/* Pick buttons */}
      <div className={`p-3 grid gap-2 ${isKnockout ? "grid-cols-2" : "grid-cols-3"}`}>
        {options.map(opt => {
          const picked = currentPick === opt.value;
          const correct = isFinished && result === opt.value;
          const wrong = isFinished && picked && result !== opt.value;

          let cls = "relative flex flex-col items-center justify-center gap-0.5 rounded-lg border px-2 py-3 text-[13px] font-medium transition-all select-none cursor-pointer ";

          if (correct)     cls += "border-green-300 bg-green-50 text-green-800";
          else if (wrong)  cls += "border-stone-150 bg-stone-50 text-stone-400 line-through";
          else if (picked) cls += "border-green-800 bg-green-800 text-white shadow-sm";
          else             cls += "border-stone-200 bg-stone-50 text-stone-800 hover:border-stone-300 hover:bg-white";

          if (disabled && !picked && !correct && !wrong) cls += " opacity-60 cursor-default";

          return (
            <button
              key={opt.value}
              onClick={() => !disabled && onPick(match.matchId, opt.value)}
              disabled={disabled && !picked}
              className={cls}
            >
              <span className="text-center leading-tight text-[12px] sm:text-[13px] font-medium">{opt.label}</span>
              {opt.prob !== null && !isFinished && (
                <span className={`text-[11px] font-normal tabular-nums ${picked ? "text-green-300" : "text-stone-400"}`}>
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
