"use client";
import type { Match, OddsData, MatchResult } from "@/lib/types";
import { flagFor } from "@/lib/services/flags";

interface Props {
  match: Match;
  currentPick: MatchResult | null;
  odds: OddsData | null;
  popular?: { H: number; A: number; T: number; total: number } | null;
  groupLetter?: string | null;
  matchNumber?: number;
  onPick: (matchId: string, pick: MatchResult) => void;
  disabled: boolean;
  result?: MatchResult;
  pointsValue: number;
}

export default function MatchCard({
  match, currentPick, odds, popular, groupLetter, matchNumber,
  onPick, disabled, result, pointsValue,
}: Props) {
  const isKnockout = match.round !== "GROUP";
  const isLive = match.status === "IN_PLAY" || match.status === "PAUSED" || match.status === "LIVE";
  const isFinished = match.status === "FINISHED";

  const options: { value: NonNullable<MatchResult>; label: string; prob: number | null; popPct: number | null }[] = [
    { value: "H", label: match.homeTeam, prob: odds?.homeProb ?? null, popPct: pickPercentage(popular, "H") },
    ...(!isKnockout ? [{ value: "T" as const, label: "Draw", prob: odds?.drawProb ?? null, popPct: pickPercentage(popular, "T") }] : []),
    { value: "A", label: match.awayTeam, prob: odds?.awayProb ?? null, popPct: pickPercentage(popular, "A") },
  ];

  const kickoff = new Date(match.kickoffUtc);
  const dateLabel = kickoff.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
  const timeLabel = kickoff.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" });

  const earnedPoints = isFinished && currentPick && currentPick === result ? pointsValue : null;
  const lostPoints   = isFinished && currentPick && currentPick !== result;

  return (
    <article
      className={`relative bg-card rounded-lg overflow-hidden transition-all
        ${isLive
          ? "border-2 border-accent shadow-lift"
          : "border border-line shadow-paper hover:shadow-lift hover:border-[color:var(--ink-faint)]/30"
        }`}
    >

      {/* ── METADATA ROW ───────────────────────────────────── */}
      <div className={`px-4 sm:px-5 pt-3.5 pb-2.5 flex items-center justify-between gap-2 border-b
        ${isLive ? "border-accent/15 bg-accent-soft/40" : "border-[color:var(--line-soft)]"}
      `}>
        <div className="flex items-center gap-2 flex-wrap">
          {groupLetter && (
            <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded font-mono text-[10.5px] font-bold tabular bg-ink text-paper">
              {groupLetter}
            </span>
          )}
          {matchNumber !== undefined && (
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] ink-faint">
              Match {matchNumber}
            </span>
          )}
        </div>
        <div className="font-mono text-[10.5px] tabular ink-faint flex items-center gap-2">
          <span>{dateLabel}</span>
          <span className="text-[color:var(--ink-faint)]/40">·</span>
          <span>{timeLabel}</span>
        </div>
      </div>

      {/* ── TEAMS + STATUS ─────────────────────────────────── */}
      <div className="px-4 sm:px-5 pt-4 pb-3">
        <div className="flex items-center justify-between gap-3">
          <TeamRow team={match.homeTeam} score={match.homeScore} isFinished={isFinished} />

          <div className="flex flex-col items-center flex-shrink-0 px-2">
            {isLive ? (
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-accent anim-ring-pulse" />
                <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-accent font-bold">Live</span>
              </div>
            ) : isFinished ? (
              <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] ink-faint">Full time</span>
            ) : (
              <span className="font-serif italic text-[13px] ink-faint" style={{fontVariationSettings: '"opsz" 24'}}>vs</span>
            )}
          </div>

          <TeamRow team={match.awayTeam} score={match.awayScore} isFinished={isFinished} reverse />
        </div>
      </div>

      {/* ── PICK BUTTONS ───────────────────────────────────── */}
      <div className={`px-4 sm:px-5 pb-4 pt-1 grid gap-2 ${isKnockout ? "grid-cols-2" : "grid-cols-3"}`}>
        {options.map(opt => {
          const picked  = currentPick === opt.value;
          const correct = isFinished && result === opt.value;
          const wrong   = isFinished && picked && result !== opt.value;

          let cls = "relative flex flex-col items-center justify-center gap-1 rounded-md px-2 py-2.5 text-center transition-all select-none cursor-pointer ";
          if (correct)        cls += "bg-green-soft border-2 border-green-deep ink";
          else if (wrong)     cls += "bg-paper-deep border-2 border-line ink-faint line-through";
          else if (picked)    cls += "bg-ink border-2 border-ink text-paper pick-selected";
          else                cls += "bg-paper border-2 border-line hover:border-ink/40 hover:bg-card ink";
          if (disabled && !picked && !correct && !wrong) cls += " opacity-50 cursor-not-allowed hover:border-line hover:bg-paper";

          const label = opt.value === "T" ? "Draw" : opt.label;
          const flag = opt.value === "T" ? "🤝" : flagFor(opt.label);

          return (
            <button
              key={opt.value}
              onClick={() => !disabled && onPick(match.matchId, opt.value)}
              disabled={disabled && !picked}
              className={cls}
            >
              {flag && <span className="emoji text-[14px] leading-none">{flag}</span>}
              <span className="text-[11px] sm:text-[12px] font-semibold leading-tight line-clamp-1">
                {label}
              </span>
              {(opt.prob !== null || opt.popPct !== null) && !isFinished && (
                <span className={`font-mono text-[9.5px] tabular leading-none ${picked ? "text-paper/70" : "ink-faint"}`}>
                  {opt.prob !== null ? `${opt.prob}%` : `${opt.popPct}% picked`}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── FOOTER — points / outcome ──────────────────────── */}
      <div className={`px-4 sm:px-5 py-2.5 border-t flex items-center justify-between text-[11px] font-mono uppercase tracking-[0.14em]
        ${earnedPoints !== null ? "border-green-deep/20 bg-green-soft/50 text-green-deep"
          : lostPoints           ? "border-[color:var(--line-soft)] bg-paper-deep/30 ink-faint"
          : "border-[color:var(--line-soft)] bg-paper-deep/20 ink-faint"
        }`}>
        <span>
          {earnedPoints !== null ? `+${earnedPoints} ${earnedPoints === 1 ? "point" : "points"}`
           : lostPoints           ? "No points"
           : `${pointsValue}pt available`}
        </span>
        {!isFinished && popular && popular.total > 0 && (
          <span className="normal-case tracking-normal font-sans text-[11px]">
            {popular.total} {popular.total === 1 ? "vote" : "votes"} in
          </span>
        )}
        {isFinished && currentPick && (
          <span className="normal-case tracking-normal font-sans text-[11px]">
            {earnedPoints !== null ? "Nailed it" : "Better luck next round"}
          </span>
        )}
      </div>

    </article>
  );
}

function TeamRow({ team, score, isFinished, reverse }: {
  team: string; score: number | null; isFinished: boolean; reverse?: boolean;
}) {
  const isTBD = !team || team === "TBD";
  return (
    <div className={`flex items-center gap-2.5 min-w-0 flex-1 ${reverse ? "flex-row-reverse text-right" : ""}`}>
      <span className="emoji text-[20px] leading-none flex-shrink-0">{flagFor(team) || "⚪"}</span>
      <div className="min-w-0 flex-1">
        <p className={`font-serif text-[15px] sm:text-[16px] font-medium leading-tight truncate ${isTBD ? "ink-faint italic" : "ink"}`} style={{fontVariationSettings: '"opsz" 24'}}>
          {team || "TBD"}
        </p>
        {isFinished && score !== null && (
          <p className="font-mono text-[20px] sm:text-[22px] font-bold tabular ink leading-tight mt-0.5">
            {score}
          </p>
        )}
      </div>
    </div>
  );
}

function pickPercentage(p: { H: number; A: number; T: number; total: number } | null | undefined, key: "H" | "A" | "T"): number | null {
  if (!p || p.total === 0) return null;
  return Math.round((p[key] / p.total) * 100);
}
