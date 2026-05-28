"use client";
import { useState, useMemo } from "react";
import type { Match, Pick, RoundState, MatchResult } from "@/lib/types";

interface Props {
  matches: Match[];
  userPicks: Pick[];
  roundStates: RoundState[];
  userName: string;
  leagueName: string;
}

function pickLabel(pick: MatchResult, match: Match): string {
  if (!pick) return "";
  if (pick === "H") return match.homeTeam;
  if (pick === "A") return match.awayTeam;
  return "Draw";
}

function scoreStr(m: Match) {
  if (m.homeScore === null || m.awayScore === null) return null;
  return `${m.homeScore}–${m.awayScore}`;
}

export default function SummaryClient({
  matches, userPicks, roundStates, leagueName,
}: Props) {
  const [copied, setCopied] = useState(false);

  const pickMap = useMemo(() => {
    const map = new Map<string, MatchResult>();
    for (const p of userPicks) map.set(p.matchId, p.pick);
    return map;
  }, [userPicks]);

  // Build per-round data
  const roundData = useMemo(() => {
    return roundStates.map(rs => {
      const roundMatches = matches
        .filter(m => m.round === rs.round && !(m.homeTeam === "TBD" && m.awayTeam === "TBD"))
        .sort((a, b) => new Date(a.kickoffUtc).getTime() - new Date(b.kickoffUtc).getTime());

      const finished  = roundMatches.filter(m => m.status === "FINISHED");
      const correct   = finished.filter(m => {
        const p = pickMap.get(m.matchId);
        return p && p === m.result;
      });
      const pts = correct.reduce((s, m) => s + m.pointsValue, 0);
      const missed = finished.filter(m => !pickMap.has(m.matchId));

      return {
        ...rs,
        matches:      roundMatches,
        pickedCount:  roundMatches.filter(m => pickMap.has(m.matchId)).length,
        totalCount:   roundMatches.length,
        finishedCount: finished.length,
        correctCount: correct.length,
        missedCount:  missed.length,
        pts,
      };
    }).filter(rd => rd.totalCount > 0);
  }, [roundStates, matches, pickMap]);

  // Totals for the summary bar
  const totalPts      = roundData.reduce((s, r) => s + r.pts, 0);
  const totalPicked   = roundData.reduce((s, r) => s + r.pickedCount, 0);
  const totalMatches  = roundData.reduce((s, r) => s + r.totalCount, 0);
  const totalCorrect  = roundData.reduce((s, r) => s + r.correctCount, 0);
  const totalFinished = roundData.reduce((s, r) => s + r.finishedCount, 0);

  function buildCopyText() {
    const today = new Date().toLocaleDateString("en-CA", {
      year: "numeric", month: "long", day: "numeric",
    });
    const lines: string[] = [
      `Nutmeg — My Picks`,
      `League: ${leagueName}`,
      `Exported: ${today}`,
      ``,
    ];

    if (totalFinished > 0) {
      lines.push(`Overall: ${totalPts} pts · ${totalCorrect}/${totalFinished} correct · ${totalPicked}/${totalMatches} picked`);
      lines.push(``);
    }

    for (const rd of roundData) {
      lines.push(rd.label.toUpperCase());
      if (rd.finishedCount > 0) {
        lines.push(`${rd.pts} pts · ${rd.correctCount}/${rd.finishedCount} correct · ${rd.pickedCount}/${rd.totalCount} picked`);
      } else {
        lines.push(`${rd.pickedCount}/${rd.totalCount} picked`);
      }

      for (const m of rd.matches) {
        const pick = pickMap.get(m.matchId);
        const label = pick ? pickLabel(pick, m) : "(not picked)";
        const score = scoreStr(m);
        const isFinished = m.status === "FINISHED";
        const isCorrect  = isFinished && pick && pick === m.result;
        const isWrong    = isFinished && pick && pick !== m.result;
        const flag = isCorrect ? " ✓" : isWrong ? " ✗" : "";
        const matchup = score
          ? `${m.homeTeam} ${score} ${m.awayTeam}`
          : `${m.homeTeam} vs ${m.awayTeam}`;
        lines.push(`  ${matchup.padEnd(36)} → ${label}${flag}`);
      }
      lines.push(``);
    }

    return lines.join("\n");
  }

  function handleCopy() {
    navigator.clipboard.writeText(buildCopyText()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    });
  }

  return (
    <div className="space-y-10 max-w-2xl">

      {/* ── HEADER ──────────────────────────────────────── */}
      <header className="flex items-start justify-between gap-4 anim-fade-up">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] ink-faint mb-3">
            My picks &middot; {leagueName}
          </p>
          <h1
            className="font-serif font-medium ink leading-tight tracking-[-0.02em]"
            style={{ fontSize: "clamp(2rem,5vw,2.75rem)", fontVariationSettings: '"opsz" 80' }}
          >
            Pick <span className="italic text-accent">summary.</span>
          </h1>
          <p className="mt-2 text-[14px] ink-soft max-w-sm">
            Your full cheat sheet for the 2026 World Cup.
          </p>
        </div>

        {/* Copy button */}
        <button
          onClick={handleCopy}
          className={`flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-medium border transition-all duration-200
            ${copied
              ? "bg-green-soft border-green-deep/30 text-green-deep"
              : "bg-card border-line ink-soft hover:ink hover:border-ink/20"
            }`}
        >
          {copied ? (
            <>
              <svg className="h-3.5 w-3.5" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M2 7l4 4 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg className="h-3.5 w-3.5" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <rect x="1" y="4" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
                <path d="M4 4V2.5A1.5 1.5 0 015.5 1h6A1.5 1.5 0 0113 2.5v6A1.5 1.5 0 0111.5 10H10" stroke="currentColor" strokeWidth="1.4"/>
              </svg>
              Copy picks
            </>
          )}
        </button>
      </header>

      {/* ── SUMMARY BAR ─────────────────────────────────── */}
      {totalFinished > 0 && (
        <div className="grid grid-cols-3 gap-3 anim-fade-up" style={{ animationDelay: "60ms" }}>
          {[
            { label: "Points",   value: String(totalPts) },
            { label: "Correct",  value: `${totalCorrect}/${totalFinished}` },
            { label: "Picked",   value: `${totalPicked}/${totalMatches}` },
          ].map(s => (
            <div key={s.label} className="bg-card border border-line rounded-lg px-4 py-3 text-center shadow-paper">
              <div
                className="font-serif font-medium ink tabular leading-none"
                style={{ fontSize: "22px", fontVariationSettings: '"opsz" 60' }}
              >
                {s.value}
              </div>
              <p className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.18em] ink-faint">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── ROUND SECTIONS ──────────────────────────────── */}
      <div className="space-y-8">
        {roundData.map((rd, i) => (
          <section
            key={rd.round}
            className="anim-fade-up"
            style={{ animationDelay: `${i * 40}ms` }}
          >
            {/* Round header */}
            <div className="flex items-baseline justify-between gap-3 pb-3 border-b border-line mb-1">
              <div>
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] ink-faint mr-3">
                  {rd.label}
                </span>
                <span className="text-[12px] ink-soft">
                  {rd.finishedCount > 0
                    ? <><span className="font-semibold ink">{rd.pts} pts</span> &middot; {rd.correctCount}/{rd.finishedCount} correct &middot; {rd.pickedCount}/{rd.totalCount} picked</>
                    : <>{rd.pickedCount}/{rd.totalCount} picked</>
                  }
                </span>
              </div>
              {rd.pickedCount === rd.totalCount && rd.totalCount > 0 && (
                <span className="font-mono text-[9.5px] text-green-deep/60 flex-shrink-0">All picked ✓</span>
              )}
            </div>

            {/* Match rows */}
            {!rd.isAvailable ? (
              <p className="py-3 text-[13px] ink-faint italic font-serif" style={{ fontVariationSettings: '"opsz" 24' }}>
                Locked — opens once the previous round completes.
              </p>
            ) : (
              <div>
                {rd.matches.map(m => (
                  <PickRow
                    key={m.matchId}
                    match={m}
                    pick={pickMap.get(m.matchId) ?? null}
                    pointsValue={rd.pointsValue}
                  />
                ))}
              </div>
            )}
          </section>
        ))}
      </div>

      {/* ── FOOTER LINK ─────────────────────────────────── */}
      <div className="pt-2 flex items-center gap-5 text-[12.5px]">
        <a href="/picks" className="ink-faint hover:ink-soft transition-colors font-mono">
          ← Back to picks
        </a>
        <button
          onClick={handleCopy}
          className="ink-faint hover:text-accent transition-colors font-mono"
        >
          {copied ? "Copied ✓" : "Copy as text"}
        </button>
      </div>

    </div>
  );
}

/* ── Pick row ─────────────────────────────────────────── */

function PickRow({ match, pick, pointsValue }: {
  match: Match;
  pick: MatchResult;
  pointsValue: number;
}) {
  const isFinished = match.status === "FINISHED";
  const isLive     = match.status === "IN_PLAY" || match.status === "LIVE" || match.status === "PAUSED";
  const isCorrect  = isFinished && !!pick && pick === match.result;
  const isWrong    = isFinished && !!pick && pick !== match.result;
  const notPicked  = !pick;

  const label = pick ? pickLabel(pick, match) : null;
  const score = scoreStr(match);

  const date = new Date(match.kickoffUtc).toLocaleDateString("en-CA", {
    month: "short", day: "numeric",
  });

  return (
    <div className={`flex items-center gap-2 sm:gap-3 py-2 px-3 -mx-3 rounded-md text-[12.5px] transition-colors group
      ${isCorrect ? "bg-green-soft/20" : isWrong ? "bg-accent-soft/15" : "hover:bg-paper-deep/50"}`}
    >
      {/* Date */}
      <span className="font-mono text-[10px] ink-faint/50 w-11 flex-shrink-0 tabular">{date}</span>

      {/* Teams */}
      <span className="flex-1 min-w-0 truncate">
        <span className="ink-soft">{match.homeTeam}</span>
        {score
          ? <span className="font-mono text-[10.5px] ink-faint/60 mx-1.5">{score}</span>
          : <span className="ink-faint/40 mx-1.5 text-[11px]">vs</span>
        }
        <span className="ink-soft">{match.awayTeam}</span>
      </span>

      {/* Arrow */}
      <span className="ink-faint/25 flex-shrink-0 hidden sm:inline">→</span>

      {/* Pick */}
      <span className={`flex-shrink-0 text-right font-medium min-w-[80px] sm:min-w-[100px] truncate
        ${isCorrect  ? "text-green-deep"
        : isWrong    ? "text-accent"
        : notPicked  ? "ink-faint/35 italic font-normal"
        : "ink"}`}
      >
        {label ?? "not picked"}
      </span>

      {/* Status badge */}
      <span className="flex-shrink-0 w-12 text-right font-mono text-[10px]">
        {isCorrect && (
          <span className="text-green-deep font-semibold">✓ +{pointsValue}</span>
        )}
        {isWrong && (
          <span className="text-accent">✗</span>
        )}
        {isLive && (
          <span className="text-gold font-semibold">live</span>
        )}
        {!isFinished && !isLive && !notPicked && (
          <span className="ink-faint/30">—</span>
        )}
        {isFinished && notPicked && (
          <span className="ink-faint/30">missed</span>
        )}
      </span>
    </div>
  );
}
