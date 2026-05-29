"use client";
import { useCallback, useMemo, useState, useRef, useEffect } from "react";
import type { Match, OddsData, BracketPick } from "@/lib/types";
import { ROUND_CONFIG } from "@/lib/constants";
import {
  KNOCKOUT_ROUNDS, type KnockoutRound, nodesInRound, parentOf,
  orderedR32Matches, participantsOf, BRACKET_NODE_MAP,
} from "@/lib/services/bracket";
import { computeActualAdvancers, knockoutRoundDecided } from "@/lib/services/scoring";
import Flag from "@/components/Flag";

interface Props {
  matches: Match[];
  odds: OddsData[];
  userBracketPicks: BracketPick[];
  available: boolean;
  locked: boolean;
  deadline: string | null;
  /** Dev sandbox: keep all state local, never hit the save API. */
  sandbox?: boolean;
}

const TOTAL_NODES = 31; // 16 + 8 + 4 + 2 + 1

const COLUMN_LABEL: Record<KnockoutRound, string> = {
  ROUND_OF_32:    "Round of 32",
  ROUND_OF_16:    "Round of 16",
  QUARTER_FINALS: "Quarterfinals",
  SEMI_FINALS:    "Semifinals",
  FINAL:          "Final",
};
const SHORT_LABEL: Record<KnockoutRound, string> = {
  ROUND_OF_32:    "R32",
  ROUND_OF_16:    "R16",
  QUARTER_FINALS: "QF",
  SEMI_FINALS:    "SF",
  FINAL:          "F",
};
// Minimap density (bars) per round — echoes Apple's column-shape scrubber.
const RAIL_BARS: Record<KnockoutRound, number> = {
  ROUND_OF_32: 5, ROUND_OF_16: 4, QUARTER_FINALS: 3, SEMI_FINALS: 2, FINAL: 1,
};

// Column widths — final is a touch narrower since it holds a single match.
const COL_W = 188;
const COL_W_FINAL = 200;
const CONN_W = 34;

