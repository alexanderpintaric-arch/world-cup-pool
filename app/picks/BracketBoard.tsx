"use client";
import { useCallback, useMemo, useState, useRef, useEffect } from "react";
import type { TouchEvent as ReactTouchEvent } from "react";
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
  /** Picks are disabled once the Round of 32 has kicked off. */
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
  matches, odds, userBracketPicks, locked, deadline, sandbox = false,
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

  // ── Round selection ─────────────────────────────────────────────────────────
  // Players choose how many rounds to view (1–5, contiguous): defaults to as many
  // as fit the pane, then columns flex to fill the width. Tapping chips grows or
  // shrinks the selection — what's selected is exactly what renders.
  const [windowStart, setWindowStart] = useState(0);
  const [windowCount, setWindowCount] = useState(5);
  const [manualSel, setManualSel] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Track mobile breakpoint — used to switch between CTA button and inline pane.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  // The modal's width differs from the inline pane — let it re-auto-fit.
  useEffect(() => { setManualSel(false); }, [fullscreen]);

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

  const TOTAL_ROUNDS = KNOCKOUT_ROUNDS.length;
  const maxStart = Math.max(0, TOTAL_ROUNDS - windowCount);
  const clampedStart = Math.min(windowStart, maxStart);
  const endIdx = clampedStart + windowCount - 1;
  const visibleRounds = KNOCKOUT_ROUNDS.slice(clampedStart, clampedStart + windowCount);
  const windowed = windowCount < TOTAL_ROUNDS;

  // Auto-fit the round count to the pane width — until the player overrides it.
  useEffect(() => {
    const cont = scrollRef.current;
    if (!cont || manualSel) return;
    const recompute = () => {
      const w = cont.clientWidth;
      const narrow = w < 640;
      const target = narrow ? 150 : 240; // comfortable column width before adding another
      const connW  = narrow ? 18 : 30;
      const n = Math.max(1, Math.min(TOTAL_ROUNDS, Math.floor((w + connW) / (target + connW))));
      setWindowCount(n);
    };
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(cont);
    return () => ro.disconnect();
  }, [fullscreen, manualSel, TOTAL_ROUNDS]);

  const moveWindow = useCallback((delta: number) =>
    setWindowStart(s => Math.min(Math.max(0, s + delta), Math.max(0, TOTAL_ROUNDS - windowCount))),
    [windowCount, TOTAL_ROUNDS]);

  // Swipe left/right to page between rounds (mobile).
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: ReactTouchEvent) => {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: ReactTouchEvent) => {
    if (!touch.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touch.current.x;
    const dy = t.clientY - touch.current.y;
    touch.current = null;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) moveWindow(dx < 0 ? 1 : -1);
  };

  // Scroll the pane to a round's column — horizontally, and vertically to its
  // first match. We target the .bkt-cell (not .bkt-card) and subtract the
  // sticky column-title height (34 px) so the meta line + both team slots
  // land fully below the header rather than being obscured by it.
  const scrollToRound = useCallback((round: KnockoutRound) => {
    const cont = scrollRef.current;
    const col = colRefs.current[round];
    if (!cont || !col) return;
    const cr = cont.getBoundingClientRect();
    const left = col.getBoundingClientRect().left - cr.left + cont.scrollLeft;
    // Target the first full .bkt-cell (match header + both team slots), then
    // pull up by the sticky column title height (34 px) so nothing hides behind it.
    const cell = col.querySelector(".bkt-cell");
    const top = cell
      ? cell.getBoundingClientRect().top - cr.top + cont.scrollTop - 34 - 6
      : cont.scrollTop;
    cont.scrollTo({ left: Math.max(0, left - 10), top: Math.max(0, top), behavior: "smooth" });
  }, []);

  // Tap a round chip to grow/shrink the contiguous selection (1–5 rounds):
  // tap outside the range to extend to it, tap an edge to drop it, tap inside to
  // focus that single round.
  const toggleRound = useCallback((i: number) => {
    setManualSel(true);
    const s = clampedStart;
    const e = endIdx;
    let ns = s, ne = e;
    if (i < s)        ns = i;             // extend left
    else if (i > e)   ne = i;             // extend right
    else if (s === e) return;             // lone round — keep it
    else if (i === s) ns = s + 1;         // shrink from left edge
    else if (i === e) ne = e - 1;         // shrink from right edge
    else { ns = i; ne = i; }              // interior tap → focus one
    setWindowStart(ns);
    setWindowCount(ne - ns + 1);
    requestAnimationFrame(() => scrollToRound(KNOCKOUT_ROUNDS[i]));
  }, [clampedStart, endIdx, scrollToRound]);

  // When the selection (or modal) changes, bring the leftmost round into view.
  // Keyed to the selection only — must not re-fire on every pick re-render.
  useEffect(() => {
    const id = requestAnimationFrame(() => scrollToRound(KNOCKOUT_ROUNDS[clampedStart]));
    return () => cancelAnimationFrame(id);
  }, [clampedStart, windowCount, fullscreen, scrollToRound]);

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
          const inWin  = i >= clampedStart && i <= endIdx;
          const isDone = decided[round];
          return (
            <button
              key={round}
              onClick={() => toggleRound(i)}
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

  // ── The tree pane ──────────────────────────────────────────────────────────
  const renderColumn = (round: KnockoutRound) => {
    const count = nodesInRound(round).length;
    return (
      <div
        key={round}
        ref={el => { colRefs.current[round] = el; }}
        data-round={round}
        className="bkt-col"
      >
        <div className="bkt-col-title">
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] ink leading-none truncate">
            {ROUND_CONFIG[round].label}
          </span>
          <span className="font-mono text-[8.5px] ink-faint leading-none mt-0.5">
            {ROUND_CONFIG[round].pointsValue}&nbsp;pt · {count}&nbsp;{count === 1 ? "match" : "matches"}
          </span>
        </div>
        <div className="bkt-col-body">
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
      </div>
    );
  };

  const pane = (
    <div className={`relative ${fullscreen ? "flex flex-col flex-1 min-h-0" : ""}`}>
      <div
        ref={scrollRef}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className={`overflow-auto rounded-xl border border-line bg-paper/40 ${fullscreen ? "flex-1 min-h-0" : ""}`}
        style={fullscreen ? undefined : { maxHeight: "min(64vh, 600px)" }}
      >
        <div className="bkt-tree pr-2">
          {/* Left stub — lines in from the previous (hidden) round */}
          {clampedStart > 0 && (
            <Connectors
              destRound={KNOCKOUT_ROUNDS[clampedStart]}
              feederRound={KNOCKOUT_ROUNDS[clampedStart - 1]}
              bracket={bracket}
              decided={decided[KNOCKOUT_ROUNDS[clampedStart - 1]]}
              advanced={advancers[KNOCKOUT_ROUNDS[clampedStart - 1]]}
            />
          )}
          {visibleRounds.map((round, ri) => (
            <div key={round} className="contents">
              {renderColumn(round)}
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
          {/* Right stub — winners advance toward the next (hidden) round */}
          {endIdx < TOTAL_ROUNDS - 1 && (
            <Connectors
              destRound={KNOCKOUT_ROUNDS[endIdx + 1]}
              feederRound={KNOCKOUT_ROUNDS[endIdx]}
              bracket={bracket}
              decided={decided[KNOCKOUT_ROUNDS[endIdx]]}
              advanced={advancers[KNOCKOUT_ROUNDS[endIdx]]}
            />
          )}
        </div>
      </div>
    </div>
  );

  const boardInner = (
    <div className={fullscreen ? "flex flex-col flex-1 min-h-0 gap-3" : "space-y-4"}>
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
        <div className="flex-1 min-h-0 overflow-hidden px-4 sm:px-6 py-4 flex flex-col gap-3">
          {error && <BoardError msg={error} />}
          <p className="font-mono text-[10px] uppercase tracking-[0.1em] ink-faint text-center">
            {isMobile
              ? "Tap rounds to add or remove · swipe ← → to move"
              : "Click rounds to add or remove · press Esc to close"}
          </p>
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

        {/* Progress + print */}
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
          <a
            href="/bracket/print"
            target="_blank"
            rel="noopener noreferrer"
            title="Print bracket"
            className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-line bg-paper-deep ink-faint hover:ink hover:border-ink/30 transition-colors text-[11px] font-mono uppercase tracking-[0.1em]"
          >
            <svg viewBox="0 0 14 14" fill="none" className="h-3 w-3" aria-hidden="true">
              <rect x="2" y="4" width="10" height="7" rx="1.2" stroke="currentColor" strokeWidth="1.2" />
              <path d="M4 4V2.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 .5.5V4" stroke="currentColor" strokeWidth="1.2" />
              <path d="M4 10.5v1a.5.5 0 0 0 .5.5h5a.5.5 0 0 0 .5-.5v-1" stroke="currentColor" strokeWidth="1.2" />
              <circle cx="10.5" cy="7" r="0.6" fill="currentColor" />
            </svg>
            Print
          </a>
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

      {isMobile ? (
        /* ── Mobile CTA ────────────────────────────────────────────────── */
        <button
          onClick={() => setFullscreen(true)}
          className="w-full flex items-center justify-between gap-3 rounded-xl border border-ink bg-ink text-paper px-5 py-4 shadow-paper active:scale-[0.99] transition-transform"
        >
          <span className="flex items-center gap-3 min-w-0">
            <span className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-lg bg-paper/15">
              <svg className="h-5 w-5" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="text-left leading-tight min-w-0">
              <span className="block font-serif font-medium text-[17px]" style={{ fontVariationSettings: '"opsz" 28' }}>
                {teamsSet ? "Open your bracket" : "Open the bracket"}
              </span>
              <span className="block font-mono text-[9.5px] uppercase tracking-[0.14em] text-paper/60 mt-0.5 truncate">
                Full screen · swipe between rounds
              </span>
            </span>
          </span>
          <span className="flex-shrink-0 font-mono text-[18px] leading-none">→</span>
        </button>
      ) : (
        /* ── Desktop CTA ────────────────────────────────────────────────── */
        <BracketDesktopCTA
          onClick={() => setFullscreen(true)}
          filledCount={filledCount}
          teamsSet={teamsSet}
          pct={pct}
          champion={champion}
          locked={locked}
        />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── */

/**
 * Desktop-only full-screen bracket CTA.
 *
 * Renders a large dark card — the bracket tree is drawn in faint SVG lines
 * across the background so the structure you're about to fill is already
 * visible. The entire surface is the click target; the expand icon on the
 * right is the unmistakable "this opens something" signal.
 */
function BracketDesktopCTA({
  onClick, filledCount, teamsSet, pct, champion, locked,
}: {
  onClick: () => void;
  filledCount: number;
  teamsSet: boolean;
  pct: number;
  champion: string | null;
  locked: boolean;
}) {
  const TOTAL = 31;
  const done = pct === 100;

  return (
    <button
      onClick={onClick}
      className="group relative w-full overflow-hidden rounded-2xl text-left transition-all duration-200 anim-fade-up"
      style={{
        background: "#0B1426",
        minHeight: "172px",
        animationDelay: "80ms",
        boxShadow: "0 1px 0 rgba(11,20,38,0.06), 0 8px 32px -8px rgba(11,20,38,0.22)",
      }}
    >
      {/* ── Bracket tree SVG — decorative background ───────────── */}
      <svg
        viewBox="0 0 480 148"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
        className="absolute inset-0 w-full h-full transition-opacity duration-300"
        style={{ opacity: 0.07 }}
        fill="none"
      >
        {/* R32 horizontal stubs — 8 lines */}
        {[6, 25.4, 44.8, 64.2, 83.6, 103, 122.4, 141.8].map((y, i) => (
          <line key={i} x1="0" y1={y} x2="52" y2={y} stroke="white" strokeWidth="1.6" />
        ))}
        {/* R32→R16 elbows (4 pairs) */}
        {([
          [6, 25.4, 15.7],
          [44.8, 64.2, 54.5],
          [83.6, 103, 93.3],
          [122.4, 141.8, 132.1],
        ] as [number, number, number][]).map(([y1, y2, mid], i) => (
          <path key={i} d={`M52,${y1} H82 V${y2} M82,${mid} H112`} stroke="white" strokeWidth="1.6" strokeLinejoin="round" />
        ))}
        {/* R16 stubs (4 lines) */}
        {[15.7, 54.5, 93.3, 132.1].map((y, i) => (
          <line key={i} x1="112" y1={y} x2="170" y2={y} stroke="white" strokeWidth="1.6" />
        ))}
        {/* R16→QF elbows (2 pairs) */}
        {([
          [15.7, 54.5, 35.1],
          [93.3, 132.1, 112.7],
        ] as [number, number, number][]).map(([y1, y2, mid], i) => (
          <path key={i} d={`M170,${y1} H200 V${y2} M200,${mid} H230`} stroke="white" strokeWidth="1.6" strokeLinejoin="round" />
        ))}
        {/* QF stubs (2 lines) */}
        {[35.1, 112.7].map((y, i) => (
          <line key={i} x1="230" y1={y} x2="288" y2={y} stroke="white" strokeWidth="1.6" />
        ))}
        {/* QF→SF elbow */}
        <path d="M288,35.1 H318 V112.7 M318,73.9 H348" stroke="white" strokeWidth="1.6" strokeLinejoin="round" />
        {/* SF + Final lines */}
        <line x1="348" y1="73.9" x2="420" y2="73.9" stroke="white" strokeWidth="1.6" />
        <path d="M420,68 H450 V80 M420,73.9 H480" stroke="white" strokeWidth="1.2" strokeLinejoin="round" />
      </svg>

      {/* ── Hover glow ─────────────────────────────────────────── */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 80% 50%, rgba(201,48,44,0.12) 0%, transparent 65%)" }}
      />

      {/* ── Content ────────────────────────────────────────────── */}
      <div className="relative z-10 flex items-center gap-6 px-8 py-7">

        {/* Text block */}
        <div className="flex-1 min-w-0">
          <p className="font-mono text-[9.5px] uppercase tracking-[0.24em] mb-3" style={{ color: "rgba(245,241,232,0.38)" }}>
            Knockout Bracket
            {filledCount > 0 && (
              <span style={{ color: "rgba(245,241,232,0.55)" }}> · {filledCount}/{TOTAL} filled</span>
            )}
          </p>

          <h3
            className="font-serif font-medium leading-[1.05] tracking-[-0.01em] mb-3"
            style={{
              fontSize: "clamp(1.6rem, 3vw, 2.2rem)",
              color: "#F5F1E8",
              fontVariationSettings: '"opsz" 80',
            }}
          >
            {teamsSet
              ? "Open your bracket."
              : "Open the bracket."}
          </h3>

          <p className="font-mono text-[10.5px] leading-relaxed" style={{ color: "rgba(245,241,232,0.42)" }}>
            {locked
              ? "Picks are locked — watch it play out round by round."
              : teamsSet
                ? "Pick every winner from the Round of 32 to the Final."
                : "Preview the official draw — teams are set after the group stage."}
          </p>

          {/* Champion callout */}
          {champion && (
            <p className="mt-3 font-serif italic text-[14px] leading-none" style={{ color: "#A07820" }}>
              Your champion: {champion}
            </p>
          )}
        </div>

        {/* Expand icon — the unmistakable "this opens fullscreen" signal */}
        <div
          className="flex-shrink-0 flex items-center justify-center rounded-xl transition-all duration-200 group-hover:scale-105"
          style={{
            width: "56px",
            height: "56px",
            background: done ? "#1B5E20" : "rgba(201,48,44,0.9)",
            boxShadow: "0 4px 16px rgba(201,48,44,0.3)",
          }}
        >
          <svg viewBox="0 0 20 20" fill="none" className="h-6 w-6" aria-hidden="true">
            <path
              d="M3 7.5V3h4.5M17 7.5V3h-4.5M3 12.5V17h4.5M17 12.5V17h-4.5"
              stroke="white"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>

      {/* ── Progress bar ───────────────────────────────────────── */}
      <div className="absolute bottom-0 left-0 right-0 h-[3px]" style={{ background: "rgba(245,241,232,0.06)" }}>
        {pct > 0 && (
          <div
            className="h-full transition-all duration-700"
            style={{
              width: `${pct}%`,
              background: done ? "#1B5E20" : "#C9302C",
            }}
          />
        )}
      </div>
    </button>
  );
}

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
      <div className="bkt-conn-title" />
      <div className="bkt-conn-body">
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
