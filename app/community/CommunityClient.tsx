"use client";
import { useState, useMemo } from "react";
import type { Match, RoundState, Round } from "@/lib/types";
import { inferGroups } from "@/lib/services/grouping";
import { flagFor } from "@/lib/services/flags";

// ── Types ────────────────────────────────────────────────────────────────────

type PickCount  = { H: number; A: number; T: number; total: number };
type NamedEntry = { name: string; email: string };
type NamedPicks = { H: NamedEntry[]; A: NamedEntry[]; T: NamedEntry[] };
type Option     = "H" | "A" | "T";

interface ModalState {
  matchId:      string;
  option:       Option;
  optionLabel:  string;
  matchLabel:   string;
  isPreKickoff: boolean;
  result:       Option | null;
}

interface Props {
  matches:     Match[];
  roundStates: RoundState[];
  activeRound: RoundState | null;
  counts:      Record<string, PickCount>;
  named:       Record<string, NamedPicks>;
  myPicks:     Record<string, Option>;
}

// ── Main component ───────────────────────────────────────────────────────────

export default function CommunityClient({
  matches, roundStates, activeRound, counts, named, myPicks,
}: Props) {
  const [selectedRound, setSelectedRound] = useState<Round>(
    activeRound?.round ?? "GROUP"
  );
  const [modal, setModal] = useState<ModalState | null>(null);

  const groups           = useMemo(() => inferGroups(matches), [matches]);
  const roundsWithMatches = roundStates.filter(r => r.matchCount > 0);

  const roundMatches = useMemo(() =>
    matches
      .filter(m => m.round === selectedRound)
      .sort((a, b) => new Date(a.kickoffUtc).getTime() - new Date(b.kickoffUtc).getTime()),
    [matches, selectedRound]
  );

  const isGroupStage = selectedRound === "GROUP";

  function openModal(match: Match, option: Option) {
    const isPreKickoff = match.status === "SCHEDULED";
    const optionLabel  =
      option === "H" ? match.homeTeam :
      option === "A" ? match.awayTeam : "Draw";
    const result: Option | null =
      match.result === "H" || match.result === "A" || match.result === "T"
        ? match.result : null;
    setModal({
      matchId:     match.matchId,
      option,
      optionLabel,
      matchLabel:  `${match.homeTeam} vs ${match.awayTeam}`,
      isPreKickoff,
      result,
    });
  }

  // ── Grouped match IDs (for remainder detection) ──────────────────────────
  const groupMatchIds = useMemo(
    () => new Set(groups.flatMap(g => g.matches.map(m => m.matchId))),
    [groups]
  );

  return (
    <div className="space-y-10">

      {/* ── PAGE HEADER ─────────────────────────────────────── */}
      <header className="anim-fade-up">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] ink-faint mb-3">
          The Pool
        </p>
        <h1
          className="font-serif font-medium leading-[1.02] tracking-[-0.02em] ink"
          style={{ fontSize: "clamp(2.25rem, 5vw, 3.5rem)", fontVariationSettings: '"opsz" 120' }}
        >
          Everyone&rsquo;s{" "}
          <span className="italic text-accent">picks.</span>
        </h1>
        <p className="mt-3 text-[15px] ink-soft max-w-xl">
          See how the pool voted on every match. Names stay hidden until
          kickoff — then the full breakdown is revealed.
        </p>
      </header>

      {/* ── ROUND TABS ──────────────────────────────────────── */}
      <nav className="anim-fade-up" style={{ animationDelay: "60ms" }}>
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          {roundsWithMatches.map(rs => {
            const active = selectedRound === rs.round;
            return (
              <button
                key={rs.round}
                onClick={() => setSelectedRound(rs.round)}
                className={`flex-shrink-0 px-4 py-2.5 rounded-md text-[13.5px] font-medium transition-all border
                  ${active
                    ? "bg-ink text-paper border-ink"
                    : "bg-card border-line ink-soft hover:ink hover:border-[color:var(--ink-faint)]/40"
                  }`}
              >
                {rs.label}
              </button>
            );
          })}
          {roundsWithMatches.length === 0 && (
            <p className="ink-faint text-[14px] italic font-serif px-2 py-2">
              Waiting for the schedule…
            </p>
          )}
        </div>
      </nav>

      {/* ── MATCH LIST ──────────────────────────────────────── */}
      {isGroupStage ? (
        <div className="space-y-12">
          {groups.map((group, gi) => (
            <section
              key={group.letter}
              className="anim-fade-up"
              style={{ animationDelay: `${gi * 40}ms` }}
            >
              {/* Group header */}
              <div className="border-b border-line pb-3.5 flex items-center gap-4">
                <div
                  className="flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-md bg-ink text-paper font-serif font-bold text-[26px] leading-none shadow-paper"
                  style={{ fontVariationSettings: '"opsz" 80' }}
                >
                  {group.letter}
                </div>
                <div>
                  <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-accent mb-1">
                    Group {group.letter}
                  </p>
                  <p className="font-serif text-[15px] ink leading-tight" style={{ fontVariationSettings: '"opsz" 24' }}>
                    {group.teams.map(t => (
                      <span key={t} className="inline-block mr-2.5">
                        <span className="emoji text-[13px]">{flagFor(t)}</span>{" "}
                        <span>{t}</span>
                      </span>
                    ))}
                  </p>
                </div>
              </div>

              {/* Group matches */}
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {group.matches.map((match, mi) => (
                  <MatchPicksCard
                    key={match.matchId}
                    match={match}
                    groupLetter={group.letter}
                    matchNumber={mi + 1}
                    count={counts[match.matchId] ?? { H: 0, A: 0, T: 0, total: 0 }}
                    myPick={myPicks[match.matchId] ?? null}
                    onSegmentClick={opt => openModal(match, opt)}
                  />
                ))}
              </div>
            </section>
          ))}

          {/* Ungrouped remainder */}
          {(() => {
            const remainder = roundMatches.filter(m => !groupMatchIds.has(m.matchId));
            if (remainder.length === 0) return null;
            return (
              <section>
                <div className="border-b border-line pb-3.5 mb-5">
                  <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-accent mb-1">Unsorted</p>
                  <p className="font-serif text-[18px] ink" style={{ fontVariationSettings: '"opsz" 32' }}>
                    Matches pending group assignment
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {remainder.map(match => (
                    <MatchPicksCard
                      key={match.matchId}
                      match={match}
                      count={counts[match.matchId] ?? { H: 0, A: 0, T: 0, total: 0 }}
                      myPick={myPicks[match.matchId] ?? null}
                      onSegmentClick={opt => openModal(match, opt)}
                    />
                  ))}
                </div>
              </section>
            );
          })()}
        </div>
      ) : (
        <div className="anim-fade-up">
          {roundMatches.length === 0 ? (
            <div className="bg-card border border-line border-dashed rounded-md p-12 text-center shadow-paper">
              <p className="font-serif italic text-[18px] ink-soft" style={{ fontVariationSettings: '"opsz" 32' }}>
                Matchups will appear once the bracket is set.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {roundMatches.map((match, i) => (
                <MatchPicksCard
                  key={match.matchId}
                  match={match}
                  matchNumber={i + 1}
                  count={counts[match.matchId] ?? { H: 0, A: 0, T: 0, total: 0 }}
                  myPick={myPicks[match.matchId] ?? null}
                  onSegmentClick={opt => openModal(match, opt)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── MODAL ───────────────────────────────────────────── */}
      {modal && (
        <PickModal
          modal={modal}
          users={named[modal.matchId]?.[modal.option] ?? []}
          count={counts[modal.matchId]?.[modal.option] ?? 0}
          onClose={() => setModal(null)}
        />
      )}

    </div>
  );
}

// ── MatchPicksCard ────────────────────────────────────────────────────────────

function MatchPicksCard({
  match, groupLetter, matchNumber, count, myPick, onSegmentClick,
}: {
  match:          Match;
  groupLetter?:   string | null;
  matchNumber?:   number;
  count:          PickCount;
  myPick:         Option | null;
  onSegmentClick: (opt: Option) => void;
}) {
  const isKnockout = match.round !== "GROUP";
  const isFinished = match.status === "FINISHED";
  const isLive     = match.status === "IN_PLAY" || match.status === "PAUSED" || match.status === "LIVE";

  const { H, A, T, total } = count;
  const pctH = total > 0 ? Math.round((H / total) * 100) : 0;
  const pctA = total > 0 ? Math.round((A / total) * 100) : 0;
  const pctT = total > 0 ? Math.round((T / total) * 100) : 0;

  const kickoff   = new Date(match.kickoffUtc);
  const dateLabel = kickoff.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
  const timeLabel = kickoff.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" });

  const myPickLabel =
    myPick === "H" ? match.homeTeam :
    myPick === "A" ? match.awayTeam :
    myPick === "T" ? "Draw" : null;

  const result: Option | null =
    match.result === "H" || match.result === "A" || match.result === "T"
      ? match.result : null;

  const myPickCorrect = isFinished && myPick !== null && myPick === result;
  const myPickWrong   = isFinished && myPick !== null && myPick !== result;

  return (
    <article
      className={`relative bg-card border rounded-lg overflow-hidden shadow-paper transition-all
        ${isLive
          ? "border-2 border-accent"
          : "border-line hover:border-[color:var(--ink-faint)]/30 hover:shadow-lift"
        }`}
    >
      {/* ── Header ── */}
      <div className={`px-4 pt-3 pb-2.5 border-b flex items-center justify-between gap-2
        ${isLive ? "border-accent/15 bg-accent-soft/40" : "border-[color:var(--line-soft)]"}`}
      >
        <div className="flex items-center gap-2">
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
          {isLive && (
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-accent anim-ring-pulse" />
              <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-accent font-bold">Live</span>
            </span>
          )}
          {isFinished && (
            <span className="font-mono text-[9px] uppercase tracking-[0.18em] ink-faint">Full time</span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {total > 0 && (
            <span className="font-mono text-[10px] ink-faint">
              {total} {total === 1 ? "pick" : "picks"}
            </span>
          )}
          <span className="font-mono text-[10.5px] tabular ink-faint">{dateLabel} · {timeLabel}</span>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="px-4 pt-3.5 pb-4">

        {/* Teams row */}
        <div className="flex items-center justify-between mb-3 gap-2">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span className="emoji text-[18px] leading-none flex-shrink-0">{flagFor(match.homeTeam) || "⚪"}</span>
            <span
              className={`font-serif text-[14px] sm:text-[15px] font-medium leading-tight truncate ink ${!match.homeTeam || match.homeTeam === "TBD" ? "ink-faint italic" : ""}`}
              style={{ fontVariationSettings: '"opsz" 24' }}
            >
              {match.homeTeam || "TBD"}
            </span>
            {isFinished && match.homeScore !== null && (
              <span className="font-mono text-[18px] font-bold tabular ink ml-auto flex-shrink-0">
                {match.homeScore}
              </span>
            )}
          </div>

          <div className="flex-shrink-0 px-1.5">
            <span className="font-serif italic text-[12px] ink-faint" style={{ fontVariationSettings: '"opsz" 24' }}>
              {isFinished ? "FT" : "vs"}
            </span>
          </div>

          <div className="flex items-center gap-1.5 min-w-0 flex-1 flex-row-reverse justify-start">
            <span className="emoji text-[18px] leading-none flex-shrink-0">{flagFor(match.awayTeam) || "⚪"}</span>
            <span
              className={`font-serif text-[14px] sm:text-[15px] font-medium leading-tight truncate text-right ink ${!match.awayTeam || match.awayTeam === "TBD" ? "ink-faint italic" : ""}`}
              style={{ fontVariationSettings: '"opsz" 24' }}
            >
              {match.awayTeam || "TBD"}
            </span>
            {isFinished && match.awayScore !== null && (
              <span className="font-mono text-[18px] font-bold tabular ink mr-auto flex-shrink-0">
                {match.awayScore}
              </span>
            )}
          </div>
        </div>

        {/* Stacked bar */}
        {total > 0 ? (
          <div className="flex h-9 rounded-md overflow-hidden" style={{ gap: "1px", background: "var(--color-line)" }}>
            {H > 0 && (
              <button
                style={{ flex: H }}
                className={`group flex items-center justify-center transition-opacity hover:opacity-75 cursor-pointer min-w-0
                  ${result === "H" ? "bg-green-deep" : "bg-ink"}
                  ${myPick === "H" ? "ring-2 ring-inset ring-white/25" : ""}`}
                onClick={() => onSegmentClick("H")}
                title={`${match.homeTeam}: ${pctH}% · ${H} ${H === 1 ? "pick" : "picks"}`}
              >
                {pctH >= 13 && (
                  <span className="font-mono text-[10px] text-paper/80 tabular leading-none select-none">
                    {pctH}%
                  </span>
                )}
              </button>
            )}
            {!isKnockout && T > 0 && (
              <button
                style={{ flex: T }}
                className={`group flex items-center justify-center transition-opacity hover:opacity-75 cursor-pointer min-w-0
                  ${result === "T" ? "bg-green-deep" : "bg-ink-faint"}
                  ${myPick === "T" ? "ring-2 ring-inset ring-white/25" : ""}`}
                onClick={() => onSegmentClick("T")}
                title={`Draw: ${pctT}% · ${T} ${T === 1 ? "pick" : "picks"}`}
              >
                {pctT >= 13 && (
                  <span className="font-mono text-[10px] text-paper/80 tabular leading-none select-none">
                    {pctT}%
                  </span>
                )}
              </button>
            )}
            {A > 0 && (
              <button
                style={{ flex: A }}
                className={`group flex items-center justify-center transition-opacity hover:opacity-75 cursor-pointer min-w-0
                  ${result === "A" ? "bg-green-deep" : "bg-accent"}
                  ${myPick === "A" ? "ring-2 ring-inset ring-white/25" : ""}`}
                onClick={() => onSegmentClick("A")}
                title={`${match.awayTeam}: ${pctA}% · ${A} ${A === 1 ? "pick" : "picks"}`}
              >
                {pctA >= 13 && (
                  <span className="font-mono text-[10px] text-paper/80 tabular leading-none select-none">
                    {pctA}%
                  </span>
                )}
              </button>
            )}
          </div>
        ) : (
          <div className="h-9 rounded-md bg-paper-deep border border-line flex items-center justify-center">
            <span className="font-mono text-[10.5px] ink-faint">No picks yet — be the first</span>
          </div>
        )}

        {/* Legend */}
        <div className={`mt-2.5 flex items-start ${isKnockout ? "justify-between" : "justify-between"} gap-1`}>
          {/* Home */}
          <button
            className={`flex flex-col items-start gap-px cursor-pointer transition-colors hover:ink group min-w-0
              ${myPick === "H" ? "ink" : "ink-faint"}`}
            onClick={() => onSegmentClick("H")}
          >
            <span className="font-mono text-[12px] font-semibold tabular leading-none">
              {pctH}%
            </span>
            <span className="font-mono text-[10px] leading-none">
              {H} {H === 1 ? "pick" : "picks"}
            </span>
            {myPick === "H" && (
              <span className={`font-mono text-[9px] font-semibold mt-0.5 ${myPickCorrect ? "text-green-deep" : myPickWrong ? "line-through opacity-50" : "text-accent"}`}>
                {myPickCorrect ? "✓ you" : myPickWrong ? "✗ you" : "← you"}
              </span>
            )}
          </button>

          {/* Draw — group stage only */}
          {!isKnockout && (
            <button
              className={`flex flex-col items-center gap-px cursor-pointer transition-colors hover:ink
                ${myPick === "T" ? "ink" : "ink-faint"}`}
              onClick={() => onSegmentClick("T")}
            >
              <span className="font-mono text-[12px] font-semibold tabular leading-none">
                {pctT}%
              </span>
              <span className="font-mono text-[10px] leading-none">Draw</span>
              {myPick === "T" && (
                <span className={`font-mono text-[9px] font-semibold mt-0.5 ${myPickCorrect ? "text-green-deep" : myPickWrong ? "line-through opacity-50" : "text-accent"}`}>
                  {myPickCorrect ? "✓ you" : myPickWrong ? "✗ you" : "you"}
                </span>
              )}
            </button>
          )}

          {/* Away */}
          <button
            className={`flex flex-col items-end gap-px cursor-pointer transition-colors hover:ink text-right
              ${myPick === "A" ? "ink" : "ink-faint"}`}
            onClick={() => onSegmentClick("A")}
          >
            <span className="font-mono text-[12px] font-semibold tabular leading-none">
              {pctA}%
            </span>
            <span className="font-mono text-[10px] leading-none">
              {A} {A === 1 ? "pick" : "picks"}
            </span>
            {myPick === "A" && (
              <span className={`font-mono text-[9px] font-semibold mt-0.5 ${myPickCorrect ? "text-green-deep" : myPickWrong ? "line-through opacity-50" : "text-accent"}`}>
                {myPickCorrect ? "you ✓" : myPickWrong ? "you ✗" : "you →"}
              </span>
            )}
          </button>
        </div>

        {/* "Click to reveal" hint — only show when there are picks */}
        {total > 0 && (
          <p className="mt-2 font-mono text-[9.5px] ink-faint/60 text-center leading-none">
            tap a segment to see who picked
          </p>
        )}
      </div>
    </article>
  );
}

// ── PickModal ─────────────────────────────────────────────────────────────────

function PickModal({
  modal, users, count, onClose,
}: {
  modal:    ModalState;
  users:    NamedEntry[];
  count:    number;
  onClose:  () => void;
}) {
  const optionIsCorrect = modal.result !== null && modal.option === modal.result;
  const optionIsWrong   = modal.result !== null && modal.option !== modal.result;

  const initials = (name: string) =>
    name.split(/\s+/).map(s => s[0] ?? "").join("").slice(0, 2).toUpperCase();

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" />

      {/* Card */}
      <div
        className="relative bg-paper border border-line rounded-t-2xl sm:rounded-xl shadow-lift w-full sm:max-w-sm overflow-hidden anim-scale-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`px-5 py-4 border-b flex items-start justify-between gap-4
          ${optionIsCorrect
            ? "border-green-deep/20 bg-green-soft/60"
            : optionIsWrong
              ? "border-line bg-paper-deep/50"
              : "border-line"
          }`}
        >
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] ink-faint mb-1 truncate">
              {modal.matchLabel}
            </p>
            <div className="flex items-baseline gap-2 flex-wrap">
              <p
                className={`font-serif font-medium text-[19px] leading-tight
                  ${optionIsCorrect ? "text-green-deep" : "ink"}`}
                style={{ fontVariationSettings: '"opsz" 32' }}
              >
                {modal.optionLabel}
              </p>
              {optionIsCorrect && (
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-green-deep font-semibold">
                  ✓ Winner
                </span>
              )}
              {optionIsWrong && modal.result !== null && (
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] ink-faint">
                  Not the winner
                </span>
              )}
            </div>
            <p className="mt-1 font-mono text-[11px] ink-faint">
              {modal.isPreKickoff
                ? `${count} ${count === 1 ? "person" : "people"} picked this`
                : `${count} ${count === 1 ? "pick" : "picks"}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 h-7 w-7 rounded-full bg-paper-deep hover:bg-line flex items-center justify-center ink-faint hover:ink transition-colors"
            aria-label="Close"
          >
            <span className="text-[13px] leading-none">✕</span>
          </button>
        </div>

        {/* User list */}
        <div className="px-5 py-4 max-h-72 overflow-y-auto overscroll-contain">
          {modal.isPreKickoff ? (
            <div className="py-6 text-center">
              <div className="text-[28px] mb-3">🔒</div>
              <p className="font-serif italic text-[16px] ink-soft leading-snug" style={{ fontVariationSettings: '"opsz" 32' }}>
                Names are kept private until kickoff.
              </p>
              <p className="mt-2 font-mono text-[11px] ink-faint">
                {count === 0
                  ? "Nobody has picked this yet."
                  : `${count} ${count === 1 ? "person has" : "people have"} made their pick here.`}
                {count > 0 && " Check back after the match starts."}
              </p>
            </div>
          ) : users.length === 0 ? (
            <div className="py-6 text-center">
              <p className="font-mono text-[12px] ink-faint">Nobody picked this option.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {users.map(user => (
                <div key={user.email} className="flex items-center gap-3">
                  <div
                    className={`h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-semibold flex-shrink-0 tracking-wide
                      ${optionIsCorrect
                        ? "bg-green-soft text-green-deep"
                        : "bg-paper-deep ink-soft"
                      }`}
                  >
                    {initials(user.name)}
                  </div>
                  <span
                    className={`text-[14px] font-medium flex-1 min-w-0 truncate
                      ${optionIsCorrect ? "ink" : optionIsWrong ? "ink-faint" : "ink"}`}
                  >
                    {user.name}
                  </span>
                  {optionIsCorrect && (
                    <span className="font-mono text-[11px] text-green-deep font-semibold flex-shrink-0">✓</span>
                  )}
                  {optionIsWrong && modal.result !== null && (
                    <span className="font-mono text-[11px] ink-faint opacity-40 flex-shrink-0">✗</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Mobile drag handle hint */}
        <div className="sm:hidden absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-line" />
      </div>
    </div>
  );
}
