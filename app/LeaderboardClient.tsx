"use client";
import { useState, useMemo, useTransition } from "react";
import type { LeaderboardEntry, Match, RoundState, OddsData } from "@/lib/types";
import { ROUND_CONFIG } from "@/lib/constants";
import Flag from "@/components/Flag";
import { handleSetSupportedTeam } from "@/app/actions";

// ── WC 2026 participants ────────────────────────────────────────────────────
// 48 teams across 6 confederations

const WC2026_TEAMS: { name: string; conf: string }[] = [
  // CONCACAF
  { name: "Canada",        conf: "CONCACAF" },
  { name: "Mexico",        conf: "CONCACAF" },
  { name: "United States", conf: "CONCACAF" },
  { name: "Panama",        conf: "CONCACAF" },
  { name: "Costa Rica",    conf: "CONCACAF" },
  { name: "Honduras",      conf: "CONCACAF" },
  // CONMEBOL
  { name: "Argentina",     conf: "CONMEBOL" },
  { name: "Brazil",        conf: "CONMEBOL" },
  { name: "Uruguay",       conf: "CONMEBOL" },
  { name: "Colombia",      conf: "CONMEBOL" },
  { name: "Ecuador",       conf: "CONMEBOL" },
  { name: "Paraguay",      conf: "CONMEBOL" },
  { name: "Venezuela",     conf: "CONMEBOL" },
  // UEFA
  { name: "France",        conf: "UEFA" },
  { name: "Spain",         conf: "UEFA" },
  { name: "England",       conf: "UEFA" },
  { name: "Germany",       conf: "UEFA" },
  { name: "Portugal",      conf: "UEFA" },
  { name: "Netherlands",   conf: "UEFA" },
  { name: "Italy",         conf: "UEFA" },
  { name: "Belgium",       conf: "UEFA" },
  { name: "Croatia",       conf: "UEFA" },
  { name: "Switzerland",   conf: "UEFA" },
  { name: "Denmark",       conf: "UEFA" },
  { name: "Poland",        conf: "UEFA" },
  { name: "Austria",       conf: "UEFA" },
  { name: "Turkey",        conf: "UEFA" },
  { name: "Serbia",        conf: "UEFA" },
  { name: "Scotland",      conf: "UEFA" },
  { name: "Ukraine",       conf: "UEFA" },
  { name: "Romania",       conf: "UEFA" },
  { name: "Hungary",       conf: "UEFA" },
  { name: "Georgia",       conf: "UEFA" },
  { name: "Slovakia",      conf: "UEFA" },
  { name: "Slovenia",      conf: "UEFA" },
  { name: "Albania",       conf: "UEFA" },
  // CAF
  { name: "Morocco",       conf: "CAF" },
  { name: "Senegal",       conf: "CAF" },
  { name: "Nigeria",       conf: "CAF" },
  { name: "Cameroon",      conf: "CAF" },
  { name: "Ghana",         conf: "CAF" },
  { name: "Ivory Coast",   conf: "CAF" },
  { name: "South Africa",  conf: "CAF" },
  { name: "DR Congo",      conf: "CAF" },
  { name: "Egypt",         conf: "CAF" },
  // AFC
  { name: "Japan",         conf: "AFC" },
  { name: "South Korea",   conf: "AFC" },
  { name: "Australia",     conf: "AFC" },
  { name: "Iran",          conf: "AFC" },
  { name: "Saudi Arabia",  conf: "AFC" },
  { name: "Uzbekistan",    conf: "AFC" },
  { name: "China",         conf: "AFC" },
  { name: "Iraq",          conf: "AFC" },
  // OFC
  { name: "New Zealand",   conf: "OFC" },
];

interface Props {
  leaderboard: LeaderboardEntry[];
  matches: Match[];
  roundStates: RoundState[];
  activeRound: RoundState | null;
  popularPicks: Record<string, { H: number; A: number; T: number; total: number }>;
  odds: OddsData[];
  currentUserEmail: string | null;
  currentUserName?: string | null;
  activeLeague: { name: string; code: string; memberCount: number };
}

