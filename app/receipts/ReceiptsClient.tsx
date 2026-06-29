"use client";
import { useState, useMemo } from "react";
import type { Match, Pick, BracketPick, RoundState, MatchResult } from "@/lib/types";
import { ROUND_CONFIG } from "@/lib/constants";
import {
  isKnockoutRound, nodesInRound, participantsOf, orderedR32Matches,
  type KnockoutRound,
} from "@/lib/services/bracket";
import { computeActualAdvancers, computeDecidedTeams, knockoutRoundDecided } from "@/lib/services/scoring";

interface Props {
  matches: Match[];
  userPicks: Pick[];
  userBracketPicks: BracketPick[];
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

/**
 * A group match is settled (eligible for WON/LOST) only once it's FINISHED AND a
 * result has been recorded. football-data can briefly flip a match to FINISHED
 * before the result/score lands; until `result` exists the pick is still pending,
 * not a loss. Mirrors the leaderboard guard in scoring.ts.
 */
function isSettled(m: Match): boolean {
  return m.status === "FINISHED" && m.result != null;
}

/** Decimal → American odds, matching the pick card (e.g. +140, -182). */
function toAmerican(decimal: number): string {
  if (decimal >= 2) return `+${Math.round((decimal - 1) * 100)}`;
  return `${Math.round(-100 / (decimal - 1))}`;
}

/** Deterministic 6-char slip number from a seed (stable per user+league+round). */
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

/**
 * One knockout bracket node, flattened for the receipt: the matchup the user is
 * predicting (participants resolved from their own upstream picks) plus their
 * chosen advancer and whether it actually advanced (advancement-based scoring).
 */
type BracketItem = {
  nodeId: string;
  teamA: string | null;
  teamB: string | null;
  pickedTeam: string | null;
  odds: number | null;
  advanced: boolean;     // pickedTeam actually advanced from this round
  eliminated: boolean;   // pickedTeam's own match finished and it did NOT advance
};

type RoundDatum = RoundState & {
  kind: "group" | "knockout";
  matches: Match[];           // group rounds only ([] for knockout)
  bracketItems: BracketItem[]; // knockout rounds only ([] for group)
  decided: boolean;           // round fully resolved (scored/locked-in)
  pickedCount: number;
  totalCount: number;
  finishedCount: number;
  correctCount: number;
  missedCount: number;
  pts: number;
};

function roundPhase(rd: RoundDatum): "locked" | "open" | "running" | "settled" {
  if (!rd.isAvailable) return "locked";
  if (rd.decided) return "settled";          // whole round resolved
  if (rd.finishedCount === 0) return "open";  // nothing settled yet
  return "running";                           // some games in, round not complete
}

const STAMP_TEXT: Record<ReturnType<typeof roundPhase>, string> = {
  locked: "PENDING",
  open: "UNSETTLED",
  running: "PROVISIONAL",
  settled: "SETTLED",
};

export default function ReceiptsClient({
  matches, userPicks, userBracketPicks, roundStates, userName, leagueName,
}: Props) {
  const [copied, setCopied] = useState(false);

  const pickMap = useMemo(() => {
    const map = new Map<string, MatchResult>();
    for (const p of userPicks) map.set(p.matchId, p.pick);
    return map;
  }, [userPicks]);

  // Odds snapshotted at the moment each pick was made (null if unknown)
  const oddsMap = useMemo(() => {
    const map = new Map<string, number | null>();
    for (const p of userPicks) map.set(p.matchId, p.odds ?? null);
    return map;
  }, [userPicks]);

  // ── Knockout bracket inputs ───────────────────────────────────────────────
  // Knockout predictions live in bracket_picks (one row per node), scored by
  // advancement: a node's chosen team earns its round's points if that team
  // actually advanced from the round.
  const r32Slots  = useMemo(() => orderedR32Matches(matches), [matches]);
  const advancers = useMemo(() => computeActualAdvancers(matches), [matches]);
  const decidedTeams = useMemo(() => computeDecidedTeams(matches), [matches]);
  const r32Ready  = useMemo(() => r32Slots.some(m => m !== null), [r32Slots]);
  const bracketByNode = useMemo(() => {
    const m: Record<string, string> = {};
    for (const bp of userBracketPicks) m[bp.nodeId] = bp.team;
    return m;
  }, [userBracketPicks]);
  const bracketOddsByNode = useMemo(() => {
    const m = new Map<string, number | null>();
    for (const bp of userBracketPicks) m.set(bp.nodeId, bp.odds ?? null);
    return m;
  }, [userBracketPicks]);

  // Per-round data — group rounds with determined matches, plus the knockout
  // bracket rounds once the bracket has unlocked (R32 matchups are known).
  const roundData = useMemo<RoundDatum[]>(() => {
    return roundStates.map<RoundDatum>(rs => {
      // ── Knockout rounds: read from the bracket ──────────────────────────
      if (isKnockoutRound(rs.round)) {
        const round = rs.round as KnockoutRound;
        const decided  = knockoutRoundDecided(round, matches);
        const advanced = advancers[round];
        const settled  = decidedTeams[round];
        const items: BracketItem[] = nodesInRound(round).map(node => {
          const [a, b] = participantsOf(node.id, bracketByNode, r32Slots);
          const picked = bracketByNode[node.id] ?? null;
          const didAdvance = !!picked && advanced.has(picked);
          return {
            nodeId:     node.id,
            teamA:      a,
            teamB:      b,
            pickedTeam: picked,
            odds:       bracketOddsByNode.get(node.id) ?? null,
            advanced:   didAdvance,
            // Resolved as a loss the moment the picked team's own game ends
            // without it advancing — no need to wait for the whole round.
            eliminated: !!picked && !didAdvance && settled.has(picked),
          };
        });
        const totalCount   = items.length;
        const pickedCount  = items.filter(i => i.pickedTeam).length;
        // Per-game: a pick is correct once its team advances, wrong once its
        // team is eliminated — both known from that single game, not the round.
        const correctCount = items.filter(i => i.advanced).length;
        const wrongCount   = items.filter(i => i.eliminated).length;

        return {
          ...rs,
          isAvailable:   r32Ready, // the whole bracket unlocks together at R32
          kind:          "knockout",
          matches:       [],
          bracketItems:  items,
          decided,
          pickedCount,
          totalCount,
          finishedCount: correctCount + wrongCount, // resolved picks so far
          correctCount,
          missedCount:   decided ? items.filter(i => !i.pickedTeam).length : 0,
          pts:           correctCount * rs.pointsValue,
        };
      }

      // ── Group stage: per-match picks (unchanged) ────────────────────────
      const roundMatches = matches
        .filter(m => m.round === rs.round && !(m.homeTeam === "TBD" && m.awayTeam === "TBD"))
        .sort((a, b) => new Date(a.kickoffUtc).getTime() - new Date(b.kickoffUtc).getTime());

      const finished  = roundMatches.filter(isSettled);
      const correct   = finished.filter(m => {
        const p = pickMap.get(m.matchId);
        return p && p === m.result;
      });
      const pts = correct.reduce((s, m) => s + m.pointsValue, 0);
      const missed = finished.filter(m => !pickMap.has(m.matchId));

      return {
        ...rs,
        kind:          "group",
        matches:       roundMatches,
        bracketItems:  [],
        decided:       roundMatches.length > 0 && finished.length === roundMatches.length,
        pickedCount:   roundMatches.filter(m => pickMap.has(m.matchId)).length,
        totalCount:    roundMatches.length,
        finishedCount: finished.length,
        correctCount:  correct.length,
        missedCount:   missed.length,
        pts,
      };
    }).filter(rd => rd.kind === "knockout" ? r32Ready : rd.totalCount > 0);
  }, [roundStates, matches, pickMap, advancers, decidedTeams, bracketByNode, bracketOddsByNode, r32Slots, r32Ready]);

  // Active round — default to the open round if any, else the first
  const initialRound = (roundData.find(r => r.isOpen) ?? roundData[0])?.round ?? "GROUP";
  const [activeRoundKey, setActiveRoundKey] = useState<string>(initialRound);
  const active = roundData.find(r => r.round === activeRoundKey) ?? roundData[0];

  if (!active) {
    return (
      <div className="mx-auto max-w-[27rem] text-center py-20">
        <p className="font-serif italic text-[20px] ink-soft" style={{ fontVariationSettings: '"opsz" 36' }}>
          No rounds with fixtures yet. Check back once the schedule is set.
        </p>
        <a href="/picks" className="mt-6 inline-block font-mono text-[12px] ink-faint hover:ink-soft">&larr; Back to picks</a>
      </div>
    );
  }

  const activeIdx = roundData.findIndex(r => r.round === active.round);
  const phase = roundPhase(active);
  const stampText = STAMP_TEXT[phase];
  const accuracy  = active.finishedCount > 0 ? Math.round((active.correctCount / active.finishedCount) * 100) : null;

  const slip   = slipNo(`${userName}|${leagueName}|${active.round}`);
  const bars   = barcodeBars(`${slip}|${active.round}`);
  const issued = new Date();
  const issuedDate = issued.toLocaleDateString("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" });
  const issuedTime = issued.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  const stampColor =
    phase === "settled" ? "var(--color-green-deep)"
    : phase === "running" ? "var(--color-gold)"
    : phase === "locked" ? "var(--color-ink-faint)"
    : "var(--color-accent)";

