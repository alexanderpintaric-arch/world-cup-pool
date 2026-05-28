"use client";
import { useState, useMemo, useEffect, useRef } from "react";
import type { Match, RoundState, Round } from "@/lib/types";
import { inferGroups } from "@/lib/services/grouping";
import Flag from "@/components/Flag";

// ── Types ────────────────────────────────────────────────────────────────────

type PickCount  = { H: number; A: number; T: number; total: number };
type NamedEntry = { name: string; email: string };
type NamedPicks = { H: NamedEntry[]; A: NamedEntry[]; T: NamedEntry[] };
type Option     = "H" | "A" | "T";

// Bar colours — green (home) / sienna (draw) / blue (away), dark enough for white text
const BAR_HOME = "#1B7A3D";
const BAR_DRAW = "#9B6040";
const BAR_AWAY = "#1E40AF";

interface ModalState {
  matchId:      string;
  homeTeam:     string;
  awayTeam:     string;
  isKnockout:   boolean;
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
  userEmail:   string;
}

// ── Main component ───────────────────────────────────────────────────────────

export default function CommunityClient({
  matches, roundStates, activeRound, counts, named, myPicks, userEmail,
}: Props) {
  const [selectedRound, setSelectedRound] = useState<Round>(
    activeRound?.round ?? "GROUP"
  );
  const [modal, setModal] = useState<ModalState | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "contested" | "my-picks">("all");
  const searchRef = useRef<HTMLInputElement>(null);

  const groups           = useMemo(() => inferGroups(matches), [matches]);
  const roundsWithMatches = roundStates.filter(r => r.matchCount > 0);

  const roundMatches = useMemo(() =>
    matches
      .filter(m => m.round === selectedRound)
      .sort((a, b) => new Date(a.kickoffUtc).getTime() - new Date(b.kickoffUtc).getTime()),
    [matches, selectedRound]
  );

  const isGroupStage = selectedRound === "GROUP";
  const searchQuery = search.trim().toLowerCase();

  // Reset search + filter when switching rounds
  useEffect(() => { setSearch(""); setFilter("all"); }, [selectedRound]);

  // "/" shortcut to focus the search box
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Compute filter counts for pill labels
  const contestedCount = useMemo(() =>
    roundMatches.filter(m => {
      const { H, A, T, total } = counts[m.matchId] ?? { H: 0, A: 0, T: 0, total: 0 };
      if (total === 0) return false;
      return Math.max(H, A, T) / total <= 0.6;
    }).length,
    [roundMatches, counts]
  );
  const myPicksCount = useMemo(() =>
    roundMatches.filter(m => !!myPicks[m.matchId]).length,
    [roundMatches, myPicks]
  );

  // Filtered matches — null = show everything normally (no active filters)
  const filteredMatches = useMemo(() => {
    const isActive = searchQuery.length > 0 || filter !== "all";
    if (!isActive) return null;
    return roundMatches.filter(m => {
      // Search
      if (searchQuery &&
          !m.homeTeam.toLowerCase().includes(searchQuery) &&
          !m.awayTeam.toLowerCase().includes(searchQuery)) return false;
      // Filter: Contested — top pick ≤ 60% of the pool
      if (filter === "contested") {
        const { H, A, T, total } = counts[m.matchId] ?? { H: 0, A: 0, T: 0, total: 0 };
        if (total === 0) return false;
        return Math.max(H, A, T) / total <= 0.6;
      }
      // Filter: My picks — only games I've voted on
      if (filter === "my-picks") return !!myPicks[m.matchId];
      return true;
    });
  }, [roundMatches, searchQuery, filter, counts, myPicks]);

  function openModal(match: Match) {
    const result: Option | null =
      match.result === "H" || match.result === "A" || match.result === "T"
        ? match.result : null;
    setModal({
      matchId:     match.matchId,
      homeTeam:    match.homeTeam,
      awayTeam:    match.awayTeam,
      isKnockout:  match.round !== "GROUP",
      isPreKickoff: match.status === "SCHEDULED",
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

      {/* ── SEARCH + FILTER BAR ─────────────────────────────── */}
      {roundMatches.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 anim-fade-up" style={{ animationDelay: "80ms" }}>

          {/* Search input */}
          <div className={`flex flex-1 min-w-[180px] items-center gap-2.5 px-3.5 h-10 rounded-lg border transition-all duration-150
            ${search ? "border-ink/30 bg-card shadow-paper" : "border-line bg-card/60 hover:border-line/80"}`}
          >
            <svg className="h-3.5 w-3.5 flex-shrink-0 ink-faint/50" fill="none" viewBox="0 0 16 16" aria-hidden="true">
              <circle cx="6.5" cy="6.5" r="4" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M9.5 9.5L13 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === "Escape" && (setSearch(""), searchRef.current?.blur())}
              placeholder="Search teams…"
              aria-label="Search teams in this round"
              className="flex-1 bg-transparent text-[13.5px] ink placeholder:ink-faint/40 outline-none min-w-0"
            />
            {search ? (
              <button
                onClick={() => { setSearch(""); searchRef.current?.focus(); }}
                aria-label="Clear search"
                className="flex-shrink-0 p-1 rounded ink-faint/40 hover:ink-faint transition-colors"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 12 12" aria-hidden="true">
                  <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            ) : (
              <kbd className="hidden sm:flex items-center font-mono text-[9px] ink-faint/30 border border-line/50 rounded px-1.5 py-0.5 flex-shrink-0 select-none">
                /
              </kbd>
            )}
          </div>

          {/* Filter pills */}
          <div className="flex items-center gap-1 flex-shrink-0" role="group" aria-label="Filter matches">
            {([
              { value: "all",       label: "All",       count: roundMatches.length, title: undefined },
              { value: "contested", label: "Contested",  count: contestedCount,      title: "Pool split — top pick ≤ 60%" },
              { value: "my-picks",  label: "My picks",  count: myPicksCount,        title: "Games you've voted on" },
            ] as const).map(({ value, label, count, title }) => (
              <button
                key={value}
                onClick={() => setFilter(value)}
                title={title}
                className={`flex items-center gap-1.5 h-10 px-3 rounded-lg text-[12.5px] font-medium border transition-all
                  ${filter === value
                    ? "bg-ink text-paper border-ink"
                    : "bg-card/60 border-line ink-soft hover:ink hover:border-line/80"
                  }`}
              >
                {label}
                <span className={`font-mono text-[10px] tabular ${filter === value ? "text-paper/50" : "ink-faint/60"}`}>
                  {count}
                </span>
              </button>
            ))}
          </div>

        </div>
      )}

      {/* ── MATCH LIST ──────────────────────────────────────── */}
      {filteredMatches !== null ? (
        /* ── FILTERED / SEARCH RESULTS ──────────────────────── */
        filteredMatches.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <svg className="h-8 w-8 ink-faint/30" fill="none" viewBox="0 0 32 32" aria-hidden="true">
              <circle cx="14" cy="14" r="8" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M20 20L28 28" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <p className="font-serif italic text-[16px] ink-faint/70" style={{ fontVariationSettings: '"opsz" 32' }}>
              {filter === "contested" && !search
                ? "No close calls yet — the pool has strong opinions."
                : filter === "my-picks" && !search
                  ? "No picks made in this round yet."
                  : <>No matches found for &ldquo;{search}&rdquo;</>}
            </p>
            <button
              onClick={() => { setSearch(""); setFilter("all"); }}
              className="font-mono text-[11px] text-accent/80 hover:text-accent underline underline-offset-2 transition-colors"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 anim-fade-up">
            {filteredMatches.map((match, i) => (
              <MatchPicksCard
                key={match.matchId}
                match={match}
                matchNumber={i + 1}
                count={counts[match.matchId] ?? { H: 0, A: 0, T: 0, total: 0 }}
                myPick={myPicks[match.matchId] ?? null}
                onBarClick={() => openModal(match)}
              />
            ))}
          </div>
        )
      ) : isGroupStage ? (
        <div className="space-y-12">
          {groups.map((group, gi) => (
            <section
              key={group.letter}
              className="anim-fade-up"
              style={{ animationDelay: `${gi * 40}ms` }}
            >
              {/* Group header */}
              <div className="border-b border-line pb-4 flex items-center gap-4">
                <div
                  className="flex-shrink-0 flex items-center justify-center h-14 w-14 rounded-lg bg-ink text-paper font-serif font-bold text-[30px] leading-none shadow-paper"
                  style={{ fontVariationSettings: '"opsz" 80' }}
                >
                  {group.letter}
                </div>
                <h2
                  className="font-serif font-medium text-[30px] sm:text-[38px] ink leading-none tracking-[-0.01em]"
                  style={{ fontVariationSettings: '"opsz" 80' }}
                >
                  Group {group.letter}
                </h2>
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
                    onBarClick={() => openModal(match)}
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
                      onBarClick={() => openModal(match)}
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
                  onBarClick={() => openModal(match)}
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
          namedPicks={named[modal.matchId] ?? null}
          counts={counts[modal.matchId] ?? { H: 0, A: 0, T: 0, total: 0 }}
          myPick={myPicks[modal.matchId] ?? null}
          userEmail={userEmail}
          onClose={() => setModal(null)}
        />
      )}

    </div>
  );
}

// ── Ranked colour helper ──────────────────────────────────────────────────────
// Assigns green → blue → sienna to segments in descending pick-count order so
// the most-popular outcome is always visually dominant (green), second is blue,
// minority is sienna. Winner override (full green) still applies post-match.

function getRankedColors(H: number, A: number, T: number, isKnockout: boolean): Record<Option, string> {
  const all: Array<{ key: Option; count: number }> = [
    { key: "H", count: H },
    { key: "A", count: A },
    { key: "T", count: T },
  ];
  // Keep all options (even 0-count) so colours are always distinct — only exclude Draw in knockouts
  const entries = all.filter(e => !isKnockout || e.key !== "T");
  const sorted = [...entries].sort((a, b) => b.count - a.count); // stable: ties preserve H→A→T order
  const RANK = [BAR_HOME, BAR_AWAY, BAR_DRAW]; // 1st=green, 2nd=blue, 3rd=sienna
  const map: Record<Option, string> = { H: BAR_HOME, A: BAR_AWAY, T: BAR_DRAW }; // distinct defaults
  sorted.forEach((e, i) => { map[e.key] = RANK[i] ?? BAR_DRAW; });
  return map;
}

// ── MatchPicksCard ────────────────────────────────────────────────────────────

function MatchPicksCard({
  match, groupLetter, matchNumber, count, myPick, onBarClick,
}: {
  match:        Match;
  groupLetter?: string | null;
  matchNumber?: number;
  count:        PickCount;
  myPick:       Option | null;
  onBarClick:   () => void;
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

  const result: Option | null =
    match.result === "H" || match.result === "A" || match.result === "T"
      ? match.result : null;

  const myPickCorrect = isFinished && myPick !== null && myPick === result;
  const myPickWrong   = isFinished && myPick !== null && myPick !== result;
  const colorMap      = getRankedColors(H, A, T, isKnockout);

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
            <Flag team={match.homeTeam} size={20} />
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
            <Flag team={match.awayTeam} size={20} />
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

        {/* Stacked bar — flag + % embedded in each segment */}
        {total > 0 ? (
          <button
            className="flex h-11 rounded-md overflow-hidden w-full cursor-pointer hover:opacity-90 transition-opacity"
            style={{ gap: "1px", background: "var(--color-line)" }}
            onClick={onBarClick}
            title="See all picks"
          >
            {/* Home segment */}
            {H > 0 && (() => {
              const isWinner = result === "H";
              const isLoser  = result !== null && !isWinner;
              const bg       = isWinner ? "var(--color-green-deep)" : colorMap["H"];
              return (
                <div
                  style={{ flex: H }}
                  className={`relative flex items-center justify-center min-w-0 overflow-hidden ${myPick === "H" ? "ring-2 ring-inset ring-white/30" : ""}`}
                >
                  <div className="absolute inset-0" style={{ background: bg, opacity: isLoser ? 0.5 : 1 }} />
                  {pctH >= 7 && (
                    <div className="relative flex items-center gap-1 px-1 min-w-0">
                      {pctH >= 15 && <Flag team={match.homeTeam} size={13} className="flex-shrink-0" />}
                      <span className="font-mono text-[10px] tabular leading-none select-none font-semibold"
                        style={{ color: isLoser ? colorMap["H"] : "rgba(255,255,255,0.9)" }}>
                        {pctH}%
                      </span>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Draw segment — group stage only */}
            {!isKnockout && T > 0 && (() => {
              const isWinner = result === "T";
              const isLoser  = result !== null && !isWinner;
              const bg       = isWinner ? "var(--color-green-deep)" : colorMap["T"];
              return (
                <div
                  style={{ flex: T }}
                  className={`relative flex items-center justify-center min-w-0 overflow-hidden ${myPick === "T" ? "ring-2 ring-inset ring-white/30" : ""}`}
                >
                  <div className="absolute inset-0" style={{ background: bg, opacity: isLoser ? 0.5 : 1 }} />
                  {pctT >= 7 && (
                    <div className="relative flex items-center gap-1 px-0.5">
                      {pctT >= 15 && (
                        <span className="text-[11px] leading-none flex-shrink-0" style={{ opacity: isLoser ? 0.6 : 0.85 }}>🤝</span>
                      )}
                      <span className="font-mono text-[10px] tabular leading-none select-none font-semibold"
                        style={{ color: isLoser ? colorMap["T"] : "rgba(255,255,255,0.9)" }}>
                        {pctT}%
                      </span>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Away segment */}
            {A > 0 && (() => {
              const isWinner = result === "A";
              const isLoser  = result !== null && !isWinner;
              const bg       = isWinner ? "var(--color-green-deep)" : colorMap["A"];
              return (
                <div
                  style={{ flex: A }}
                  className={`relative flex items-center justify-center min-w-0 overflow-hidden ${myPick === "A" ? "ring-2 ring-inset ring-white/30" : ""}`}
                >
                  <div className="absolute inset-0" style={{ background: bg, opacity: isLoser ? 0.5 : 1 }} />
                  {pctA >= 7 && (
                    <div className="relative flex items-center gap-1 px-1 min-w-0">
                      {pctA >= 15 && <Flag team={match.awayTeam} size={13} className="flex-shrink-0" />}
                      <span className="font-mono text-[10px] tabular leading-none select-none font-semibold"
                        style={{ color: isLoser ? colorMap["A"] : "rgba(255,255,255,0.9)" }}>
                        {pctA}%
                      </span>
                    </div>
                  )}
                </div>
              );
            })()}
          </button>
        ) : (
          <div className="h-11 rounded-md bg-paper-deep border border-line flex items-center justify-center">
            <span className="font-mono text-[10.5px] ink-faint">No picks yet — be the first</span>
          </div>
        )}

        {/* Your pick + tap hint — single compact row */}
        <div className="mt-3 flex items-center justify-between gap-2 min-h-[18px]">
          {myPick ? (
            <span className={`font-mono text-[10.5px] flex items-center gap-1
              ${myPickCorrect ? "text-green-deep" : myPickWrong ? "ink-faint" : "text-accent"}`}
            >
              <span>{myPickCorrect ? "✓" : myPickWrong ? "✗" : "›"}</span>
              <span className={myPickWrong ? "line-through" : ""}>
                You picked {myPick === "H" ? match.homeTeam : myPick === "A" ? match.awayTeam : "Draw"}
              </span>
            </span>
          ) : (
            <span />
          )}
          {total > 0 && (
            <button
              onClick={onBarClick}
              className="font-mono text-[10px] ink-faint/60 hover:ink-faint transition-colors flex-shrink-0"
            >
              see all →
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

// ── UserStack ─────────────────────────────────────────────────────────────────
// Scales cleanly from 1 → 100+ users:
//  • Current user always surfaces as a named chip (you know yourself)
//  • Everyone else appears as overlapping avatar circles, max MAX_AVATARS shown
//  • "+N more" bubble handles overflow without layout explosion

const MAX_AVATARS = 14;

function UserStack({
  users, userEmail, isWinner, isLoser, initials,
}: {
  users:     NamedEntry[];
  userEmail: string;
  isWinner:  boolean;
  isLoser:   boolean;
  initials:  (name: string) => string;
}) {
  const meEntry = users.find(u => u.email === userEmail);
  const others  = users.filter(u => u.email !== userEmail);
  const shown   = others.slice(0, MAX_AVATARS);
  const overflow = others.length - shown.length;

  // Avatar colours
  const avatarBg   = isWinner ? "bg-green-soft"  : "bg-paper-deep";
  const avatarText = isWinner ? "text-green-deep" : "ink-soft";

  return (
    <div className="flex items-center gap-2.5 flex-wrap">

      {/* "You" named chip — always full label so you spot yourself instantly */}
      {meEntry && (
        <div
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium flex-shrink-0
            ${isWinner ? "bg-green-soft text-green-deep" : "bg-ink text-paper"}`}
        >
          <span
            className={`h-4 w-4 rounded-full flex items-center justify-center text-[8.5px] font-bold
              ${isWinner ? "bg-green-deep/20" : "bg-paper/15"}`}
          >
            {initials(meEntry.name)}
          </span>
          <span className="leading-none">{meEntry.name.replace(/\b\w/g, c => c.toUpperCase())}</span>
          <span className="font-mono text-[9px] font-bold leading-none opacity-60">you</span>
          {isWinner && <span className="text-[10px] leading-none">✓</span>}
        </div>
      )}

      {/* Overlapping avatar stack for everyone else */}
      {shown.length > 0 && (
        <div className="flex items-center" style={{ gap: 0 }}>
          {shown.map((user, i) => (
            <div
              key={user.email}
              title={user.name.replace(/\b\w/g, c => c.toUpperCase())}
              style={{
                marginLeft: i > 0 ? "-7px" : 0,
                zIndex:     shown.length - i,
              }}
              className={`h-7 w-7 rounded-full flex items-center justify-center
                text-[9px] font-semibold ring-[1.5px] ring-paper flex-shrink-0
                ${avatarBg} ${avatarText}`}
            >
              {initials(user.name)}
            </div>
          ))}
          {overflow > 0 && (
            <div
              style={{ marginLeft: "-7px", zIndex: 0 }}
              className="h-7 px-2 min-w-[28px] rounded-full flex items-center justify-center
                font-mono text-[10px] font-semibold ring-[1.5px] ring-paper
                bg-line ink-faint flex-shrink-0"
            >
              +{overflow}
            </div>
          )}
        </div>
      )}

      {/* Edge case: only "you" picked this, no others */}
      {!meEntry && shown.length === 0 && (
        <p className="font-mono text-[11px] ink-faint">Nobody picked this.</p>
      )}
    </div>
  );
}

// ── PickModal ─────────────────────────────────────────────────────────────────

function PickModal({
  modal, namedPicks, counts, myPick, userEmail, onClose,
}: {
  modal:       ModalState;
  namedPicks:  NamedPicks | null;
  counts:      PickCount;
  myPick:      Option | null;
  userEmail:   string;
  onClose:     () => void;
}) {
  const { H, A, T, total } = counts;
  const pctH = total > 0 ? Math.round((H / total) * 100) : 0;
  const pctA = total > 0 ? Math.round((A / total) * 100) : 0;
  const pctT = total > 0 ? Math.round((T / total) * 100) : 0;

  const initials = (name: string) =>
    name.split(/\s+/).map(s => s[0] ?? "").join("").slice(0, 2).toUpperCase();

  // Sections to render: Home, optionally Draw, Away
  type Section = {
    opt:    Option;
    label:  string;
    color:  string;
    count:  number;
    pct:    number;
    users:  NamedEntry[];
  };
  const modalColorMap = getRankedColors(H, A, T, modal.isKnockout);
  const sections: Section[] = [
    {
      opt:   "H",
      label: modal.homeTeam,
      color: modal.result === "H" ? "var(--color-green-deep)" : modalColorMap["H"],
      count: H,
      pct:   pctH,
      users: namedPicks?.H ?? [],
    },
    ...(!modal.isKnockout ? [{
      opt:   "T" as Option,
      label: "Draw",
      color: modal.result === "T" ? "var(--color-green-deep)" : modalColorMap["T"],
      count: T,
      pct:   pctT,
      users: namedPicks?.T ?? [],
    }] : []),
    {
      opt:   "A",
      label: modal.awayTeam,
      color: modal.result === "A" ? "var(--color-green-deep)" : modalColorMap["A"],
      count: A,
      pct:   pctA,
      users: namedPicks?.A ?? [],
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ paddingBottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }}
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" />

      {/* Card */}
      <div
        className="relative bg-paper border border-line rounded-t-2xl sm:rounded-xl shadow-lift w-full sm:max-w-md overflow-hidden anim-scale-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Mobile drag handle */}
        <div className="sm:hidden absolute top-2.5 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-line" />

        {/* Header */}
        <div className="px-5 pt-6 sm:pt-4 pb-4 border-b border-line flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] ink-faint mb-1">
              Pick breakdown
            </p>
            <p
              className="font-serif font-medium text-[18px] ink leading-tight"
              style={{ fontVariationSettings: '"opsz" 32' }}
            >
              {modal.homeTeam} <span className="ink-faint font-light italic text-[15px]">vs</span> {modal.awayTeam}
            </p>
            <p className="mt-1 font-mono text-[11px] ink-faint">
              {total === 0
                ? "No picks yet"
                : `${total} ${total === 1 ? "pick" : "picks"} in the pool`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 h-7 w-7 rounded-full bg-paper-deep hover:bg-line flex items-center justify-center ink-faint hover:ink transition-colors mt-0.5"
            aria-label="Close"
          >
            <span className="text-[13px] leading-none">✕</span>
          </button>
        </div>

        {/* Sections */}
        <div className="overflow-y-auto overscroll-contain" style={{ maxHeight: "calc(100dvh - 4.5rem - env(safe-area-inset-bottom) - 160px)" }}>
          {sections.map((sec, idx) => {
            const isWinner  = modal.result === sec.opt;
            const isLoser   = modal.result !== null && modal.result !== sec.opt;
            const isMyPick  = myPick === sec.opt;

            return (
              <div
                key={sec.opt}
                className={`px-5 py-4 ${idx < sections.length - 1 ? "border-b border-line" : ""} ${isLoser ? "opacity-50" : ""}`}
              >
                {/* Section header */}
                <div className="flex items-center gap-2.5 mb-2.5">
                  {/* Color swatch */}
                  <span
                    className="h-3 w-3 rounded-sm flex-shrink-0"
                    style={{ background: sec.color }}
                  />
                  {/* Option label */}
                  <span
                    className={`font-serif text-[15px] font-medium leading-none flex-1 min-w-0 truncate
                      ${isWinner ? "text-green-deep" : "ink"}`}
                    style={{ fontVariationSettings: '"opsz" 24' }}
                  >
                    {sec.label}
                    {isWinner && (
                      <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.12em] text-green-deep font-semibold not-italic">
                        ✓ winner
                      </span>
                    )}
                  </span>
                  {/* Stats */}
                  <div className="flex items-baseline gap-1.5 flex-shrink-0">
                    <span className="font-mono text-[13px] font-semibold tabular ink">{sec.pct}%</span>
                    <span className="font-mono text-[10px] ink-faint">({sec.count})</span>
                    {isMyPick && (
                      <span className={`font-mono text-[10px] font-semibold
                        ${isWinner ? "text-green-deep" : isLoser ? "ink-faint line-through" : "text-accent"}`}>
                        you
                      </span>
                    )}
                  </div>
                </div>

                {/* Mini progress bar */}
                <div className="h-1.5 rounded-full overflow-hidden mb-3" style={{ background: "var(--color-line)" }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${sec.pct}%`, background: sec.color, opacity: 0.72 }}
                  />
                </div>

                {/* User chips / privacy message */}
                {modal.isPreKickoff ? (
                  <div className="flex items-center gap-2 py-1">
                    <span className="text-[14px]">🔒</span>
                    <span className="font-mono text-[11px] ink-faint">
                      {sec.count === 0
                        ? "Nobody picked this yet."
                        : `${sec.count} ${sec.count === 1 ? "person" : "people"} — revealed at kickoff.`}
                    </span>
                  </div>
                ) : sec.users.length === 0 ? (
                  <p className="font-mono text-[11px] ink-faint py-1">Nobody picked this.</p>
                ) : (
                  <UserStack
                    users={sec.users}
                    userEmail={userEmail}
                    isWinner={isWinner}
                    isLoser={isLoser}
                    initials={initials}
                  />
                )}
              </div>
            );
          })}

          {total === 0 && (
            <div className="px-5 py-10 text-center">
              <p className="font-serif italic text-[16px] ink-soft" style={{ fontVariationSettings: '"opsz" 32' }}>
                No picks have been made yet.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
