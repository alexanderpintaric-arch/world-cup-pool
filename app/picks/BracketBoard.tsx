"use client";
import { useCallback, useMemo, useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import type { Match, OddsData, BracketPick } from "@/lib/types";
import { ROUND_CONFIG } from "@/lib/constants";
import {
  KNOCKOUT_ROUNDS, type KnockoutRound, nodesInRound, parentOf,
  orderedR32Matches, participantsOf, BRACKET_NODE_MAP,
  NODE_KICKOFF, NODE_MATCH_NO, r32SlotLabels,
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

function fmtKick(iso: string | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
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

  // ── Round window: show as many rounds as the pane can fit (all 5 on a wide
  //    desktop), sliding 1-at-a-time when they don't all fit (mobile/tablet).
  const [windowStart, setWindowStart] = useState(0);
  const [visibleCount, setVisibleCount] = useState(5);
  const [fullscreen, setFullscreen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Lock body scroll + allow Esc to close while the full-screen modal is open.
  useEffect(() => {
    if (!fullscreen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setFullscreen(false); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [fullscreen]);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const colRefs   = useRef<Record<string, HTMLDivElement | null>>({});

  // Real R32 teams are only known once the group stage finishes; until then the
  // bracket is a read-only preview showing the official seed slots (1E, 2A, …).
  const teamsSet = r32Slots.some(m => m !== null);
  const readOnly = locked || !teamsSet;

  const maxStart = Math.max(0, KNOCKOUT_ROUNDS.length - visibleCount);
  const clampedStart = Math.min(windowStart, maxStart);
  const visibleRounds = KNOCKOUT_ROUNDS.slice(clampedStart, clampedStart + visibleCount);
  const windowed = visibleCount < KNOCKOUT_ROUNDS.length;

  // Measure the pane and show as many whole columns as fit (1–5).
  useEffect(() => {
    const cont = scrollRef.current;
    if (!cont) return;
    const recompute = () => {
      const w = cont.clientWidth;
      const narrow = w < 640;
      const colW  = narrow ? 146 : 220;
      const connW = narrow ? 14 : 34;
      const pad   = 18; // tree + pane horizontal padding
      const n = Math.floor((w - pad + connW) / (colW + connW));
      setVisibleCount(Math.max(1, Math.min(KNOCKOUT_ROUNDS.length, n)));
    };
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(cont);
    return () => ro.disconnect();
  }, [fullscreen]);

  const moveWindow = (delta: number) =>
    setWindowStart(s => Math.min(Math.max(0, s + delta), maxStart));

  // Scroll the pane to a round's column — horizontally, and vertically to its
  // first match (later rounds sit centered far down the tall tree).
  const scrollToRound = useCallback((round: KnockoutRound) => {
    const cont = scrollRef.current;
    const col = colRefs.current[round];
    if (!cont || !col) return;
    const cr = cont.getBoundingClientRect();
    const card = col.querySelector(".bkt-card");
    const left = col.getBoundingClientRect().left - cr.left + cont.scrollLeft;
    const top = card
      ? card.getBoundingClientRect().top - cr.top + cont.scrollTop
      : cont.scrollTop;
    cont.scrollTo({ left: Math.max(0, left - 10), top: Math.max(0, top - 8), behavior: "smooth" });
  }, []);

  // Clicking a round: slide the window to start there (if windowed), then scroll.
  const focusRound = useCallback((i: number) => {
    const start = Math.min(Math.max(0, i), KNOCKOUT_ROUNDS.length - visibleCount);
    setWindowStart(start);
    requestAnimationFrame(() => scrollToRound(KNOCKOUT_ROUNDS[i]));
  }, [visibleCount, scrollToRound]);

  // When the window (or fullscreen) changes, bring the leftmost round into view.
  useEffect(() => {
    const id = requestAnimationFrame(() => scrollToRound(visibleRounds[0]));
    return () => cancelAnimationFrame(id);
  }, [clampedStart, visibleCount, fullscreen, visibleRounds, scrollToRound]);

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
    if (readOnly) return;
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
  }, [readOnly, r32Slots, save]);

  const filledCount = Object.keys(bracket).length;
  const champion = bracket["F-1"] ?? null;
  const championDecided = decided.FINAL && champion ? advancers.FINAL.has(champion) : false;
  const pct = (filledCount / TOTAL_NODES) * 100;

  // ── Round rail ──────────────────────────────────────────────────────────────
  // Chips jump to a round; chevrons only appear when not every round fits.
  const rail = (
    <div className="flex items-center gap-1.5">
      {windowed && (
        <RailChevron dir="left" onClick={() => moveWindow(-1)} disabled={clampedStart === 0} />
      )}
      <div className="flex-1 flex gap-1 overflow-x-auto no-scrollbar py-0.5">
        {KNOCKOUT_ROUNDS.map((round, i) => {
          const inWin  = i >= clampedStart && i < clampedStart + visibleCount;
          const isDone = decided[round];
          return (
            <button
              key={round}
              onClick={() => focusRound(i)}
              aria-pressed={inWin}
              className={`group flex-shrink-0 flex items-center gap-2 pl-2 pr-3 py-2 rounded-lg border transition-all
                ${inWin
                  ? "bg-ink text-paper border-ink shadow-paper"
                  : "bg-card border-line ink-soft hover:ink hover:border-[color:var(--ink-faint)]/40"}`}
            >
              <span className="bkt-rail-bars h-4 w-3.5">
                {Array.from({ length: RAIL_BARS[round] }).map((_, b) => (
                  <span key={b} className="bkt-rail-bar" style={{ width: `${100 - b * 12}%` }} />
                ))}
              </span>
              <span className="text-left leading-none">
                <span className="block text-[12.5px] font-medium">{SHORT_LABEL[round]}</span>
                <span className={`block font-mono text-[8.5px] mt-0.5 ${inWin ? "text-paper/55" : "ink-faint"}`}>
                  {ROUND_CONFIG[round].pointsValue}&nbsp;pt
                </span>
              </span>
              {isDone && <span className={`font-mono text-[9px] ${inWin ? "text-paper/70" : "text-green-deep"}`}>✓</span>}
            </button>
          );
        })}
      </div>
      {windowed && (
        <RailChevron dir="right" onClick={() => moveWindow(1)} disabled={clampedStart >= maxStart} />
      )}
    </div>
  );

  // ── The tree pane (windowed) ───────────────────────────────────────────────
  const pane = (
    <div
      ref={scrollRef}
      className="overflow-auto rounded-xl border border-line bg-paper/40"
      style={{ maxHeight: fullscreen ? "calc(100dvh - 188px)" : "min(60vh, 560px)" }}
    >
      <div className="bkt-tree py-3 pr-3" data-size={visibleRounds.length}>
        {visibleRounds.map((round, ri) => (
          <div key={round} className="contents">
            <div
              ref={el => { colRefs.current[round] = el; }}
              data-round={round}
              className="bkt-col"
            >
              {nodesInRound(round).map(node => {
                const [a, b] = participantsOf(node.id, bracket, r32Slots);
                const labels = r32SlotLabels(node.id);
                const m = round === "ROUND_OF_32" ? r32Slots[node.matchSlot ?? -1] ?? null : null;
                const o = m ? oddsMap.get(m.matchId) ?? null : null;
                return (
                  <div key={node.id} className="bkt-cell">
                    <BracketMatch
                      teamA={a}
                      teamB={b}
                      labelA={labels?.[0] ?? null}
                      labelB={labels?.[1] ?? null}
                      matchNo={NODE_MATCH_NO[node.id]}
                      kickoff={m?.kickoffUtc ?? NODE_KICKOFF[node.id]}
                      odds={o}
                      chosen={bracket[node.id] ?? null}
                      readOnly={readOnly}
                      decided={decided[round]}
                      advanced={advancers[round]}
                      isFinal={round === "FINAL"}
                      onPick={team => pick(node.id, team)}
                    />
                  </div>
                );
              })}
            </div>

            {ri < visibleRounds.length - 1 && (
              <Connectors
                destRound={visibleRounds[ri + 1]}
                feederRound={round}
                bracket={bracket}
                decided={decided[round]}
                advanced={advancers[round]}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const boardInner = (
    <div className="space-y-4">
      {rail}
      {pane}
    </div>
  );

  // ── Fullscreen modal (portaled to <body> to escape stacking contexts) ──────
  if (fullscreen && mounted) {
    return createPortal(
      <div className="fixed inset-0 z-[60] bg-paper flex flex-col anim-fade-in">
        <div className="flex items-center justify-between gap-4 px-4 sm:px-6 py-3.5 border-b border-line bg-card/80 backdrop-blur">
          <div className="min-w-0">
            <p className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-accent">Knockout Bracket</p>
            <p className="font-serif italic text-[15px] ink leading-tight truncate" style={{ fontVariationSettings: '"opsz" 28' }}>
              {champion ? <>Champion: {champion}</> : `${filledCount}/${TOTAL_NODES} slots filled`}
            </p>
          </div>
          <button
            onClick={() => setFullscreen(false)}
            className="flex-shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-ink text-paper text-[12.5px] font-medium hover:bg-accent transition-colors"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            Close
          </button>
        </div>
        <div className="flex-1 overflow-hidden px-4 sm:px-6 py-4 space-y-4">
          {error && <BoardError msg={error} />}
          {boardInner}
        </div>
      </div>,
      document.body
    );
  }

  return (
    <div className="space-y-5 anim-fade-up">
      {error && <BoardError msg={error} />}

      {/* ── Header: progress + champion + expand ──────────────────────────── */}
      <div className="bg-card border border-line rounded-xl p-5 shadow-paper">
        <div className="flex items-start justify-between gap-5 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-accent mb-1.5">
              Knockout Bracket
            </p>
            <p className="font-serif italic text-[16px] ink leading-snug max-w-2xl" style={{ fontVariationSettings: '"opsz" 32' }}>
              {!teamsSet
                ? "Preview the road to the Final. Teams are set the moment the group stage wraps — then you fill it out."
                : locked
                  ? "The bracket is locked. Watch it play out, round by round."
                  : "Pick every winner from the Round of 32 to the Final. Each winner advances automatically."}
            </p>
          </div>

          <div className="flex items-stretch gap-2.5 flex-shrink-0">
            <div
              className={`champion-plate flex items-center gap-3 rounded-lg border px-4 py-2.5
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

            <button
              onClick={() => setFullscreen(true)}
              title="Full screen"
              className="flex-shrink-0 inline-flex items-center justify-center px-3 rounded-lg border border-line bg-card ink-soft hover:ink hover:border-[color:var(--ink-faint)]/40 transition-all"
            >
              <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
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
          {!teamsSet
            ? "Read-only preview — official seed slots shown until the group stage decides the teams"
            : locked
              ? "Picks locked — Round of 32 has begun"
              : deadline
                ? `All picks lock ${new Date(deadline).toLocaleString("en-CA", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
                : "Open — fill out your whole bracket"}
        </p>
      </div>

      {boardInner}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── */

function BoardError({ msg }: { msg: string }) {
  return (
    <div className="rounded-md border border-[color:var(--accent)]/30 bg-accent-soft px-5 py-3.5 text-[13.5px] text-accent flex items-center gap-2">
      <span className="font-mono">!</span>
      <span>{msg}</span>
    </div>
  );
}

function RailChevron({ dir, onClick, disabled }: { dir: "left" | "right"; onClick: () => void; disabled: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === "left" ? "Earlier rounds" : "Later rounds"}
      className="flex-shrink-0 h-9 w-8 flex items-center justify-center rounded-lg border border-line bg-card ink-soft hover:ink hover:border-[color:var(--ink-faint)]/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all font-mono"
    >
      {dir === "left" ? "‹" : "›"}
    </button>
  );
}

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
  void feederRound;
  const destNodes = nodesInRound(destRound);
  return (
    <div className="bkt-conn">
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
  teamA, teamB, labelA, labelB, matchNo, kickoff, odds, chosen, readOnly, decided, advanced, isFinal, onPick,
}: {
  teamA: string | null;
  teamB: string | null;
  labelA: string | null;
  labelB: string | null;
  matchNo: number | undefined;
  kickoff: string | undefined;
  odds: OddsData | null;
  chosen: string | null;
  readOnly: boolean;
  decided: boolean;
  advanced: Set<string>;
  isFinal: boolean;
  onPick: (team: string) => void;
}) {
  const date = fmtKick(kickoff);
  return (
    <div className="w-full px-1.5">
      {/* Fixed-height meta line keeps every card centered on the same baseline */}
      <div className="h-[13px] mb-1 px-0.5 flex items-center gap-1.5 leading-[13px] overflow-hidden">
        {matchNo !== undefined && (
          <span className="font-mono text-[8.5px] uppercase tracking-[0.06em] ink-faint/90 flex-shrink-0">
            Match {matchNo}
          </span>
        )}
        {date && (
          <span className="font-mono text-[8.5px] uppercase tracking-[0.04em] ink-faint/70 truncate">
            · {date}
          </span>
        )}
      </div>
      <div className={`bkt-card rounded-lg border bg-card overflow-hidden transition-shadow
        ${isFinal ? "border-gold/55 shadow-paper" : "border-line shadow-paper hover:shadow-lift"}`}>
        <TeamSlot
          team={teamA}
          placeholder={labelA ?? "TBD"}
          prob={odds?.homeProb ?? null}
          chosen={chosen === teamA}
          readOnly={readOnly}
          decided={decided}
          advanced={teamA ? advanced.has(teamA) : false}
          onPick={onPick}
        />
        <div className="h-px bg-line" />
        <TeamSlot
          team={teamB}
          placeholder={labelB ?? "TBD"}
          prob={odds?.awayProb ?? null}
          chosen={chosen === teamB}
          readOnly={readOnly}
          decided={decided}
          advanced={teamB ? advanced.has(teamB) : false}
          onPick={onPick}
        />
      </div>
    </div>
  );
}

function TeamSlot({
  team, placeholder, prob, chosen, readOnly, decided, advanced, onPick,
}: {
  team: string | null;
  placeholder: string;
  prob: number | null;
  chosen: boolean;
  readOnly: boolean;
  decided: boolean;
  advanced: boolean;
  onPick: (team: string) => void;
}) {
  const empty = !team;
  const rightCall = decided && chosen && advanced;
  const wrongCall = decided && chosen && !advanced;

  let cls = "group/slot relative w-full flex items-center gap-2 pl-2.5 pr-2 py-2 text-left transition-all select-none min-h-[38px] ";
  if (empty)             cls += "ink-faint/60 cursor-default";
  else if (rightCall)    cls += "bg-green-soft text-green-deep";
  else if (wrongCall)    cls += "bg-paper-deep ink-faint line-through";
  else if (chosen)       cls += "bg-green-deep/10 text-green-deep font-semibold";
  else if (readOnly)     cls += "ink cursor-default";
  else                   cls += "ink hover:bg-paper-deep/60 cursor-pointer";
  if (readOnly && !chosen && !rightCall && !wrongCall && !empty) cls += " opacity-90";

  const disabled = empty || readOnly;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => team && onPick(team)}
      className={cls}
      style={{ touchAction: "manipulation" }}
    >
      {(chosen || rightCall) && (
        <span className={`absolute left-0 top-0 bottom-0 w-[3px] ${rightCall ? "bg-green-deep" : "bg-green-deep/70"}`} />
      )}
      {empty ? (
        <>
          {/* Seed-slot placeholder (e.g. "1E", "3A/B/C/D/F") or TBD */}
          <span className="h-[17px] w-[17px] rounded-full bg-paper-deep border border-line flex-shrink-0" />
          <span className="font-mono text-[11.5px] tracking-[0.02em] truncate flex-1 leading-5">{placeholder}</span>
        </>
      ) : (
        <>
          <Flag team={team!} size={17} className="flex-shrink-0 rounded-[2px]" />
          <span className="text-[12.5px] truncate flex-1 leading-5">{team}</span>
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