function fmtKick(iso: string): string {
  const d = new Date(iso);
  const day  = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${day} · ${time}`;
}

export default function BracketBoard({
  matches, odds, userBracketPicks, available, locked, deadline, sandbox = false,
}: Props) {
  const r32Slots = useMemo(() => orderedR32Matches(matches), [matches]);
  const oddsMap = useMemo(() => new Map(odds.map(o => [o.matchId, o])), [odds]);
  const advancers = useMemo(() => computeActualAdvancers(matches), [matches]);
  const decided = useMemo(() => {
    const d = {} as Record<KnockoutRound, boolean>;
    for (const r of KNOCKOUT_ROUNDS) d[r] = knockoutRoundDecided(r, matches);
    return d;
  }, [matches]);

  const [bracket, setBracket] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const bp of userBracketPicks) init[bp.nodeId] = bp.team;
    return init;
  });
  const [error, setError] = useState<string | null>(null);
  const [activeRound, setActiveRound] = useState<KnockoutRound>("ROUND_OF_32");

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const colRefs   = useRef<Record<string, HTMLDivElement | null>>({});

  const r32Ready = r32Slots.some(m => m !== null);

  // ── Scroll-spy: highlight the round that's currently scrolled into view ────
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const obs = new IntersectionObserver(
      entries => {
        const inView = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.left - b.boundingClientRect.left);
        const r = inView[0]?.target.getAttribute("data-round") as KnockoutRound | null;
        if (r) setActiveRound(r);
      },
      { root, threshold: 0.01, rootMargin: "0px -55% 0px 0px" }
    );
    for (const el of Object.values(colRefs.current)) if (el) obs.observe(el);
    return () => obs.disconnect();
  }, [available, r32Ready]);

  const scrollToRound = useCallback((r: KnockoutRound) => {
    setActiveRound(r);
    const col = colRefs.current[r];
    const cont = scrollRef.current;
    if (col && cont) {
      // Scroll the pane itself (not scrollIntoView, which yanks the whole page).
      // Bring the column to the left edge and its first match toward the top —
      // later rounds sit centered far down the tall tree, so horizontal-only
      // scrolling would leave the viewport on empty space.
      const cr = cont.getBoundingClientRect();
      const left = col.getBoundingClientRect().left - cr.left + cont.scrollLeft;
      const firstCard = col.querySelector(".bkt-card");
      const top = firstCard
        ? firstCard.getBoundingClientRect().top - cr.top + cont.scrollTop
        : cont.scrollTop;
      cont.scrollTo({ left: Math.max(0, left - 10), top: Math.max(0, top - 8), behavior: "smooth" });
    }
  }, []);

  const save = useCallback(async (next: Record<string, string>) => {
    if (sandbox) return; // dev sandbox — local state only, no persistence
    setError(null);
    try {
      const res = await fetch("/api/bracket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bracket: next }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Couldn’t save your bracket");
        return;
      }
      const d = await res.json().catch(() => ({}));
      if (d?.bracket && typeof d.bracket === "object") {
        setBracket(d.bracket as Record<string, string>);
      }
    } catch {
      setError("Network hiccup — bracket not saved");
    }
  }, [sandbox]);

  const pick = useCallback((nodeId: string, team: string) => {
    if (locked) return;
    setBracket(prev => {
      const next: Record<string, string> = { ...prev };
      if (next[nodeId] === team) delete next[nodeId];
      else next[nodeId] = team;

      // Cascade up: clear any ancestor whose winner is no longer a participant.
      let cur: string | null = nodeId;
      while (cur) {
        const parent = parentOf(cur);
        if (!parent) break;
        const [a, b] = participantsOf(parent, next, r32Slots);
        const chosen = next[parent];
        if (chosen && chosen !== a && chosen !== b) delete next[parent];
        cur = parent;
      }

      save(next);
      return next;
    });
  }, [locked, r32Slots, save]);

  const filledCount = Object.keys(bracket).length;
  const champion = bracket["F-1"] ?? null;
  const championDecided = decided.FINAL && champion ? advancers.FINAL.has(champion) : false;
  const pct = (filledCount / TOTAL_NODES) * 100;

  // ── Not open yet ─────────────────────────────────────────────────────────
  if (!available || !r32Ready) {
    return (
      <div className="bg-card border border-line border-dashed rounded-md p-12 text-center shadow-paper anim-fade-up">
        <div className="text-[34px] mb-3">🗺️</div>
        <p className="font-serif italic text-[20px] ink-soft leading-snug max-w-md mx-auto" style={{ fontVariationSettings: '"opsz" 40' }}>
          &ldquo;The knockout bracket unlocks the moment the group stage wraps. Then you’ll fill it out — Round of 32 all the way to lifting the trophy — in one sitting.&rdquo;
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 anim-fade-up">
      {error && (
        <div className="rounded-md border border-[color:var(--accent)]/30 bg-accent-soft px-5 py-3.5 text-[13.5px] text-accent flex items-center gap-2">
          <span className="font-mono">!</span>
          <span>{error}</span>
        </div>
      )}

      {/* ── Header: progress + champion ───────────────────────────────────── */}
      <div className="bg-card border border-line rounded-xl p-5 shadow-paper">
        <div className="flex items-start justify-between gap-5 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-accent mb-1.5">
              Knockout Bracket
            </p>
            <p className="font-serif italic text-[16px] ink leading-snug max-w-2xl" style={{ fontVariationSettings: '"opsz" 32' }}>
              {locked
                ? "The bracket is locked. Watch it play out, round by round."
                : "Pick every winner from the Round of 32 to the Final. Each winner advances automatically."}
            </p>
          </div>

          {/* Champion plate */}
          <div
            className={`champion-plate flex-shrink-0 flex items-center gap-3 rounded-lg border px-4 py-2.5
              ${champion ? "border-gold/45 bg-gold-soft/40" : "border-dashed border-line bg-paper-deep/40"}`}
          >
            <span className="text-[22px] leading-none">🏆</span>
            <div className="leading-tight">
              <p className="font-mono text-[9px] uppercase tracking-[0.18em] ink-faint">Your champion</p>
              {champion ? (
                <span className={`inline-flex items-center gap-1.5 font-serif font-medium text-[16px] leading-snug ${championDecided ? "text-green-deep" : "ink"}`} style={{ fontVariationSettings: '"opsz" 24' }}>
                  <Flag team={champion} size={16} />
                  {champion}
                  {championDecided && <span className="font-mono text-[10px]">✓</span>}
                </span>
              ) : (
                <span className="font-serif italic text-[15px] ink-faint" style={{ fontVariationSettings: '"opsz" 24' }}>
                  Undecided
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="mt-4 flex items-center gap-3">
          <div className="h-1.5 flex-1 rounded-full bg-paper-deep overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${pct === 100 ? "bg-green-deep" : "bg-accent"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="font-serif font-medium ink leading-none tabular flex-shrink-0" style={{ fontSize: "15px", fontVariationSettings: '"opsz" 24' }}>
            {filledCount}<span className="ink-faint">/{TOTAL_NODES}</span>
          </span>
        </div>

        <p className="mt-2.5 text-[11.5px] ink-faint">
          {locked
            ? "Picks locked — Round of 32 has begun"
            : deadline
              ? `All picks lock ${new Date(deadline).toLocaleString("en-CA", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
              : "Open — fill out your whole bracket"}
        </p>
      </div>

      {/* ── Round rail (Apple-style segmented scrubber) ───────────────────── */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1 py-0.5">
        {KNOCKOUT_ROUNDS.map(round => {
          const isActive = activeRound === round;
          const isDone   = decided[round];
          return (
            <button
              key={round}
              onClick={() => scrollToRound(round)}
              aria-pressed={isActive}
              className={`group flex-shrink-0 flex items-center gap-2.5 rounded-lg border pl-2.5 pr-3.5 py-2 transition-all
                ${isActive
                  ? "bg-ink text-paper border-ink shadow-paper"
                  : "bg-card border-line ink-soft hover:ink hover:border-[color:var(--ink-faint)]/40"}`}
            >
              {/* Minimap density bars */}
              <span className="bkt-rail-bars h-5 w-4">
                {Array.from({ length: RAIL_BARS[round] }).map((_, i) => (
                  <span
                    key={i}
                    className="bkt-rail-bar"
                    style={{ width: `${100 - i * 12}%` }}
                  />
                ))}
              </span>
              <span className="text-left leading-none">
                <span className="block text-[13px] font-medium">{SHORT_LABEL[round]}</span>
                <span className={`block font-mono text-[9px] mt-0.5 ${isActive ? "text-paper/55" : "ink-faint"}`}>
                  {ROUND_CONFIG[round].pointsValue}&nbsp;pts
                </span>
              </span>
              {isDone && (
                <span className={`font-mono text-[10px] ${isActive ? "text-paper/70" : "text-green-deep"}`}>✓</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Bracket tree ──────────────────────────────────────────────────── */}
      <div
        ref={scrollRef}
        className="overflow-auto -mx-1 px-1 rounded-xl border border-line bg-paper/40"
        style={{ maxHeight: "min(72vh, 760px)", scrollSnapType: "x proximity" }}
      >
        <div className="bkt-tree py-3 pr-3">
          {KNOCKOUT_ROUNDS.map((round, ri) => {
            const isFinal = round === "FINAL";
            const colWidth = isFinal ? COL_W_FINAL : COL_W;
            return (
              <div key={round} className="contents">
                {/* Round column */}
                <div
                  ref={el => { colRefs.current[round] = el; }}
                  data-round={round}
                  className="bkt-col"
                  style={{ width: colWidth, scrollSnapAlign: "start" }}
                >
                  {nodesInRound(round).map(node => {
                    const [a, b] = participantsOf(node.id, bracket, r32Slots);
                    const m = round === "ROUND_OF_32" ? r32Slots[node.matchSlot ?? -1] ?? null : null;
                    const o = m ? oddsMap.get(m.matchId) ?? null : null;
                    return (
                      <div key={node.id} className="bkt-cell">
                        <BracketMatch
                          teamA={a}
                          teamB={b}
                          realMatch={m}
                          odds={o}
                          chosen={bracket[node.id] ?? null}
                          locked={locked}
                          decided={decided[round]}
                          advanced={advancers[round]}
                          isFinal={isFinal}
                          onPick={team => pick(node.id, team)}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Connector column into the next round */}
                {ri < KNOCKOUT_ROUNDS.length - 1 && (
                  <Connectors
                    destRound={KNOCKOUT_ROUNDS[ri + 1]}
                    feederRound={round}
                    bracket={bracket}
                    decided={decided[round]}
                    advanced={advancers[round]}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── */

const SEG = {
  line: "var(--color-line)",
  fill: "var(--color-ink-faint)",
  ok:   "var(--color-green-deep)",
};

/** Elbow connectors joining one round's pairs into the next round's matches. */
function Connectors({
  destRound, feederRound, bracket, decided, advanced,
}: {
  destRound: KnockoutRound;
  feederRound: KnockoutRound;
  bracket: Record<string, string>;
  decided: boolean;
  advanced: Set<string>;
}) {
  const destNodes = nodesInRound(destRound);
  return (
    <div className="bkt-conn" style={{ width: CONN_W }}>
      {destNodes.map(dest => {
        const [topId, botId] = BRACKET_NODE_MAP.get(dest.id)?.children ?? [];
        const fTop = topId ? bracket[topId] : undefined;
        const fBot = botId ? bracket[botId] : undefined;
        const topOk = decided && !!fTop && advanced.has(fTop);
        const botOk = decided && !!fBot && advanced.has(fBot);
        const top = topOk ? SEG.ok : fTop ? SEG.fill : SEG.line;
        const bot = botOk ? SEG.ok : fBot ? SEG.fill : SEG.line;
        const flow =
          topOk || botOk ? SEG.ok
          : fTop || fBot || bracket[dest.id] ? SEG.fill
          : SEG.line;
        return (
          <div key={dest.id} className="bkt-conn-group">
            <span className="bkt-seg bkt-seg-top"  style={{ ["--bkt-c" as string]: top }} />
            <span className="bkt-seg bkt-seg-bot"  style={{ ["--bkt-c" as string]: bot }} />
            <span className="bkt-seg bkt-seg-vert" style={{ ["--bkt-c" as string]: flow }} />
            <span className="bkt-seg bkt-seg-out"  style={{ ["--bkt-c" as string]: flow }} />
          </div>
        );
      })}
    </div>
  );
}

function BracketMatch({
  teamA, teamB, realMatch, odds, chosen, locked, decided, advanced, isFinal, onPick,
}: {
  teamA: string | null;
  teamB: string | null;
  realMatch: Match | null;
  odds: OddsData | null;
  chosen: string | null;
  locked: boolean;
  decided: boolean;
  advanced: Set<string>;
  isFinal: boolean;
  onPick: (team: string) => void;
}) {
  const date = realMatch ? fmtKick(realMatch.kickoffUtc) : null;
  return (
    <div className="w-full px-1.5">
      {/* Fixed-height meta line keeps every card centered on the same baseline */}
      <p className="h-[13px] mb-1 px-0.5 font-mono text-[9px] uppercase tracking-[0.1em] ink-faint/80 truncate leading-[13px]">
        {date ?? " "}
      </p>
      <div className={`bkt-card rounded-lg border bg-card overflow-hidden transition-shadow
        ${isFinal ? "border-gold/55 shadow-paper" : "border-line shadow-paper hover:shadow-lift"}`}>
        <TeamSlot
          team={teamA}
          prob={odds?.homeProb ?? null}
          chosen={chosen === teamA}
          locked={locked}
          decided={decided}
          advanced={teamA ? advanced.has(teamA) : false}
          onPick={onPick}
        />
        <div className="h-px bg-line" />
        <TeamSlot
          team={teamB}
          prob={odds?.awayProb ?? null}
          chosen={chosen === teamB}
          locked={locked}
          decided={decided}
          advanced={teamB ? advanced.has(teamB) : false}
          onPick={onPick}
        />
      </div>
    </div>
  );
}

function TeamSlot({
  team, prob, chosen, locked, decided, advanced, onPick,
}: {
  team: string | null;
  prob: number | null;
  chosen: boolean;
  locked: boolean;
  decided: boolean;
  advanced: boolean;
  onPick: (team: string) => void;
}) {
  const empty = !team;
  const rightCall = decided && chosen && advanced;
  const wrongCall = decided && chosen && !advanced;

  let cls = "group/slot relative w-full flex items-center gap-2 pl-2.5 pr-2 py-2 text-left transition-all select-none min-h-[38px] ";
  if (empty)             cls += "ink-faint/50 italic cursor-default";
  else if (rightCall)    cls += "bg-green-soft text-green-deep";
  else if (wrongCall)    cls += "bg-paper-deep ink-faint line-through";
  else if (chosen)       cls += "bg-green-deep/10 text-green-deep font-semibold";
  else                   cls += "ink hover:bg-paper-deep/60 cursor-pointer";
  if (locked && !chosen && !rightCall && !wrongCall) cls += " opacity-60";

  const disabled = empty || locked;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => team && onPick(team)}
      className={cls}
      style={{ touchAction: "manipulation" }}
    >
      {/* Accent rail on the chosen side */}
      {(chosen || rightCall) && (
        <span className={`absolute left-0 top-0 bottom-0 w-[3px] ${rightCall ? "bg-green-deep" : "bg-green-deep/70"}`} />
      )}
      {empty ? (
        <span className="text-[12px]">Winner TBD</span>
      ) : (
        <>
          <Flag team={team!} size={17} className="flex-shrink-0 rounded-[2px]" />
          <span className="text-[12.5px] truncate flex-1 leading-tight">{team}</span>
          {chosen && !decided && <span className="font-mono text-[10px] text-green-deep">✓</span>}
          {rightCall && <span className="font-mono text-[10px]">✓</span>}
          {prob !== null && !decided && (
            <span className={`font-mono text-[10px] tabular ${chosen ? "text-green-deep/70" : "ink-faint/70"}`}>
              {prob}%
            </span>
          )}
        </>
      )}
    </button>
  );
}
