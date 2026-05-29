"use client";
import { useCallback, useMemo, useState } from "react";
import type { Match, OddsData, BracketPick } from "@/lib/types";
import { ROUND_CONFIG } from "@/lib/constants";
import {
  KNOCKOUT_ROUNDS, type KnockoutRound, nodesInRound, parentOf,
  orderedR32Matches, participantsOf,
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

  const r32Ready = r32Slots.some(m => m !== null);

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
      // Reconcile with the server's sanitized bracket (rarely differs).
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
    <div className="space-y-6 anim-fade-up">
      {error && (
        <div className="rounded-md border border-[color:var(--accent)]/30 bg-accent-soft px-5 py-3.5 text-[13.5px] text-accent flex items-center gap-2">
          <span className="font-mono">!</span>
          <span>{error}</span>
        </div>
      )}

      {/* ── Header: progress + champion ───────────────────────────────────── */}
      <div className="bg-card border border-line rounded-md p-5 shadow-paper">
        <div className="flex items-start justify-between gap-5 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-accent mb-1.5">
              Knockout Bracket
            </p>
            <p className="font-serif italic text-[16px] ink leading-snug max-w-2xl" style={{ fontVariationSettings: '"opsz" 32' }}>
              {locked
                ? "The bracket is locked. Watch it play out, round by round."
                : "Pick every winner from the Round of 32 to the Final. Each winner advances to the next round automatically."}
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="font-serif font-medium ink leading-none tabular" style={{ fontSize: "26px", fontVariationSettings: '"opsz" 60' }}>
              {filledCount}<span className="ink-faint">/{TOTAL_NODES}</span>
            </div>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] ink-faint">Slots filled</p>
          </div>
        </div>

        <div className="mt-4 h-1.5 w-full rounded-full bg-paper-deep overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${pct === 100 ? "bg-green-deep" : "bg-accent"}`}
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="mt-3 flex items-center justify-between text-[11.5px] ink-faint flex-wrap gap-y-1">
          <span>
            {locked
              ? "Picks locked — Round of 32 has begun"
              : deadline
                ? `All picks lock ${new Date(deadline).toLocaleString("en-CA", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
                : "Open — fill out your whole bracket"}
          </span>
          {champion && (
            <span className="inline-flex items-center gap-1.5 font-medium ink">
              <span>🏆 Your champion:</span>
              <Flag team={champion} size={14} />
              <span className="font-semibold">{champion}</span>
            </span>
          )}
        </div>
      </div>

      {/* ── Bracket columns ───────────────────────────────────────────────── */}
      <div className="overflow-x-auto pb-3 -mx-1 px-1">
        <div className="flex gap-3 sm:gap-4 min-w-max">
          {KNOCKOUT_ROUNDS.map(round => (
            <div key={round} className="flex flex-col" style={{ minWidth: round === "FINAL" ? 190 : 200 }}>
              <div className="mb-3 px-1">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] ink-faint">
                  {COLUMN_LABEL[round]}
                </p>
                <p className="font-mono text-[9.5px] ink-faint/60">
                  {ROUND_CONFIG[round].pointsValue}pt each
                </p>
              </div>
              <div className="flex flex-col justify-around flex-1 gap-2">
                {nodesInRound(round).map(node => {
                  const [a, b] = participantsOf(node.id, bracket, r32Slots);
                  const m = round === "ROUND_OF_32" ? r32Slots[node.matchSlot ?? -1] ?? null : null;
                  const o = m ? oddsMap.get(m.matchId) ?? null : null;
                  return (
                    <BracketMatch
                      key={node.id}
                      teamA={a}
                      teamB={b}
                      odds={o}
                      chosen={bracket[node.id] ?? null}
                      locked={locked}
                      decided={decided[round]}
                      advanced={advancers[round]}
                      isFinal={round === "FINAL"}
                      onPick={team => pick(node.id, team)}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── */

function BracketMatch({
  teamA, teamB, odds, chosen, locked, decided, advanced, isFinal, onPick,
}: {
  teamA: string | null;
  teamB: string | null;
  odds: OddsData | null;
  chosen: string | null;
  locked: boolean;
  decided: boolean;
  advanced: Set<string>;
  isFinal: boolean;
  onPick: (team: string) => void;
}) {
  return (
    <div className={`rounded-lg border bg-card overflow-hidden ${isFinal ? "border-gold/60 shadow-paper" : "border-line"}`}>
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
  // Result feedback once the round is decided.
  const rightCall = decided && chosen && advanced;
  const wrongCall = decided && chosen && !advanced;

  let cls = "w-full flex items-center gap-2 px-2.5 py-2 text-left transition-all select-none min-h-[40px] ";
  if (empty)             cls += "ink-faint/50 italic cursor-default";
  else if (rightCall)    cls += "bg-green-soft text-green-deep";
  else if (wrongCall)    cls += "bg-paper-deep ink-faint line-through";
  else if (chosen)       cls += "bg-green-deep/10 text-green-deep font-semibold";
  else                   cls += "ink hover:bg-paper-deep/50 cursor-pointer";
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
      {empty ? (
        <span className="text-[12px]">Winner TBD</span>
      ) : (
        <>
          <Flag team={team!} size={16} className="flex-shrink-0" />
          <span className="text-[12.5px] truncate flex-1">{team}</span>
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
