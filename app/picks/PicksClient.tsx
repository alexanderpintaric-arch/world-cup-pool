"use client";
import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import type { Match, Pick, OddsData, RoundState, MatchResult, Round } from "@/lib/types";
import { ROUND_CONFIG } from "@/lib/constants";
import { inferGroups } from "@/lib/services/grouping";
import MatchCard from "@/components/MatchCard";
import Flag from "@/components/Flag";
import CountdownTimer from "@/components/CountdownTimer";

type PopularCount = { H: number; A: number; T: number; total: number };

interface Props {
  matches: Match[];
  userPicks: Pick[];
  odds: OddsData[];
  roundStates: RoundState[];
  activeRound: RoundState | null;
  userEmail: string;
  userName: string;
  popularCounts: Record<string, PopularCount>;
}

function getRoundTabStatus(rs: RoundState): "active" | "complete" | "unavailable" | "locked" | "upcoming" {
  if (!rs.isAvailable && rs.matchCount > 0) return "unavailable";
  if (rs.isComplete) return "complete";
  if (rs.isOpen) return "active";
  if (rs.matchCount > 0) return "locked";
  return "upcoming";
}

const ROUND_TAGLINE: Record<Round, string> = {
  GROUP:          "12 groups. 72 matches. Pick a winner — or call a draw — for every one.",
  ROUND_OF_32:    "The first cut. 32 nations left, half advance. No draws here.",
  ROUND_OF_16:    "Down to sixteen. Pick the side you think reaches the quarters.",
  QUARTER_FINALS: "Eight standing. Every match worth four points.",
  SEMI_FINALS:    "Last four. Five points each.",
  FINAL:          "The match. Worth six points and a year of bragging rights.",
};