  function buildCopyText(rd: RoundDatum) {
    const lines: string[] = [
      `============================`,
      `        N U T M E G`,
      `   WORLD CUP 2026 · POOL`,
      `   ${rd.label.toUpperCase()} RECEIPT`,
      `============================`,
      `PLAYER ..... ${userName}`,
      `LEAGUE ..... ${leagueName}`,
      `ROUND ...... ${rd.label}`,
      `ISSUED ..... ${issuedDate} ${issuedTime}`,
      `SLIP NO .... #${slipNo(`${userName}|${leagueName}|${rd.round}`)}`,
      `STATUS ..... ${STAMP_TEXT[roundPhase(rd)]}`,
      `----------------------------`,
    ];

    if (rd.kind === "knockout") {
      for (const item of rd.bracketItems) {
        const picked  = item.pickedTeam;
        const label   = picked ?? "(no pick)";
        const oddsStr = picked && item.odds ? ` (${toAmerican(item.odds)})` : "";
        const isCorrect = picked && item.advanced;
        const isWrong   = picked && item.eliminated;
        const flag = isCorrect ? `  WON +${rd.pointsValue}` : isWrong ? "  LOST" : "";
        const matchup = `${item.teamA ?? "TBD"} v ${item.teamB ?? "TBD"}`;
        lines.push(`  ${matchup}`);
        lines.push(`   > ${label}${oddsStr}${flag}`);
      }
    } else {
      for (const m of rd.matches) {
        const pick = pickMap.get(m.matchId);
        const label = pick ? pickLabel(pick, m) : "(no pick)";
        const odds = oddsMap.get(m.matchId);
        const oddsStr = pick && odds ? ` (${toAmerican(odds)})` : "";
        const score = scoreStr(m);
        const settled = isSettled(m);
        const isCorrect  = settled && pick && pick === m.result;
        const isWrong    = settled && pick && pick !== m.result;
        const flag = isCorrect ? `  WON +${m.pointsValue}` : isWrong ? "  LOST" : "";
        const matchup = score ? `${m.homeTeam} ${score} ${m.awayTeam}` : `${m.homeTeam} v ${m.awayTeam}`;
        lines.push(`  ${matchup}`);
        lines.push(`   > ${label}${oddsStr}${flag}`);
      }
    }

    lines.push(`----------------------------`);
    if (rd.finishedCount > 0) {
      lines.push(`ROUND TOTAL ...... ${rd.pts} PTS`);
      lines.push(`CORRECT .......... ${rd.correctCount}/${rd.finishedCount}`);
      const acc = Math.round((rd.correctCount / rd.finishedCount) * 100);
      lines.push(`ACCURACY ......... ${acc}%`);
    }
    lines.push(`PICKED ........... ${rd.pickedCount}/${rd.totalCount}`);
    lines.push(`============================`);
    lines.push(`   *** THANK YOU ***`);
    lines.push(`  no refunds · no regrets`);
    lines.push(`       #${slipNo(`${userName}|${leagueName}|${rd.round}`)}`);
    return lines.join("\n");
  }

