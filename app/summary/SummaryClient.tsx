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

/** Deterministic 6-char slip number from a seed (stable per user+league). */
function slipNo(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(h, 31) + seed.charCodeAt(i)) >>> 0;
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  let n = h || 1;
  for (let i = 0; i < 6; i++) {
    out += chars[n % chars.length];
    n = Math.floor(n / chars.length) + (i + 1) * 97 + 13;
  }
  return out;
}

/** Pseudo-random bar widths (1–3) for a faux barcode, seeded by a string. */
function barcodeBars(seed: string): number[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  const bars: number[] = [];
  for (let i = 0; i < 54; i++) {
    h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
    bars.push((Math.abs(h) % 3) + 1);
  }
  return bars;
}

export default function SummaryClient({
  matches, userPicks, roundStates, userName, leagueName,
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
        matches:       roundMatches,
        pickedCount:   roundMatches.filter(m => pickMap.has(m.matchId)).length,
        totalCount:    roundMatches.length,
        finishedCount: finished.length,
        correctCount:  correct.length,
        missedCount:   missed.length,
        pts,
      };
    }).filter(rd => rd.totalCount > 0);
  }, [roundStates, matches, pickMap]);

  // Totals
  const totalPts      = roundData.reduce((s, r) => s + r.pts, 0);
  const totalPicked   = roundData.reduce((s, r) => s + r.pickedCount, 0);
  const totalMatches  = roundData.reduce((s, r) => s + r.totalCount, 0);
  const totalCorrect  = roundData.reduce((s, r) => s + r.correctCount, 0);
  const totalFinished = roundData.reduce((s, r) => s + r.finishedCount, 0);
  const accuracy      = totalFinished > 0 ? Math.round((totalCorrect / totalFinished) * 100) : null;

  const settled   = totalMatches > 0 && totalFinished >= totalMatches;
  const stampText = totalFinished === 0 ? "UNSETTLED" : settled ? "SETTLED" : "PROVISIONAL";

  const slip   = slipNo(`${userName}|${leagueName}`);
  const bars   = useMemo(() => barcodeBars(`${slip}|${leagueName}`), [slip, leagueName]);
  const issued = new Date();
  const issuedDate = issued.toLocaleDateString("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" });
  const issuedTime = issued.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  function buildCopyText() {
    const lines: string[] = [
      `============================`,
      `        N U T M E G`,
      `   WORLD CUP 2026 · POOL`,
      `   OFFICIAL PICK RECEIPT`,
      `============================`,
      `PLAYER ..... ${userName}`,
      `LEAGUE ..... ${leagueName}`,
      `ISSUED ..... ${issuedDate} ${issuedTime}`,
      `SLIP NO .... #${slip}`,
      `STATUS ..... ${stampText}`,
      `----------------------------`,
    ];

    for (const rd of roundData) {
      lines.push(rd.label.toUpperCase());
      for (const m of rd.matches) {
        const pick = pickMap.get(m.matchId);
        const label = pick ? pickLabel(pick, m) : "(no pick)";
        const score = scoreStr(m);
        const isFinished = m.status === "FINISHED";
        const isCorrect  = isFinished && pick && pick === m.result;
        const isWrong    = isFinished && pick && pick !== m.result;
        const flag = isCorrect ? `  WON +${m.pointsValue}` : isWrong ? "  LOST" : "";
        const matchup = score ? `${m.homeTeam} ${score} ${m.awayTeam}` : `${m.homeTeam} v ${m.awayTeam}`;
        lines.push(`  ${matchup}`);
        lines.push(`   > ${label}${flag}`);
      }
      if (rd.finishedCount > 0) {
        lines.push(`  SUBTOTAL ......... ${rd.pts} pts`);
      } else {
        lines.push(`  PICKED ........... ${rd.pickedCount}/${rd.totalCount}`);
      }
      lines.push(`----------------------------`);
    }

    lines.push(`TOTAL ............ ${totalPts} PTS`);
    if (totalFinished > 0) lines.push(`CORRECT .......... ${totalCorrect}/${totalFinished}`);
    if (accuracy !== null) lines.push(`ACCURACY ......... ${accuracy}%`);
    lines.push(`PICKED ........... ${totalPicked}/${totalMatches}`);
    lines.push(`============================`);
    lines.push(`   *** THANK YOU ***`);
    lines.push(`  no refunds. no regrets.`);
    lines.push(`       #${slip}`);

    return lines.join("\n");
  }

  function handleCopy() {
    navigator.clipboard.writeText(buildCopyText()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    });
  }

  function handlePrint() {
    window.print();
  }

  const stampColor =
    stampText === "SETTLED" ? "var(--color-green-deep)"
    : stampText === "PROVISIONAL" ? "var(--color-gold)"
    : "var(--color-accent)";

  return (
    <div className="mx-auto max-w-[27rem]">

      {/* ── TOOLBAR (not printed) ─────────────────────────── */}
      <div className="no-print flex items-center justify-between gap-3 mb-6 anim-fade-up">
        <a href="/picks" className="inline-flex items-center gap-1.5 font-mono text-[12px] ink-faint hover:ink-soft transition-colors">
          <span>&larr;</span> Back to picks
        </a>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-card border border-line text-[12.5px] font-medium ink-soft hover:ink hover:border-ink/20 transition-all"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 6V2h8v4M4 11H3a1 1 0 01-1-1V7a1 1 0 011-1h10a1 1 0 011 1v3a1 1 0 01-1 1h-1M4 10h8v4H4z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
            </svg>
            Print
          </button>
          <button
            onClick={handleCopy}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[12.5px] font-semibold border transition-all
              ${copied
                ? "bg-green-soft border-green-deep/30 text-green-deep"
                : "bg-ink border-ink text-paper hover:bg-accent hover:border-accent"
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
                Copy slip
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── THE RECEIPT ───────────────────────────────────── */}
      <div className="receipt-paper anim-print">
        <div className="receipt-edge receipt-edge-top" />

        {/* Stamp */}
        <div
          className="rcpt-stamp absolute top-[118px] right-5 px-2.5 py-1 font-mono text-[12px] font-bold tracking-[0.16em]"
          style={{ borderColor: stampColor, color: stampColor }}
        >
          {stampText}
        </div>

        <div className="px-7 pt-7 pb-8">

          {/* ── Masthead ── */}
          <div className="text-center">
            <p className="font-mono text-[9.5px] uppercase tracking-[0.3em] ink-faint">
              Official Pick Receipt
            </p>
            <h1
              className="font-serif italic font-medium ink leading-none mt-2"
              style={{ fontSize: "40px", fontVariationSettings: '"opsz" 72' }}
            >
              Nutmeg
            </h1>
            <p className="font-mono text-[10px] uppercase tracking-[0.26em] ink-soft mt-2">
              World Cup 2026 &middot; Pool
            </p>
          </div>

          <Divider />

          {/* ── Metadata ── */}
          <div className="space-y-1.5 font-mono text-[12px] ink-soft">
            <MetaLine label="PLAYER"  value={userName} />
            <MetaLine label="LEAGUE"  value={leagueName} />
            <MetaLine label="ISSUED"  value={`${issuedDate} ${issuedTime}`} />
            <MetaLine label="SLIP NO" value={`#${slip}`} />
          </div>

          <Divider double />

          {/* ── Rounds ── */}
          <div className="space-y-5">
            {roundData.map(rd => (
              <section key={rd.round}>
                {/* Round header */}
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="font-mono text-[12px] font-bold ink uppercase tracking-[0.14em]">
                    {rd.label}
                  </h2>
                  <span className="font-mono text-[9.5px] ink-faint uppercase tracking-[0.12em]">
                    {rd.pointsValue}pt each
                  </span>
                </div>

                <div className="border-b border-dashed border-line my-2.5" />

                {!rd.isAvailable ? (
                  <p className="font-mono text-[11px] ink-faint italic py-1">
                    [ LOCKED — opens when the previous round settles ]
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {rd.matches.map(m => (
                      <PickRow
                        key={m.matchId}
                        match={m}
                        pick={pickMap.get(m.matchId) ?? null}
                      />
                    ))}
                  </div>
                )}

                {/* Round subtotal */}
                <div className="mt-3">
                  {rd.finishedCount > 0 ? (
                    <div className="rcpt-line font-mono text-[11.5px] ink-soft">
                      <span className="uppercase tracking-[0.1em]">Subtotal</span>
                      <span className="lead" />
                      <span className="ink font-bold tabular">{rd.pts} pts</span>
                    </div>
                  ) : (
                    <div className="rcpt-line font-mono text-[11.5px] ink-faint">
                      <span className="uppercase tracking-[0.1em]">Picked</span>
                      <span className="lead" />
                      <span className="tabular">{rd.pickedCount}/{rd.totalCount}</span>
                    </div>
                  )}
                </div>
              </section>
            ))}
          </div>

          <Divider double />

          {/* ── Grand total ── */}
          <div className="space-y-1.5">
            <div className="rcpt-line font-mono text-[15px]">
              <span className="font-bold ink uppercase tracking-[0.12em]">Total</span>
              <span className="lead" />
              <span className="font-bold ink tabular text-[17px]">{totalPts} PTS</span>
            </div>
            {totalFinished > 0 && (
              <div className="rcpt-line font-mono text-[11.5px] ink-soft">
                <span className="uppercase tracking-[0.1em]">Correct</span>
                <span className="lead" />
                <span className="tabular">{totalCorrect}/{totalFinished}</span>
              </div>
            )}
            {accuracy !== null && (
              <div className="rcpt-line font-mono text-[11.5px] ink-soft">
                <span className="uppercase tracking-[0.1em]">Accuracy</span>
                <span className="lead" />
                <span className="tabular">{accuracy}%</span>
              </div>
            )}
            <div className="rcpt-line font-mono text-[11.5px] ink-soft">
              <span className="uppercase tracking-[0.1em]">Picked</span>
              <span className="lead" />
              <span className="tabular">{totalPicked}/{totalMatches}</span>
            </div>
          </div>

          <Divider />

          {/* ── Footer ── */}
          <div className="text-center space-y-3 pt-1">
            <p className="font-mono text-[12px] ink tracking-[0.18em] font-bold">
              *** THANK YOU ***
            </p>
            <p className="font-mono text-[10px] ink-faint tracking-[0.06em]">
              no refunds &middot; no regrets &middot; settle every argument
            </p>

            {/* Barcode */}
            <div className="pt-2">
              <div className="flex items-end justify-center gap-[2px] h-11" aria-hidden="true">
                {bars.map((w, i) => (
                  <div
                    key={i}
                    style={{
                      width: `${w * 1.5}px`,
                      height: "100%",
                      background: i % 2 === 0 ? "var(--color-ink)" : "transparent",
                    }}
                  />
                ))}
              </div>
              <p className="font-mono text-[10px] ink-soft tracking-[0.32em] mt-1.5">
                {slip}
              </p>
            </div>
          </div>

        </div>

        <div className="receipt-edge receipt-edge-bottom" />
      </div>

      {/* Caption below the slip (not printed) */}
      <p className="no-print text-center font-mono text-[10.5px] ink-faint/70 mt-5 anim-fade-up" style={{ animationDelay: "200ms" }}>
        Your full cheat sheet &middot; copy or print to keep
      </p>

    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────── */

function Divider({ double }: { double?: boolean }) {
  if (double) {
    return (
      <div className="my-5" aria-hidden="true">
        <div className="border-t border-ink/30" />
        <div className="border-t border-ink/30 mt-[3px]" />
      </div>
    );
  }
  return <div className="my-5 border-t border-dashed border-line" aria-hidden="true" />;
}

function MetaLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rcpt-line">
      <span className="ink-faint uppercase tracking-[0.1em]">{label}</span>
      <span className="lead" />
      <span className="ink font-medium text-right truncate max-w-[60%]">{value}</span>
    </div>
  );
}