export default function PicksClient({
  matches, userPicks, odds, roundStates, activeRound, userName, popularCounts,
}: Props) {
  const [selectedRound, setSelectedRound] = useState<Round>(
    activeRound?.round ?? "GROUP"
  );
  const [picks, setPicks] = useState<Record<string, MatchResult>>(() => {
    const init: Record<string, MatchResult> = {};
    for (const p of userPicks) init[p.matchId] = p.pick;
    return init;
  });
  const [error, setError] = useState<string | null>(null);
  // Real-time clock so the round locks client-side the instant the deadline passes
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  // Celebration modal — fires once when the user makes the very last pick of a round
  const [showCelebration, setShowCelebration] = useState(false);
  const prevPickRef = useRef(-1);
  const prevRoundRef = useRef<Round | null>(null);

  const oddsMap = useMemo(() => new Map(odds.map(o => [o.matchId, o])), [odds]);
  const currentRoundState = roundStates.find(r => r.round === selectedRound);
  const isAvailable = currentRoundState?.isAvailable ?? false;
  // A round is locked once its first match has kicked off (even if later matches haven't)
  const roundDeadlineMs = currentRoundState?.deadline
    ? new Date(currentRoundState.deadline).getTime()
    : null;
  const roundDeadlinePassed = roundDeadlineMs !== null && now >= roundDeadlineMs;
  const isRoundPickable = isAvailable && !roundDeadlinePassed;
  const isOpen = currentRoundState?.isOpen ?? false;

  const groups = useMemo(() => inferGroups(matches), [matches]);

  // Matches for the selected round — exclude TBD vs TBD placeholders so they
  // don't inflate totalCount and prevent the completion celebration from firing
  const roundMatches = useMemo(() =>
    matches
      .filter(m =>
        m.round === selectedRound &&
        !(m.homeTeam === "TBD" && m.awayTeam === "TBD")
      )
      .sort((a, b) => new Date(a.kickoffUtc).getTime() - new Date(b.kickoffUtc).getTime()),
    [matches, selectedRound]
  );

  // For group stage we render by group; for knockouts we render flat.
  const isGroupStage = selectedRound === "GROUP";

  const pickedCount = roundMatches.filter(m => picks[m.matchId]).length;
  const totalCount = roundMatches.length;
  const pct = totalCount > 0 ? (pickedCount / totalCount) * 100 : 0;

  // Fire the celebration the instant the final pick of a round is made
  useEffect(() => {
    const justFinished = (
      totalCount > 0 &&
      pickedCount === totalCount &&
      prevPickRef.current === totalCount - 1 &&
      prevRoundRef.current === selectedRound
    );
    if (justFinished) {
      const t = setTimeout(() => setShowCelebration(true), 550); // let pick animation land first
      prevPickRef.current = pickedCount;
      prevRoundRef.current = selectedRound;
      return () => clearTimeout(t);
    }
    prevPickRef.current = pickedCount;
    prevRoundRef.current = selectedRound;
  }, [pickedCount, totalCount, selectedRound]);

  const savePick = useCallback(async (matchId: string, pick: MatchResult) => {
    setError(null);
    try {
      const res = await fetch("/api/picks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ picks: [{ matchId, pick }] }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Couldn’t save your pick");
      }
    } catch {
      setError("Network hiccup — pick not saved");
    }
  }, []);

  function handlePick(matchId: string, pick: MatchResult) {
    if (pick === null) {
      // Undo: remove from local state
      setPicks(p => {
        const next = { ...p };
        delete next[matchId];
        return next;
      });
    } else {
      setPicks(p => ({ ...p, [matchId]: pick }));
    }
    savePick(matchId, pick);
  }

  const roundsWithMatches = roundStates.filter(r => r.matchCount > 0);
  const firstName = (userName ?? "").split(/\s+/)[0] || "friend";

  return (
    <div className="space-y-10">

      {/* ── CELEBRATION MODAL ────────────────────────────────── */}
      {showCelebration && currentRoundState && (
        <CelebrationModal
          round={selectedRound}
          roundLabel={currentRoundState.label}
          pickedCount={pickedCount}
          lastKickoff={currentRoundState.lastKickoff}
          onDismiss={() => setShowCelebration(false)}
        />
      )}

      {/* ── PAGE HEADER ──────────────────────────────────────── */}
      <header className="flex items-start justify-between flex-wrap gap-5 anim-fade-up">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] ink-faint mb-3">
            Your picks &middot; Hi, {firstName}
          </p>
          <h1 className="font-serif font-medium leading-[1.02] tracking-[-0.02em] ink" style={{fontSize: 'clamp(2.25rem, 5vw, 3.5rem)', fontVariationSettings: '"opsz" 120'}}>
            Make your <span className="italic text-accent">picks.</span>
          </h1>
          <p className="mt-3 text-[15px] ink-soft max-w-xl">
            Every selection saves the second you tap it. Change your mind as often as you like — until the deadline.
          </p>
        </div>
        {activeRound?.deadline && (
          <CountdownTimer
            deadline={activeRound.deadline}
            label="Picks lock in"
          />
        )}
      </header>

      {/* ── ERROR BANNER ─────────────────────────────────────── */}
      {error && (
        <div className="anim-fade-up rounded-md border border-[color:var(--accent)]/30 bg-accent-soft px-5 py-3.5 text-[13.5px] text-accent flex items-center gap-2">
          <span className="font-mono">!</span>
          <span>{error}</span>
        </div>
      )}

      {/* ── ROUND TABS ───────────────────────────────────────── */}
      <nav className="anim-fade-up" style={{animationDelay: '60ms'}}>
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          {roundsWithMatches.map(rs => {
            const active = selectedRound === rs.round;
            const tabStatus = getRoundTabStatus(rs);
            return (
              <button
                key={rs.round}
                onClick={() => setSelectedRound(rs.round)}
                className={`group relative flex-shrink-0 px-4 py-2.5 rounded-md text-[13.5px] font-medium transition-all border
                  ${active
                    ? "bg-ink text-paper border-ink"
                    : tabStatus === "unavailable"
                      ? "bg-paper border-line ink-faint opacity-60 hover:opacity-80 cursor-default"
                      : "bg-card border-line ink-soft hover:ink hover:border-[color:var(--ink-faint)]/40"
                  }
                `}
              >
                <span className="flex items-center gap-2">
                  {rs.label}
                  {tabStatus === "active" && !active && (
                    <span className="h-1.5 w-1.5 rounded-full bg-accent anim-ring-pulse" />
                  )}
                  {tabStatus === "complete" && (
                    <span className="font-mono text-[10px] text-gold">✓</span>
                  )}
                  {tabStatus === "unavailable" && !active && (
                    <span className="font-mono text-[10px] ink-faint">⊘</span>
                  )}
                </span>
              </button>
            );
          })}
          {roundsWithMatches.length === 0 && (
            <p className="ink-faint text-[14px] italic font-serif px-2 py-2">Waiting for the schedule…</p>
          )}
        </div>

        {/* Round tagline + progress */}
        {currentRoundState && totalCount > 0 && (
          <div className="mt-5 bg-card border border-line rounded-md p-5 shadow-paper">
            <div className="flex items-start justify-between gap-5 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-accent mb-1.5">
                  {currentRoundState.label}
                </p>
                <p className="font-serif italic text-[16px] ink leading-snug max-w-2xl" style={{fontVariationSettings: '"opsz" 32'}}>
                  {ROUND_TAGLINE[currentRoundState.round] ?? ""}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="font-serif font-medium ink leading-none tabular" style={{fontSize: '26px', fontVariationSettings: '"opsz" 60'}}>
                  {pickedCount}<span className="ink-faint">/{totalCount}</span>
                </div>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] ink-faint">
                  Picks made
                </p>
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
                {!isAvailable
                  ? "Locked — complete the previous round first"
                  : roundDeadlinePassed
                    ? "Picks locked — round in progress"
                    : isOpen
                      ? "Open — all picks lock when the first match kicks off"
                      : currentRoundState.isComplete
                        ? "Round complete"
                        : "In progress"}
              </span>
              <span className="font-mono">
                {currentRoundState.pointsValue}pt per correct pick
              </span>
            </div>
            {/* Open/close date strip */}
            {(currentRoundState.deadline || currentRoundState.lastKickoff) && (
              <div className="mt-2.5 pt-2.5 border-t border-[color:var(--line-soft)] flex flex-wrap gap-x-5 gap-y-1 text-[11px] font-mono ink-faint">
                {currentRoundState.deadline && (
                  <span>
                    <span className="uppercase tracking-[0.14em] mr-1.5">Picks lock</span>
                    <span className={roundDeadlinePassed ? "line-through" : "ink"}>
                      {new Date(currentRoundState.deadline).toLocaleString("en-CA", {
                        month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                      })}
                    </span>
                    {roundDeadlinePassed && <span className="ml-1.5 text-accent">Locked</span>}
                  </span>
                )}
                {currentRoundState.lastKickoff && (
                  <span>
                    <span className="uppercase tracking-[0.14em] mr-1.5">Last match</span>
                    <span className="ink">
                      {new Date(currentRoundState.lastKickoff).toLocaleString("en-CA", {
                        month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                      })}
                    </span>
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Unavailability banner for locked rounds */}
        {currentRoundState && !isAvailable && (
          <div className="mt-3 flex items-center gap-3 px-4 py-3 rounded-md bg-paper-deep border border-line text-[13px] ink-faint">
            <span className="text-[16px]">🔒</span>
            <span>
              This round opens once the previous round is fully complete.
              Check back when all matches are decided.
            </span>
          </div>
        )}
      </nav>

      {/* ── MATCHES ──────────────────────────────────────────── */}
      {roundMatches.length === 0 ? (
        <EmptyState round={selectedRound} />
      ) : isGroupStage ? (
        <div className="space-y-12">
          {groups.map((group, gi) => {
            const groupPicked = group.matches.filter(m => picks[m.matchId]).length;
            return (
              <section
                key={group.letter}
                className="anim-fade-up"
                style={{ animationDelay: `${gi * 50}ms` }}
              >
                <GroupHeader
                  letter={group.letter}
                  teams={group.teams}
                  picked={groupPicked}
                  total={group.matches.length}
                />
                <GroupStandings matches={group.matches} picks={picks} />
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {group.matches.map((match, mi) => (
                    <PickSlot
                      key={match.matchId}
                      match={match}
                      groupLetter={group.letter}
                      matchNumber={mi + 1}
                      pick={picks[match.matchId] ?? null}
                      odds={oddsMap.get(match.matchId) ?? null}
                      onPick={handlePick}
                      disabled={!isRoundPickable || match.status !== "SCHEDULED"}
                      pointsValue={currentRoundState?.pointsValue ?? 1}
                      popular={popularCounts[match.matchId] ?? null}
                    />
                  ))}
                </div>
              </section>
            );
          })}
          {/* Handle ungrouped group-stage matches (edge case) */}
          <UngroupedRemainder
            allRoundMatches={roundMatches}
            groupMatchIds={new Set(groups.flatMap(g => g.matches.map(m => m.matchId)))}
            picks={picks}
            oddsMap={oddsMap}
            onPick={handlePick}
            isPickable={isRoundPickable}
            pointsValue={currentRoundState?.pointsValue ?? 1}
            popularCounts={popularCounts}
          />
        </div>
      ) : (
        <section className="anim-fade-up grid gap-3 sm:grid-cols-2">
          {roundMatches.map((match, i) => (
            <PickSlot
              key={match.matchId}
              match={match}
              matchNumber={i + 1}
              pick={picks[match.matchId] ?? null}
              odds={oddsMap.get(match.matchId) ?? null}
              onPick={handlePick}
              disabled={!isRoundPickable || match.status !== "SCHEDULED"}
              pointsValue={currentRoundState?.pointsValue ?? 1}
              popular={popularCounts[match.matchId] ?? null}
            />
          ))}
        </section>
      )}


    </div>
  );
}

/* ─────────────────────────────────────────────────────────── */

function GroupHeader({ letter, teams, picked, total }: {
  letter: string; teams: string[]; picked: number; total: number;
}) {
  return (
    <div className="border-b border-line pb-3.5 flex items-end justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-4">
        <div className="flex items-center justify-center h-12 w-12 sm:h-14 sm:w-14 rounded-md bg-ink text-paper font-serif font-bold text-[26px] sm:text-[30px] leading-none shadow-paper" style={{fontVariationSettings: '"opsz" 80'}}>
          {letter}
        </div>
        <div>
          <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-accent mb-1">
            Group {letter}
          </p>
          <p className="font-serif text-[15px] ink leading-tight max-w-md" style={{fontVariationSettings: '"opsz" 24'}}>
            {teams.map(t => (
              <span key={t} className="inline-block mr-1.5">
                <Flag team={t} size={14} className="opacity-70" />{" "}
                <span>{t}</span>
              </span>
            ))}
          </p>
        </div>
      </div>
      <div className="text-right">
        <div className="font-serif font-medium ink tabular leading-none" style={{fontSize: '22px', fontVariationSettings: '"opsz" 60'}}>
          {picked}<span className="ink-faint">/{total}</span>
        </div>
        <p className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.18em] ink-faint">
          Picked
        </p>
      </div>
    </div>
  );
}

function PickSlot({
  match, groupLetter, matchNumber, pick, odds, onPick, disabled, pointsValue, popular,
}: {
  match: Match;
  groupLetter?: string | null;
  matchNumber?: number;
  pick: MatchResult | null;
  odds: OddsData | null;
  onPick: (matchId: string, p: MatchResult) => void;
  disabled: boolean;
  pointsValue: number;
  popular?: PopularCount | null;
}) {
  return (
    <MatchCard
      match={match}
      currentPick={pick}
      odds={odds}
      groupLetter={groupLetter}
      matchNumber={matchNumber}
      onPick={onPick}
      disabled={disabled}
      result={match.result}
      pointsValue={pointsValue}
      popular={popular}
    />
  );
}

function UngroupedRemainder({
  allRoundMatches, groupMatchIds, picks, oddsMap, onPick, isPickable,
  pointsValue, popularCounts,
}: {
  allRoundMatches: Match[];
  groupMatchIds: Set<string>;
  picks: Record<string, MatchResult>;
  oddsMap: Map<string, OddsData>;
  onPick: (id: string, p: MatchResult) => void;
  isPickable: boolean;
  pointsValue: number;
  popularCounts: Record<string, PopularCount>;
}) {
  const remainder = allRoundMatches.filter(m =>
    !groupMatchIds.has(m.matchId) &&
    // Skip placeholder matches where both teams are still TBD
    !(m.homeTeam === "TBD" && m.awayTeam === "TBD")
  );
  if (remainder.length === 0) return null;
  return (
    <section>
      <div className="border-b border-line pb-3.5 mb-5">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-accent mb-1">
          Unsorted
        </p>
        <p className="font-serif text-[18px] ink" style={{fontVariationSettings: '"opsz" 32'}}>
          Matches waiting on group assignment
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {remainder.map(m => (
          <PickSlot
            key={m.matchId}
            match={m}
            pick={picks[m.matchId] ?? null}
            odds={oddsMap.get(m.matchId) ?? null}
            onPick={onPick}
            disabled={!isPickable || m.status !== "SCHEDULED"}
            pointsValue={pointsValue}
            popular={popularCounts[m.matchId] ?? null}
          />
        ))}
      </div>
    </section>
  );
}

/* ─── Group standings projection ───────────────────────────── */

function computeGroupStandings(matches: Match[], picks: Record<string, MatchResult>) {
  const stats = new Map<string, { played: number; w: number; d: number; l: number; pts: number }>();

  for (const m of matches) {
    if (m.homeTeam !== "TBD" && !stats.has(m.homeTeam))
      stats.set(m.homeTeam, { played: 0, w: 0, d: 0, l: 0, pts: 0 });
    if (m.awayTeam !== "TBD" && !stats.has(m.awayTeam))
      stats.set(m.awayTeam, { played: 0, w: 0, d: 0, l: 0, pts: 0 });
  }

  let resolved = 0;
  const total = matches.filter(m => m.homeTeam !== "TBD" && m.awayTeam !== "TBD").length;

  for (const m of matches) {
    if (m.homeTeam === "TBD" || m.awayTeam === "TBD") continue;
    const isFinished = m.status === "FINISHED";
    // Finished → use actual result; scheduled + picked → use pick; otherwise skip
    const result: MatchResult = isFinished ? m.result : (picks[m.matchId] ?? null);
    if (!result) continue;

    resolved++;
    const h = stats.get(m.homeTeam)!;
    const a = stats.get(m.awayTeam)!;
    h.played++;
    a.played++;

    if (result === "H")      { h.w++; h.pts += 3; a.l++; }
    else if (result === "A") { a.w++; a.pts += 3; h.l++; }
    else                     { h.d++; h.pts++;    a.d++; a.pts++; }
  }

  const rows = [...stats.entries()]
    .map(([team, s]) => ({ team, ...s }))
    .sort((a, b) =>
      b.pts !== a.pts ? b.pts - a.pts :
      b.w   !== a.w   ? b.w   - a.w   :
      b.d   !== a.d   ? b.d   - a.d   : 0
    );

  return { rows, resolved, total };
}

function GroupStandings({ matches, picks }: {
  matches: Match[];
  picks: Record<string, MatchResult>;
}) {
  const { rows, resolved, total } = computeGroupStandings(matches, picks);
  if (rows.length === 0) return null;

  const pending = total - resolved;
  const allPicked = pending === 0;

  return (
    <div className="mt-4 rounded-lg border border-line overflow-hidden bg-card shadow-paper">
      {/* Header */}
      <div className="px-4 py-2 border-b border-[color:var(--line-soft)] flex items-center justify-between gap-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] ink-faint">
          Projected standings
        </p>
        <p className={`font-mono text-[10px] ${allPicked ? "text-green-deep" : "ink-faint"}`}>
          {allPicked
            ? "All matches picked ✓"
            : `${pending} match${pending !== 1 ? "es" : ""} unpicked`}
        </p>
      </div>

      {/* Table */}
      <table className="w-full">
        <thead>
          <tr className="border-b border-[color:var(--line-soft)]">
            <th className="pl-4 pr-2 py-1.5 text-left font-mono text-[9px] uppercase tracking-[0.14em] ink-faint w-6">#</th>
            <th className="px-2 py-1.5 text-left font-mono text-[9px] uppercase tracking-[0.14em] ink-faint">Team</th>
            <th className="px-2 py-1.5 text-center font-mono text-[9px] uppercase tracking-[0.14em] ink-faint w-8">P</th>
            <th className="px-2 py-1.5 text-center font-mono text-[9px] uppercase tracking-[0.14em] ink-faint w-8">W</th>
            <th className="px-2 py-1.5 text-center font-mono text-[9px] uppercase tracking-[0.14em] ink-faint w-8">D</th>
            <th className="px-2 py-1.5 text-center font-mono text-[9px] uppercase tracking-[0.14em] ink-faint w-8">L</th>
            <th className="pr-4 pl-2 py-1.5 text-right font-mono text-[9px] uppercase tracking-[0.14em] ink-faint w-10">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const advancing = i < 2;
            return (
              <tr
                key={row.team}
                className={`border-t border-[color:var(--line-soft)] relative
                  ${advancing ? "bg-green-soft/25" : ""}
                `}
              >
                {/* Advancing indicator bar */}
                {advancing && (
                  <td
                    className="absolute left-0 top-0 bottom-0 w-[3px] bg-green-deep rounded-none"
                    aria-hidden="true"
                  />
                )}
                <td className="pl-4 pr-2 py-2">
                  <span className="font-mono text-[11px] ink-faint tabular">{i + 1}</span>
                </td>
                <td className="px-2 py-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Flag team={row.team} size={14} className="flex-shrink-0" />
                    <span className="text-[12px] font-medium ink truncate">{row.team}</span>
                  </div>
                </td>
                <td className="px-2 py-2 text-center font-mono text-[11px] tabular ink-faint">{row.played}</td>
                <td className="px-2 py-2 text-center font-mono text-[11px] tabular ink-soft">{row.w}</td>
                <td className="px-2 py-2 text-center font-mono text-[11px] tabular ink-faint">{row.d}</td>
                <td className="px-2 py-2 text-center font-mono text-[11px] tabular ink-faint">{row.l}</td>
                <td className="pr-4 pl-2 py-2 text-right">
                  <span className={`font-mono text-[13px] font-bold tabular
                    ${advancing ? "text-green-deep" : "ink"}
                  `}>
                    {row.pts}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Celebration modal ────────────────────────────────────── */

const CELEBRATION_COPY: Record<Round, (n: number) => { headline: string; sub: string }> = {
  GROUP:          n => ({
    headline: "That's all of them.",
    sub: `All ${n} group stage picks are in. Sit back, watch the chaos unfold, and check back when the group stage wraps to see how many you nailed.`,
  }),
  ROUND_OF_32:    n => ({
    headline: "Round of 32: done.",
    sub: `${n} picks locked in. Sixteen matches will cut the field in half — come back when the last of them has finished.`,
  }),
  ROUND_OF_16:    n => ({
    headline: "Locked and loaded.",
    sub: `${n} picks set. Eight matches to decide the quarterfinalists. You'll know how you did before you know it.`,
  }),
  QUARTER_FINALS: n => ({
    headline: "Quarters? Sorted.",
    sub: `${n} picks in. Four matches, eight teams, no draws allowed. Come back when four of them are going home.`,
  }),
  SEMI_FINALS:    n => ({
    headline: "Down to the wire.",
    sub: `${n} picks submitted. Two matches stand between you and knowing if your finalist call was right.`,
  }),
  FINAL:          n => ({
    headline: "And that's a wrap.",
    sub: `The final pick is in. The biggest match in football is all that's left. May the best team win — and may your pick be right.`,
  }),
};

// Pre-computed confetti pieces to avoid re-computation on every render
const CONFETTI = Array.from({ length: 28 }, (_, i) => {
  const angle = (i / 28) * 2 * Math.PI;
  const r = 55 + (i % 5) * 22;
  const colors = ['#C9302C','#A07820','#1B5E20','#0B1426','#D4502A','#C8A030','#6090B0','#E8604040'];
  return {
    x: Math.round(Math.cos(angle) * r),
    y: Math.round(Math.sin(angle) * r - 10),
    rot: Math.round(i * 47 + 20),
    delay: i * 22,
    color: colors[i % colors.length],
    w: [8, 10, 6, 10, 7][i % 5],
    h: [5, 7,  8,  5, 6][i % 5],
    br: i % 4 === 0 ? '50%' : i % 3 === 0 ? '2px' : '1px',
  };
});

function ConfettiBurst() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
      {CONFETTI.map((p, i) => (
        <span
          key={i}
          className="absolute"
          style={{
            width: p.w,
            height: p.h,
            borderRadius: p.br,
            backgroundColor: p.color,
            ['--conf-x' as string]: `${p.x}px`,
            ['--conf-y' as string]: `${p.y}px`,
            ['--conf-r' as string]: `${p.rot}deg`,
            animation: `confettiBurst 1.1s cubic-bezier(0.22, 0.61, 0.36, 1) ${p.delay}ms both`,
          }}
        />
      ))}
    </div>
  );
}

function CelebrationModal({ round, roundLabel, pickedCount, lastKickoff, onDismiss }: {
  round: Round;
  roundLabel: string;
  pickedCount: number;
  lastKickoff: string | null;
  onDismiss: () => void;
}) {
  const { headline, sub } = CELEBRATION_COPY[round](pickedCount);

  const endDate = lastKickoff
    ? new Date(lastKickoff).toLocaleDateString("en-CA", {
        weekday: "long", month: "long", day: "numeric",
      })
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-5 anim-fade-in"
      style={{ background: "rgba(11,20,38,0.78)", backdropFilter: "blur(6px)" }}
      onClick={onDismiss}
    >
      <div
        className="celebration-enter relative bg-card rounded-2xl shadow-lift w-full max-w-sm overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Dark header with confetti burst ─────────────── */}
        <div className="relative bg-ink h-36 flex flex-col items-center justify-center overflow-hidden">
          <ConfettiBurst />
          <div className="relative z-10 text-center">
            <span
              className="font-serif font-bold text-paper tabular leading-none"
              style={{ fontSize: "62px", fontVariationSettings: '"opsz" 120' }}
            >
              {pickedCount}
            </span>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.22em] text-paper/40">
              picks made
            </p>
          </div>
        </div>

        {/* ── Content ──────────────────────────────────────── */}
        <div className="px-7 pt-5 pb-7">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-accent mb-3">
            {roundLabel} · Complete
          </p>
          <h2
            className="font-serif font-medium leading-[1.05] tracking-[-0.02em] ink"
            style={{ fontSize: "26px", fontVariationSettings: '"opsz" 72' }}
          >
            {headline}
          </h2>
          <p className="mt-3 text-[14px] ink-soft leading-relaxed">
            {sub}
          </p>

          {endDate && (
            <div className="mt-4 flex items-center gap-3 px-4 py-3 rounded-lg bg-paper-deep border border-line">
              <span className="font-mono text-[18px]">📅</span>
              <div>
                <p className="font-mono text-[9.5px] uppercase tracking-[0.18em] ink-faint">
                  Last match in this round
                </p>
                <p className="text-[13px] font-medium ink mt-0.5">{endDate}</p>
              </div>
            </div>
          )}

          <button
            onClick={onDismiss}
            className="mt-5 w-full py-3 rounded-lg bg-ink text-paper text-[14px] font-semibold hover:bg-accent transition-colors"
          >
            Got it, let&apos;s go →
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ round }: { round: Round }) {
  const messages: Record<Round, string> = {
    GROUP:          "Group stage matches will appear here once the schedule is loaded.",
    ROUND_OF_32:    "The Round of 32 bracket fills in as the group stage ends.",
    ROUND_OF_16:    "Round of 16 opens once the previous round wraps.",
    QUARTER_FINALS: "Quarterfinal matchups will appear once the Round of 16 ends.",
    SEMI_FINALS:    "Semifinal matchups will appear once the quarterfinals end.",
    FINAL:          "The Final will appear once both semifinals are decided.",
  };
  return (
    <div className="bg-card border border-line border-dashed rounded-md p-12 text-center shadow-paper">
      <p className="font-serif italic text-[20px] ink-soft leading-snug max-w-md mx-auto" style={{fontVariationSettings: '"opsz" 40'}}>
        &ldquo;{messages[round]}&rdquo;
      </p>
    </div>
  );
}