function initials(name: string) {
  return name.split(/\s+/).map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

function relativeTime(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diff);
  const minutes = Math.round(abs / 60_000);
  const hours = Math.round(abs / 3_600_000);
  const days = Math.round(abs / 86_400_000);
  const future = diff > 0;
  if (minutes < 60) return future ? `in ${minutes}m` : `${minutes}m ago`;
  if (hours < 24)  return future ? `in ${hours}h`   : `${hours}h ago`;
  if (days < 30)   return future ? `in ${days}d`    : `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

export default function LeaderboardClient({
  leaderboard, matches, roundStates, activeRound, popularPicks, currentUserEmail, currentUserName, activeLeague,
}: Props) {
  const [compareA, setCompareA] = useState<string | null>(null);
  const [compareB, setCompareB] = useState<string | null>(null);
  const [showCompare, setShowCompare] = useState(false);
  const [showTeamPicker, setShowTeamPicker] = useState(false);
  const myEntry = leaderboard.find(e => e.email === currentUserEmail);

  const liveMatches = matches.filter(m =>
    m.status === "IN_PLAY" || m.status === "PAUSED" || m.status === "LIVE"
  );

  const recentlyFinished = useMemo(() =>
    matches
      .filter(m => m.status === "FINISHED")
      .sort((a, b) => new Date(b.kickoffUtc).getTime() - new Date(a.kickoffUtc).getTime())
      .slice(0, 3),
    [matches]
  );

  // Show more upcoming when there are no results yet (fills the card nicely pre-tournament)
  const upcomingMatches = useMemo(() => {
    const now = Date.now();
    const limit = recentlyFinished.length === 0 ? 5 : 3;
    return matches
      .filter(m => m.status === "SCHEDULED" && new Date(m.kickoffUtc).getTime() > now)
      .sort((a, b) => new Date(a.kickoffUtc).getTime() - new Date(b.kickoffUtc).getTime())
      .slice(0, limit);
  }, [matches, recentlyFinished.length]);

  const myRank = myEntry ? leaderboard.indexOf(myEntry) + 1 : null;

  const roundsWithMatches = roundStates.filter(r => r.matchCount > 0);

  function handleRowClick(email: string) {
    if (!compareA) { setCompareA(email); return; }
    if (email === compareA) { setCompareA(null); return; }
    setCompareB(email);
    setShowCompare(true);
  }

  const entryA = leaderboard.find(e => e.email === compareA);
  const entryB = leaderboard.find(e => e.email === compareB);

  const greeting = greetingForHour(new Date().getHours());
  const firstName = (currentUserName ?? "").split(/\s+/)[0] || "";

  // Standings copy helpers. Before any match finishes everyone is on 0, so
  // a raw "0 points behind X" reads badly — treat pre-tournament and genuine
  // ties on points as their own cases.
  const anyoneScored = leaderboard.some(e => e.totalScore > 0);
  const personAhead = myRank && myRank > 1 ? leaderboard[myRank - 2] : null;
  const deficit = personAhead && myEntry ? personAhead.totalScore - myEntry.totalScore : 0;

  return (
    <div className="space-y-12">

      {/* ── PAGE HEADER ──────────────────────────────────────── */}
      <header className="anim-fade-up">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] ink-faint mb-3">
          {activeLeague.name} &middot; {new Date().toLocaleDateString("en-CA", { month: "long", day: "numeric" })}
        </p>
        <h1 className="font-serif font-medium leading-[1.02] tracking-[-0.025em] ink" style={{fontSize: 'clamp(2.25rem, 5.5vw, 3.75rem)', fontVariationSettings: '"opsz" 120'}}>
          {greeting}{firstName ? `, ${firstName}` : ""}.
        </h1>
        <p className="mt-3 text-[16px] ink-soft max-w-2xl">
          {myRank && myEntry ? (
            !anyoneScored ? (
              <>
                Everyone&rsquo;s level on{" "}
                <span className="font-mono tabular font-semibold ink">0</span> points &mdash;
                you&rsquo;re provisionally{" "}
                <strong className="ink">{ordinal(myRank)}</strong>. The race kicks off June 11.
              </>
            ) : (
              <>
                You&rsquo;re sitting in{" "}
                <strong className="ink">
                  {ordinal(myRank)} place
                </strong>{" "}
                with{" "}
                <span className="font-mono tabular font-semibold ink">{myEntry.totalScore}</span>{" "}
                {myEntry.totalScore === 1 ? "point" : "points"}
                {personAhead && deficit > 0 && (
                  <>
                    {" "}&mdash;{" "}
                    <span className="ink-soft">
                      {deficit} {deficit === 1 ? "point" : "points"} behind{" "}
                      <em className="font-serif italic">{personAhead.name}</em>
                    </span>
                  </>
                )}
                {personAhead && deficit === 0 && (
                  <>
                    {" "}&mdash;{" "}
                    <span className="ink-soft">
                      level on points with{" "}
                      <em className="font-serif italic">{personAhead.name}</em>
                    </span>
                  </>
                )}.
              </>
            )
          ) : leaderboard.length === 0 ? (
            <>No one has any points yet. The tournament begins June 11.</>
          ) : (
            <>The leaderboard refreshes as matches finish.</>
          )}
        </p>
      </header>

      {/* ── LEAGUE INVITE CARD ───────────────────────────────── */}
      <InviteCard league={activeLeague} />

      {/* ── LIVE BANNER ──────────────────────────────────────── */}
      {liveMatches.length > 0 && (
        <section className="anim-fade-up bg-ink text-paper rounded-lg overflow-hidden">
          <div className="px-5 sm:px-7 py-5 flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-2.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-75 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
              </span>
              <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-paper/60">
                Live now
              </span>
            </span>
            <div className="h-3 w-px bg-paper/20" />
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 flex-1">
              {liveMatches.map(m => (
                <span key={m.matchId} className="text-[14.5px] font-serif italic">
                  <Flag team={m.homeTeam} size={14} className="mr-1" /> {m.homeTeam}{" "}
                  <span className="font-mono not-italic tabular text-gold font-bold mx-1">
                    {m.homeScore ?? "—"} : {m.awayScore ?? "—"}
                  </span>{" "}
                  {m.awayTeam} <Flag team={m.awayTeam} size={14} className="ml-1" />
                </span>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── ACTIVE ROUND CTA ─────────────────────────────────── */}
      {activeRound && (
        <section className="anim-fade-up bg-card border border-line rounded-lg overflow-hidden shadow-paper">
          <div className="p-5 sm:p-6 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent mb-2">
                Picks are open
              </p>
              <h2 className="font-serif text-[24px] sm:text-[28px] font-medium leading-tight tracking-[-0.01em] ink" style={{fontVariationSettings: '"opsz" 60'}}>
                {activeRound.label}
              </h2>
              {activeRound.deadline && (
                <p className="mt-1.5 text-[13.5px] ink-soft">
                  Picks close{" "}
                  <span className="font-mono ink tabular">
                    {new Date(activeRound.deadline).toLocaleString("en-CA", {
                      weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                    })}
                  </span>
                </p>
              )}
            </div>
            <a
              href="/picks"
              className="group inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-ink text-paper text-[13.5px] font-semibold hover:bg-accent transition-colors"
            >
              Make your picks
              <span className="font-mono transition-transform group-hover:translate-x-0.5">&rarr;</span>
            </a>
          </div>
        </section>
      )}

      {/* ── STANDINGS TABLE ──────────────────────────────────── */}
      {leaderboard.length > 0 ? (
        <section className="anim-fade-up" style={{animationDelay: '80ms'}}>
          <SectionHeader
            kicker="The Field"
            title="Standings"
            right={leaderboard.length > 1 ? (
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] ink-faint">
                {compareA ? "Pick another to compare" : "Tap two rows to compare"}
              </span>
            ) : null}
          />

          <div className="mt-6 bg-card border border-line rounded-lg overflow-hidden shadow-paper">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-line bg-paper-deep">
                    <th className="px-4 sm:px-6 py-3 text-left text-[10.5px] uppercase tracking-[0.18em] font-medium ink-faint w-14">#</th>
                    <th className="px-2 py-3 text-left text-[10.5px] uppercase tracking-[0.18em] font-medium ink-faint">Player</th>
                    <th className="px-3 py-3 text-right text-[10.5px] uppercase tracking-[0.18em] font-medium ink-faint">Score</th>
                    {(Object.keys(ROUND_CONFIG) as (keyof typeof ROUND_CONFIG)[]).map(r => (
                      <th key={r} className="px-2 py-3 text-right text-[10.5px] uppercase tracking-[0.18em] font-medium ink-faint hidden md:table-cell">
                        {ROUND_CONFIG[r].shortLabel}
                      </th>
                    ))}
                    <th className="px-3 sm:px-5 py-3 text-right text-[10.5px] uppercase tracking-[0.18em] font-medium ink-faint hidden sm:table-cell">Correct</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((entry, i) => {
                    const isMe = entry.email === currentUserEmail;
                    const isSelected = entry.email === compareA || entry.email === compareB;
                    const rank = i + 1;

                    return (
                      <tr
                        key={entry.email}
                        onClick={() => handleRowClick(entry.email)}
                        className={`group cursor-pointer transition-colors border-t border-[color:var(--line-soft)] anim-fade-up
                          ${isSelected ? "bg-gold-soft" : isMe ? "bg-green-soft/40" : "hover:bg-paper-deep/40"}
                        `}
                        style={{ animationDelay: `${100 + i * 30}ms` }}
                      >
                        <td className="px-4 sm:px-6 py-4">
                          <RankBadge rank={rank} />
                        </td>
                        <td className="px-2 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-ink text-paper flex items-center justify-center text-[10px] font-semibold tracking-wide flex-shrink-0">
                              {initials(entry.name)}
                            </div>
                            <div className="flex flex-col gap-0.5 min-w-0">
                              <div className="flex items-baseline gap-2">
                                <span className="font-serif text-[16px] font-medium ink leading-none" style={{fontVariationSettings: '"opsz" 32'}}>
                                  {entry.name}
                                </span>
                                {isMe && (
                                  <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-green-deep">
                                    You
                                  </span>
                                )}
                              </div>
                              {/* Supported team display */}
                              {entry.supportedTeam ? (
                                <div className="flex items-center gap-1.5">
                                  <Flag team={entry.supportedTeam} size={12} />
                                  <span className="font-mono text-[10px] ink-faint tracking-wide truncate">
                                    {entry.supportedTeam}
                                  </span>
                                  {isMe && (
                                    <button
                                      onClick={e => { e.stopPropagation(); setShowTeamPicker(true); }}
                                      className="font-mono text-[9px] ink-faint/60 hover:ink-faint transition-colors ml-0.5"
                                      title="Change your team"
                                    >
                                      ✎
                                    </button>
                                  )}
                                </div>
                              ) : isMe ? (
                                <button
                                  onClick={e => { e.stopPropagation(); setShowTeamPicker(true); }}
                                  className="flex items-center gap-1 font-mono text-[10px] text-accent/70 hover:text-accent transition-colors self-start"
                                >
                                  <span className="text-[9px]">+</span>
                                  Pick your team
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-4 text-right">
                          <span className="font-serif font-medium text-[22px] tabular ink leading-none" style={{fontVariationSettings: '"opsz" 60'}}>
                            {entry.totalScore}
                          </span>
                          <span className="font-mono text-[10.5px] ink-faint ml-1">
                            /{entry.maxPossibleScore}
                          </span>
                        </td>
                        {(Object.keys(ROUND_CONFIG) as (keyof typeof ROUND_CONFIG)[]).map(r => (
                          <td key={r} className="px-2 py-4 text-right font-mono text-[12px] tabular ink-faint hidden md:table-cell">
                            {entry.scoreByRound[r] ?? 0}
                          </td>
                        ))}
                        <td className="px-3 sm:px-5 py-4 text-right hidden sm:table-cell">
                          <span className="font-mono text-[12px] tabular ink-soft">
                            {entry.correctPicks}<span className="ink-faint">/{entry.totalPicks}</span>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : (
        <section className="anim-fade-up bg-card border border-line rounded-lg p-10 sm:p-14 text-center shadow-paper">
          <p className="font-serif italic text-[22px] ink-soft leading-snug max-w-md mx-auto" style={{fontVariationSettings: '"opsz" 40'}}>
            &ldquo;No one has scored a single point yet. The first whistle goes June 11.&rdquo;
          </p>
          <a href="/picks" className="mt-7 inline-flex items-center gap-2 text-[13.5px] font-semibold text-accent editorial-underline">
            Make your picks early <span className="font-mono">&rarr;</span>
          </a>
        </section>
      )}

      {/* ── RECENT / UPCOMING ────────────────────────────────── */}
      <section
        className={`grid gap-6 anim-fade-up ${recentlyFinished.length > 0 ? "sm:grid-cols-2" : ""}`}
        style={{animationDelay: '160ms'}}
      >
        {recentlyFinished.length > 0 && (
          <MatchSummaryList
            title="Just played"
            kicker="Results"
            matches={recentlyFinished}
            emptyText="No matches finished yet."
            showScore
            popularPicks={popularPicks}
          />
        )}
        <MatchSummaryList
          title="Up next"
          kicker="Coming up"
          matches={upcomingMatches}
          emptyText="No upcoming matches scheduled."
        />
      </section>

      {/* ── ROUND PROGRESS ───────────────────────────────────── */}
      {roundsWithMatches.length > 0 && (
        <section className="anim-fade-up" style={{animationDelay: '200ms'}}>
          <SectionHeader kicker="Schedule" title="Where we are" />
          <div className="mt-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
            {roundsWithMatches.map((rs, i) => {
              const status = rs.isComplete ? "Done" : rs.isOpen ? "Open" : "Soon";
              const statusColor = rs.isComplete ? "text-green-deep" : rs.isOpen ? "text-accent" : "ink-faint";
              const dotColor = rs.isComplete ? "bg-green-deep" : rs.isOpen ? "bg-accent" : "bg-[color:var(--ink-faint)]/30";
              return (
                <div
                  key={rs.round}
                  className={`relative bg-card border rounded-xl p-5 anim-fade-up transition-colors
                    ${rs.isOpen
                      ? "border-accent/50 sched-glow"
                      : rs.isComplete
                      ? "border-green-deep/30 shadow-paper"
                      : "border-line shadow-paper"}
                  `}
                  style={{ animationDelay: `${220 + i * 50}ms` }}
                >
                  {/* Status */}
                  <div className="flex items-center gap-1.5 mb-3">
                    <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${dotColor} ${rs.isOpen ? "anim-ring-pulse" : ""}`} />
                    <span className={`font-mono text-[10px] uppercase tracking-[0.18em] font-medium ${statusColor}`}>
                      {status}
                    </span>
                  </div>

                  {/* Round name */}
                  <h3 className="font-serif text-[18px] ink font-medium leading-tight" style={{ fontVariationSettings: '"opsz" 36' }}>
                    {rs.label}
                  </h3>

                  {/* Matches + points */}
                  <div className="mt-2.5 flex items-center gap-2">
                    <span className="font-mono text-[11px] tabular ink-soft">
                      {rs.matchCount} {rs.matchCount === 1 ? "match" : "matches"}
                    </span>
                    <span className="font-mono text-[10px] tabular font-semibold ink px-1.5 py-0.5 rounded bg-paper-deep">
                      {rs.pointsValue}pt
                    </span>
                  </div>

                  {/* Dates */}
                  {(rs.deadline || (rs.lastKickoff && rs.lastKickoff !== rs.deadline)) && (
                    <div className="mt-4 pt-3.5 border-t border-[color:var(--line-soft)] space-y-2.5">
                      {rs.deadline && (
                        <div>
                          <div className="font-mono text-[9px] uppercase tracking-[0.16em] ink-faint mb-1">Picks close</div>
                          <div className="font-mono text-[12px] tabular ink-soft leading-none">
                            {new Date(rs.deadline).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}
                            <span className="ink-faint"> · </span>
                            {new Date(rs.deadline).toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" })}
                          </div>
                        </div>
                      )}
                      {rs.lastKickoff && rs.lastKickoff !== rs.deadline && (
                        <div>
                          <div className="font-mono text-[9px] uppercase tracking-[0.16em] ink-faint mb-1">Last match</div>
                          <div className="font-mono text-[12px] tabular ink-soft leading-none">
                            {new Date(rs.lastKickoff).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── HEAD-TO-HEAD MODAL ───────────────────────────────── */}
      {showCompare && entryA && entryB && (
        <HeadToHead
          a={entryA}
          b={entryB}
          matches={matches}
          onClose={() => { setShowCompare(false); setCompareA(null); setCompareB(null); }}
        />
      )}

      {/* ── TEAM PICKER MODAL ────────────────────────────────── */}
      {showTeamPicker && (
        <TeamPickerModal
          current={myEntry?.supportedTeam ?? null}
          onClose={() => setShowTeamPicker(false)}
        />
      )}
    </div>
  );
}

function SectionHeader({ kicker, title, right }: { kicker: string; title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3 flex-wrap">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent mb-2">{kicker}</p>
        <h2 className="font-serif font-medium leading-tight tracking-[-0.015em] ink text-[28px] sm:text-[32px]" style={{fontVariationSettings: '"opsz" 80'}}>
          {title}
        </h2>
      </div>
      {right}
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div className="flex items-center gap-1">
        <span className="font-serif font-bold text-[18px] text-gold leading-none" style={{fontVariationSettings: '"opsz" 60'}}>1</span>
        <span className="font-mono text-[9px] uppercase tracking-wide text-gold">st</span>
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className="flex items-center gap-1">
        <span className="font-serif font-bold text-[18px] ink-soft leading-none" style={{fontVariationSettings: '"opsz" 60'}}>2</span>
        <span className="font-mono text-[9px] uppercase tracking-wide ink-faint">nd</span>
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="flex items-center gap-1">
        <span className="font-serif font-bold text-[18px] ink-soft leading-none" style={{fontVariationSettings: '"opsz" 60'}}>3</span>
        <span className="font-mono text-[9px] uppercase tracking-wide ink-faint">rd</span>
      </div>
    );
  }
  return <span className="font-mono text-[13px] tabular ink-faint">{rank}</span>;
}

function MatchSummaryList({ title, kicker, matches, emptyText, showScore, popularPicks }: {
  title: string;
  kicker: string;
  matches: Match[];
  emptyText: string;
  showScore?: boolean;
  popularPicks?: Record<string, { H: number; A: number; T: number; total: number }>;
}) {
  return (
    <div className="bg-card border border-line rounded-lg p-5 sm:p-6 shadow-paper">
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent mb-2">{kicker}</p>
      <h3 className="font-serif text-[22px] font-medium ink leading-tight" style={{fontVariationSettings: '"opsz" 48'}}>
        {title}
      </h3>
      <ul className="mt-5 divide-y divide-[color:var(--line-soft)]">
        {matches.length === 0 ? (
          <li className="text-[13.5px] ink-faint italic font-serif">{emptyText}</li>
        ) : matches.map(m => {
          const pickData = popularPicks?.[m.matchId];
          const result = m.result === "H" || m.result === "A" || m.result === "T" ? m.result : null;
          const correctCount = (pickData && result) ? (pickData[result] ?? 0) : 0;
          const total = pickData?.total ?? 0;
          const pct = total > 0 ? Math.round((correctCount / total) * 100) : null;

          return (
            <li key={m.matchId} className="py-3 first:pt-0 last:pb-0">
              {/* Match row */}
              <div className="flex items-center justify-between gap-3 text-[14px]">
                <span className="ink leading-tight min-w-0 truncate">
                  <Flag team={m.homeTeam} size={13} className="mr-1 opacity-70" />
                  <span className="font-medium">{m.homeTeam}</span>
                  {" "}<span className="ink-faint text-[12px]">vs</span>{" "}
                  <span className="font-medium">{m.awayTeam}</span>
                  <Flag team={m.awayTeam} size={13} className="ml-1 opacity-70" />
                </span>
                <span className="font-mono text-[12px] tabular flex-shrink-0">
                  {showScore && m.homeScore !== null
                    ? <span className="ink font-semibold">{m.homeScore} – {m.awayScore}</span>
                    : <span className="ink-soft">{relativeTime(m.kickoffUtc)}</span>
                  }
                </span>
              </div>

              {/* Pool accuracy — shown only for finished matches with pick data */}
              {showScore && result && pct !== null && total > 0 && (
                <div className="mt-1.5 flex items-center gap-2.5">
                  <div className="flex-1 h-1 rounded-full bg-paper-deep overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        background: pct >= 70 ? "var(--color-green-deep)" : pct >= 40 ? "var(--color-gold)" : "var(--color-accent)",
                        opacity: 0.55,
                      }}
                    />
                  </div>
                  <span className={`font-mono text-[10.5px] tabular font-medium flex-shrink-0
                    ${pct >= 70 ? "text-green-deep/80" : pct >= 40 ? "text-gold/90" : "text-accent/80"}`}>
                    {pct}%
                  </span>
                  <span className="font-mono text-[10px] ink-faint/60 flex-shrink-0">
                    {correctCount}/{total} got it
                  </span>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function HeadToHead({ a, b, matches, onClose }: {
  a: LeaderboardEntry; b: LeaderboardEntry; matches: Match[]; onClose: () => void;
}) {
  const finished = matches.filter(m => m.status === "FINISHED");

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/40 backdrop-blur-sm p-4 anim-fade-in"
      style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      onClick={onClose}
    >
      <div
        className="bg-card border border-line rounded-2xl sm:rounded-lg shadow-lift max-w-lg w-full flex flex-col anim-scale-in"
        style={{ maxHeight: 'min(88vh, 88dvh, 600px)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Fixed header ── */}
        <div className="px-6 py-5 border-b border-line flex items-center justify-between flex-shrink-0">
          <div>
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-accent mb-1">
              Head to head
            </p>
            <h2 className="font-serif text-[20px] sm:text-[22px] font-medium ink leading-tight" style={{fontVariationSettings: '"opsz" 48'}}>
              {a.name} <span className="italic ink-faint">vs</span> {b.name}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 flex-shrink-0 flex items-center justify-center rounded-md ink-faint hover:ink hover:bg-paper-deep text-lg font-mono transition-colors"
          >
            ×
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="overflow-y-auto flex-1 p-6">
          <div className="grid grid-cols-3 gap-3 mb-7">
            <div className="text-center">
              <div className="font-serif font-medium text-[44px] ink tabular leading-none" style={{fontVariationSettings: '"opsz" 100'}}>
                {a.totalScore}
              </div>
              <p className="mt-2 text-[12px] ink-soft font-medium truncate">{a.name}</p>
            </div>
            <div className="text-center flex items-center justify-center">
              <span className="font-serif italic text-[18px] ink-faint" style={{fontVariationSettings: '"opsz" 32'}}>
                vs
              </span>
            </div>
            <div className="text-center">
              <div className="font-serif font-medium text-[44px] ink tabular leading-none" style={{fontVariationSettings: '"opsz" 100'}}>
                {b.totalScore}
              </div>
              <p className="mt-2 text-[12px] ink-soft font-medium truncate">{b.name}</p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] ink-faint mb-3">
              By round
            </p>
            {(Object.keys(ROUND_CONFIG) as (keyof typeof ROUND_CONFIG)[]).map(r => {
              const aScore = a.scoreByRound[r] ?? 0;
              const bScore = b.scoreByRound[r] ?? 0;
              const winner = aScore > bScore ? "a" : bScore > aScore ? "b" : null;
              return (
                <div key={r} className="grid grid-cols-3 items-center text-[13px] py-1.5 border-b border-[color:var(--line-soft)]">
                  <span className={`font-mono tabular text-right ${winner === "a" ? "ink font-bold" : "ink-faint"}`}>{aScore}</span>
                  <span className="text-center ink-soft text-[12px] truncate px-2">{ROUND_CONFIG[r].label}</span>
                  <span className={`font-mono tabular text-left ${winner === "b" ? "ink font-bold" : "ink-faint"}`}>{bScore}</span>
                </div>
              );
            })}
          </div>

          {finished.length > 0 && (
            <p className="mt-6 text-[12px] ink-faint italic font-serif text-center">
              {finished.length} matches played &middot; {Math.abs(a.totalScore - b.totalScore)} point gap
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function InviteCard({ league }: { league: { name: string; code: string; memberCount: number } }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try { await navigator.clipboard.writeText(league.code); } catch {}
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="anim-fade-up bg-card border border-line rounded-lg px-5 py-4 flex items-center justify-between gap-4 flex-wrap shadow-paper">
      <div className="flex items-center gap-4">
        <div>
          <p className="font-mono text-[9.5px] uppercase tracking-[0.18em] ink-faint mb-1">
            League invite code
          </p>
          <p
            className="font-mono text-[22px] font-bold ink tracking-[0.14em] leading-none"
          >
            {league.code}
          </p>
        </div>
        <div className="h-8 w-px bg-line hidden sm:block" />
        <div className="hidden sm:block">
          <p className="text-[13px] ink-soft leading-snug">
            Share this code so friends can join{" "}
            <span className="font-medium ink">{league.name}</span>.
          </p>
          <p className="text-[12px] ink-faint">
            {league.memberCount} {league.memberCount === 1 ? "member" : "members"} so far
          </p>
        </div>
      </div>
      <button
        onClick={copy}
        className={`flex items-center gap-2 px-4 py-2 rounded-md text-[13px] font-semibold transition-all
          ${copied
            ? "bg-green-soft text-green-deep"
            : "bg-paper-deep hover:bg-line ink border border-line"
          }`}
      >
        <span className="font-mono text-[11px]">{copied ? "✓" : "⎘"}</span>
        {copied ? "Copied!" : "Copy code"}
      </button>
    </div>
  );
}

// ── Team Picker Modal ──────────────────────────────────────────────────────

function TeamPickerModal({
  current,
  onClose,
}: {
  current: string | null;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(current);
  const [isPending, startTransition] = useTransition();

  const filtered = query.trim()
    ? WC2026_TEAMS.filter(t =>
        t.name.toLowerCase().includes(query.toLowerCase()) ||
        t.conf.toLowerCase().includes(query.toLowerCase())
      )
    : WC2026_TEAMS;

  function save(team: string | null) {
    setSelected(team);
    startTransition(async () => {
      await handleSetSupportedTeam(team);
      onClose();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/50 backdrop-blur-sm p-4 anim-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-card border border-line rounded-xl shadow-lift w-full max-w-xl max-h-[85vh] flex flex-col anim-scale-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-line flex items-start justify-between gap-4 flex-shrink-0">
          <div>
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-accent mb-1">
              Personalization
            </p>
            <h2 className="font-serif text-[22px] font-medium ink leading-tight" style={{fontVariationSettings: '"opsz" 48'}}>
              Pick your team
            </h2>
            <p className="text-[13px] ink-faint mt-1">
              Declare your allegiance. No scoring impact — just bragging rights.
            </p>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-md ink-faint hover:ink hover:bg-paper-deep text-lg font-mono transition-colors flex-shrink-0"
          >
            ×
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-line flex-shrink-0">
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search teams or confederations…"
            autoFocus
            className="w-full bg-paper-deep border border-line rounded-lg px-3.5 py-2.5 text-[14px] ink placeholder:ink-faint outline-none focus:border-accent/50 transition-colors"
          />
        </div>

        {/* Team grid */}
        <div className="overflow-y-auto flex-1 p-4">
          {selected && (
            <button
              onClick={() => save(null)}
              className="w-full mb-3 flex items-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-line text-[13px] ink-faint hover:ink-soft hover:border-solid transition-colors"
            >
              <span className="text-[11px]">×</span>
              Clear selection
            </button>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {filtered.map(team => {
              const isActive = selected === team.name;
              return (
                <button
                  key={team.name}
                  onClick={() => save(team.name)}
                  disabled={isPending}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-left transition-all
                    ${isActive
                      ? "bg-accent/10 border-accent/40 text-accent"
                      : "bg-paper-deep border-line hover:border-accent/30 hover:bg-accent/5 ink"
                    } ${isPending ? "opacity-60 cursor-wait" : ""}`}
                >
                  <Flag team={team.name} size={18} className="flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium leading-tight truncate">
                      {team.name}
                    </p>
                    <p className="text-[10px] font-mono ink-faint/70 tracking-wide mt-0.5">
                      {team.conf}
                    </p>
                  </div>
                  {isActive && (
                    <span className="ml-auto text-accent text-[12px] flex-shrink-0">✓</span>
                  )}
                </button>
              );
            })}
          </div>
          {filtered.length === 0 && (
            <p className="text-center py-10 text-[14px] ink-faint font-serif italic">
              No teams match &ldquo;{query}&rdquo;
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-line flex-shrink-0">
          <p className="text-[11.5px] ink-faint text-center font-mono">
            {WC2026_TEAMS.length} teams &middot; All WC 2026 participants
          </p>
        </div>
      </div>
    </div>
  );
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function greetingForHour(h: number): string {
  if (h < 5) return "Up late";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Good evening";
}