function PickRow({ match, pick }: {
  match: Match;
  pick: MatchResult;
}) {
  const isFinished = match.status === "FINISHED";
  const isLive     = match.status === "IN_PLAY" || match.status === "LIVE" || match.status === "PAUSED";
  const isCorrect  = isFinished && !!pick && pick === match.result;
  const isWrong    = isFinished && !!pick && pick !== match.result;
  const notPicked  = !pick;

  const label = pick ? pickLabel(pick, match) : "no pick";
  const score = scoreStr(match);

  const date = new Date(match.kickoffUtc).toLocaleDateString("en-CA", {
    month: "short", day: "numeric",
  });

  // Status chunk on the right of the pick line
  let status: React.ReactNode;
  if (isCorrect)      status = <span className="text-green-deep font-bold">WON +{match.pointsValue}</span>;
  else if (isWrong)   status = <span className="text-accent font-bold">LOST</span>;
  else if (isLive)    status = <span className="text-gold font-bold">LIVE</span>;
  else if (notPicked && isFinished) status = <span className="ink-faint/60">MISSED</span>;
  else                status = <span className="ink-faint/50">open</span>;

  return (
    <div className="font-mono text-[12px] leading-tight">
      {/* Matchup line */}
      <div className="flex items-baseline gap-2">
        <span className="ink-faint/60 text-[10px] tabular w-[44px] flex-shrink-0">{date}</span>
        <span className="ink-soft truncate">
          {match.homeTeam}
          {score
            ? <span className="ink font-semibold mx-1 tabular">{score}</span>
            : <span className="ink-faint/50 mx-1">v</span>}
          {match.awayTeam}
        </span>
      </div>
      {/* Pick line with leader dots + status */}
      <div className="rcpt-line mt-1 pl-[52px]">
        <span className={`flex-shrink-0
          ${isCorrect ? "text-green-deep font-semibold"
          : isWrong ? "text-accent font-semibold"
          : notPicked ? "ink-faint/50 italic"
          : "ink font-medium"}`}
        >
          &rsaquo; {label}
        </span>
        <span className="lead" />
        <span className="flex-shrink-0 text-[10.5px] tracking-[0.06em] uppercase">{status}</span>
      </div>
    </div>
  );
}