  function handleCopy() {
    navigator.clipboard.writeText(buildCopyText(active)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    });
  }

  function handlePrint() {
    window.print();
  }

  function go(delta: number) {
    const next = roundData[activeIdx + delta];
    if (next) setActiveRoundKey(next.round);
  }

  return (
    <div className="mx-auto max-w-[27rem]">

      {/* ── TOOLBAR (not printed) ─────────────────────────── */}
      <div className="no-print flex items-center justify-between gap-3 mb-5 anim-fade-up">
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

      {/* ── ROUND SWITCHER (not printed) ──────────────────── */}
      <div className="no-print flex items-center gap-2 mb-6 anim-fade-up" style={{ animationDelay: "60ms" }}>
        <button
          onClick={() => go(-1)}
          disabled={activeIdx === 0}
          aria-label="Previous round"
          className="flex-shrink-0 h-8 w-8 flex items-center justify-center rounded-lg border border-line bg-card ink-soft hover:ink hover:border-ink/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all font-mono"
        >
          &lsaquo;
        </button>

        <div className="flex-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {roundData.map(rd => {
            const isActive = rd.round === active.round;
            const ph = roundPhase(rd);
            const dot =
              ph === "settled" ? "bg-green-deep"
              : ph === "running" ? "bg-gold"
              : ph === "locked" ? "bg-[color:var(--ink-faint)]/30"
              : "bg-accent";
            return (
              <button
                key={rd.round}
                onClick={() => setActiveRoundKey(rd.round)}
                className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12.5px] font-medium transition-colors
                  ${isActive ? "bg-ink text-paper" : "bg-card border border-line ink-soft hover:ink hover:border-ink/20"}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${isActive ? "bg-paper/70" : dot}`} />
                {ROUND_CONFIG[rd.round].shortLabel}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => go(1)}
          disabled={activeIdx === roundData.length - 1}
          aria-label="Next round"
          className="flex-shrink-0 h-8 w-8 flex items-center justify-center rounded-lg border border-line bg-card ink-soft hover:ink hover:border-ink/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all font-mono"
        >
          &rsaquo;
        </button>
      </div>

      {/* ── THE RECEIPT (re-prints on round change via key) ── */}
      <div key={active.round} className="receipt-paper anim-print">
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
            <MetaLine label="ROUND"   value={active.label} />
            <MetaLine label="ISSUED"  value={`${issuedDate} ${issuedTime}`} />
            <MetaLine label="SLIP NO" value={`#${slip}`} />
          </div>

          <Divider double />

          {/* ── Round banner ── */}
          <p className="text-center font-mono text-[11px] uppercase tracking-[0.2em] ink-faint mb-4">
            &mdash; {active.label} &middot; {active.pointsValue}pt each &mdash;
          </p>

          {/* ── Picks ── */}
          {!active.isAvailable ? (
            <p className="font-mono text-[11px] ink-faint italic py-2 text-center">
              [ LOCKED — opens when the previous round settles ]
            </p>
          ) : active.kind === "knockout" ? (
            <div className="space-y-2.5">
              {active.bracketItems.map(item => (
                <BracketPickRow
                  key={item.nodeId}
                  item={item}
                  decided={active.decided}
                  pointsValue={active.pointsValue}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-2.5">
              {active.matches.map(m => (
                <PickRow
                  key={m.matchId}
                  match={m}
                  pick={pickMap.get(m.matchId) ?? null}
                  odds={oddsMap.get(m.matchId) ?? null}
                />
              ))}
            </div>
          )}

          <Divider double />

          {/* ── Round total ── */}
          <div className="space-y-1.5">
            <div className="rcpt-line font-mono text-[15px]">
              <span className="font-bold ink uppercase tracking-[0.1em]">Round Total</span>
              <span className="lead" />
              <span className="font-bold ink tabular text-[17px]">{active.pts} PTS</span>
            </div>
            {active.finishedCount > 0 && (
              <div className="rcpt-line font-mono text-[11.5px] ink-soft">
                <span className="uppercase tracking-[0.1em]">Correct</span>
                <span className="lead" />
                <span className="tabular">{active.correctCount}/{active.finishedCount}</span>
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
              <span className="tabular">{active.pickedCount}/{active.totalCount}</span>
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
        One receipt per round &middot; copy or print to keep
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

function PickRow({ match, pick, odds }: {
  match: Match;
  pick: MatchResult;
  odds: number | null;
}) {
  const settled    = isSettled(match);
  const isLive     = match.status === "IN_PLAY" || match.status === "LIVE" || match.status === "PAUSED";
  const isCorrect  = settled && !!pick && pick === match.result;
  const isWrong    = settled && !!pick && pick !== match.result;
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
  else if (notPicked && settled) status = <span className="ink-faint/60">MISSED</span>;
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
          {!notPicked && odds != null && (
            <span className="ink-faint/70 font-normal tabular ml-1.5">{toAmerican(odds)}</span>
          )}
        </span>
        <span className="lead" />
        <span className="flex-shrink-0 text-[10.5px] tracking-[0.06em] uppercase">{status}</span>
      </div>
    </div>
  );
}

function BracketPickRow({ item, decided, pointsValue }: {
  item: BracketItem;
  decided: boolean;
  pointsValue: number;
}) {
  const picked    = item.pickedTeam;
  // Per-game: resolved as soon as the picked team's own match ends, not the round.
  const isCorrect = !!picked && item.advanced;
  const isWrong   = !!picked && item.eliminated;
  const notPicked = !picked;

  const label   = picked ?? "no pick";
  const teamA   = item.teamA ?? "TBD";
  const teamB   = item.teamB ?? "TBD";

  // Status chunk on the right of the pick line — mirrors the group-stage rows.
  let status: React.ReactNode;
  if (isCorrect)                  status = <span className="text-green-deep font-bold">WON +{pointsValue}</span>;
  else if (isWrong)               status = <span className="text-accent font-bold">LOST</span>;
  else if (decided && notPicked)  status = <span className="ink-faint/60">MISSED</span>;
  else if (picked)                status = <span className="ink-soft">PICKED</span>;
  else                            status = <span className="ink-faint/50">open</span>;

  return (
    <div className="font-mono text-[12px] leading-tight">
      {/* Matchup line — participants resolved from the user's own bracket */}
      <div className="flex items-baseline gap-2">
        <span className="ink-soft truncate">
          {teamA}
          <span className="ink-faint/50 mx-1">v</span>
          {teamB}
        </span>
      </div>
      {/* Pick line with leader dots + status */}
      <div className="rcpt-line mt-1 pl-3">
        <span className={`flex-shrink-0
          ${isCorrect ? "text-green-deep font-semibold"
          : isWrong ? "text-accent font-semibold"
          : notPicked ? "ink-faint/50 italic"
          : "ink font-medium"}`}
        >
          &rsaquo; {label}
          {!notPicked && item.odds != null && (
            <span className="ink-faint/70 font-normal tabular ml-1.5">{toAmerican(item.odds)}</span>
          )}
        </span>
        <span className="lead" />
        <span className="flex-shrink-0 text-[10.5px] tracking-[0.06em] uppercase">{status}</span>
      </div>
    </div>
  );
}
