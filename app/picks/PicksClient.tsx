"use client";
import { useState, useCallback, useMemo } from "react";
import type { Match, Pick, OddsData, RoundState, MatchResult, Round } from "@/lib/types";
import { ROUND_CONFIG } from "@/lib/constants";
import { inferGroups } from "@/lib/services/grouping";
import { flagFor } from "@/lib/services/flags";
import MatchCard from "@/components/MatchCard";
import CountdownTimer from "@/components/CountdownTimer";

interface Props {
  matches: Match[];
  userPicks: Pick[];
  odds: OddsData[];
  roundStates: RoundState[];
  activeRound: RoundState | null;
  userEmail: string;
  userName: string;
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
  matches, userPicks, odds, roundStates, activeRound, userName,
}: Props) {
  const [selectedRound, setSelectedRound] = useState<Round>(
    activeRound?.round ?? "GROUP"
  );
  const [picks, setPicks] = useState<Record<string, MatchResult>>(() => {
    const init: Record<string, MatchResult> = {};
    for (const p of userPicks) init[p.matchId] = p.pick;
    return init;
  });
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const oddsMap = useMemo(() => new Map(odds.map(o => [o.matchId, o])), [odds]);
  const currentRoundState = roundStates.find(r => r.round === selectedRound);
  const isOpen = currentRoundState?.isOpen ?? false;

  const groups = useMemo(() => inferGroups(matches), [matches]);

  // Matches for the selected round (knockout case)
  const roundMatches = useMemo(() =>
    matches
      .filter(m => m.round === selectedRound)
      .sort((a, b) => new Date(a.kickoffUtc).getTime() - new Date(b.kickoffUtc).getTime()),
    [matches, selectedRound]
  );

  // For group stage we render by group; for knockouts we render flat.
  const isGroupStage = selectedRound === "GROUP";

  const pickedCount = roundMatches.filter(m => picks[m.matchId]).length;
  const totalCount = roundMatches.length;
  const pct = totalCount > 0 ? (pickedCount / totalCount) * 100 : 0;

  const savePick = useCallback(async (matchId: string, pick: MatchResult) => {
    setSaving(s => ({ ...s, [matchId]: true }));
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
      } else {
        setSaved(s => ({ ...s, [matchId]: true }));
        setTimeout(() => setSaved(s => ({ ...s, [matchId]: false })), 1500);
      }
    } catch {
      setError("Network hiccup — pick not saved");
    } finally {
      setSaving(s => ({ ...s, [matchId]: false }));
    }
  }, []);

  function handlePick(matchId: string, pick: MatchResult) {
    setPicks(p => ({ ...p, [matchId]: pick }));
    savePick(matchId, pick);
  }

  const roundsWithMatches = roundStates.filter(r => r.matchCount > 0);
  const firstName = (userName ?? "").split(/\s+/)[0] || "friend";

  return (
    <div className="space-y-10">

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
            label={`${activeRound.label} closes`}
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
            return (
              <button
                key={rs.round}
                onClick={() => setSelectedRound(rs.round)}
                className={`group relative flex-shrink-0 px-4 py-2.5 rounded-md text-[13.5px] font-medium transition-all border
                  ${active
                    ? "bg-ink text-paper border-ink"
                    : "bg-card border-line ink-soft hover:ink hover:border-[color:var(--ink-faint)]/40"
                  }
                `}
              >
                <span className="flex items-center gap-2">
                  {rs.label}
                  {rs.isOpen && !active && (
                    <span className="h-1.5 w-1.5 rounded-full bg-accent anim-ring-pulse" />
                  )}
                  {rs.isComplete && (
                    <span className="font-mono text-[10px] text-gold">✓</span>
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
            <div className="mt-3 flex items-center justify-between text-[11.5px] ink-faint">
              <span>
                {isOpen ? "Open for picks" : currentRoundState.isComplete ? "Round complete" : "Picks locked"}
              </span>
              <span className="font-mono">
                {currentRoundState.pointsValue}pt per correct pick
              </span>
            </div>
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
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {group.matches.map((match, mi) => (
                    <PickSlot
                      key={match.matchId}
                      match={match}
                      groupLetter={group.letter}
                      matchNumber={mi + 1}
                      pick={picks[match.matchId] ?? null}
                      odds={oddsMap.get(match.matchId) ?? null}
                      onPick={handlePick}
                      disabled={!isOpen}
                      saving={saving[match.matchId]}
                      saved={saved[match.matchId]}
                      pointsValue={currentRoundState?.pointsValue ?? 1}
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
            disabled={!isOpen}
            saving={saving}
            saved={saved}
            pointsValue={currentRoundState?.pointsValue ?? 1}
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
              disabled={!isOpen}
              saving={saving[match.matchId]}
              saved={saved[match.matchId]}
              pointsValue={currentRoundState?.pointsValue ?? 1}
            />
          ))}
        </section>
      )}

      {/* ── FOOTER NOTE ──────────────────────────────────────── */}
      {totalCount > 0 && pct === 100 && (
        <div className="anim-fade-up bg-green-soft border border-[color:var(--green)]/20 rounded-md px-6 py-5 text-center">
          <p className="font-serif italic text-[20px] text-green-deep leading-snug" style={{fontVariationSettings: '"opsz" 32'}}>
            All set. Every match in this round is picked.
          </p>
          <p className="mt-1.5 text-[13px] ink-soft">
            We&rsquo;ll update the leaderboard as games finish. You can still change picks until the deadline.
          </p>
        </div>
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
                <span className="ink-faint text-[13px]">{flagFor(t)}</span>{" "}
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
  match, groupLetter, matchNumber, pick, odds, onPick, disabled, saving, saved, pointsValue,
}: {
  match: Match;
  groupLetter?: string | null;
  matchNumber?: number;
  pick: MatchResult | null;
  odds: OddsData | null;
  onPick: (matchId: string, p: MatchResult) => void;
  disabled: boolean;
  saving?: boolean;
  saved?: boolean;
  pointsValue: number;
}) {
  return (
    <div className="relative">
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
      />
      {(saving || saved) && (
        <div className={`absolute top-3 right-3 text-[10px] font-mono uppercase tracking-[0.16em] px-1.5 py-0.5 rounded transition-opacity
          ${saved ? "text-green-deep bg-green-soft anim-fade-in" : "ink-faint bg-paper-deep"}
        `}>
          {saved ? "Saved ✓" : "Saving…"}
        </div>
      )}
    </div>
  );
}

function UngroupedRemainder({ allRoundMatches, groupMatchIds, picks, oddsMap, onPick, disabled, saving, saved, pointsValue }: {
  allRoundMatches: Match[];
  groupMatchIds: Set<string>;
  picks: Record<string, MatchResult>;
  oddsMap: Map<string, OddsData>;
  onPick: (id: string, p: MatchResult) => void;
  disabled: boolean;
  saving: Record<string, boolean>;
  saved: Record<string, boolean>;
  pointsValue: number;
}) {
  const remainder = allRoundMatches.filter(m => !groupMatchIds.has(m.matchId));
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
            disabled={disabled}
            saving={saving[m.matchId]}
            saved={saved[m.matchId]}
            pointsValue={pointsValue}
          />
        ))}
      </div>
    </section>
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
