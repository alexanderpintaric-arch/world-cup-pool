"use client";
import { useState, useMemo } from "react";
import type { LeaderboardEntry, Match, RoundState, OddsData } from "@/lib/types";
import { ROUND_CONFIG } from "@/lib/constants";
import { flagFor } from "@/lib/services/flags";

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
  leaderboard, matches, roundStates, activeRound, currentUserEmail, currentUserName, activeLeague,
}: Props) {
  const [compareA, setCompareA] = useState<string | null>(null);
  const [compareB, setCompareB] = useState<string | null>(null);
  const [showCompare, setShowCompare] = useState(false);

  const liveMatches = matches.filter(m =>
    m.status === "IN_PLAY" || m.status === "PAUSED" || m.status === "LIVE"
  );

  const upcomingMatches = useMemo(() => {
    const now = Date.now();
    return matches
      .filter(m => m.status === "SCHEDULED" && new Date(m.kickoffUtc).getTime() > now)
      .sort((a, b) => new Date(a.kickoffUtc).getTime() - new Date(b.kickoffUtc).getTime())
      .slice(0, 3);
  }, [matches]);

  const recentlyFinished = useMemo(() => {
    return matches
      .filter(m => m.status === "FINISHED")
      .sort((a, b) => new Date(b.kickoffUtc).getTime() - new Date(a.kickoffUtc).getTime())
      .slice(0, 3);
  }, [matches]);

  const me = leaderboard.find(e => e.email === currentUserEmail);
  const myRank = me ? leaderboard.indexOf(me) + 1 : null;

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
          {myRank && me ? (
            <>
              You&rsquo;re sitting in{" "}
              <strong className="ink">
                {ordinal(myRank)} place
              </strong>{" "}
              with{" "}
              <span className="font-mono tabular font-semibold ink">{me.totalScore}</span>{" "}
              {me.totalScore === 1 ? "point" : "points"}
              {leaderboard.length > 1 && myRank > 1 && (
                <>
                  {" "}&mdash;{" "}
                  <span className="ink-soft">
                    {leaderboard[myRank - 2].totalScore - me.totalScore}{" "}
                    {leaderboard[myRank - 2].totalScore - me.totalScore === 1 ? "point" : "points"} behind{" "}
                    <em className="font-serif italic">{leaderboard[myRank - 2].name}</em>
                  </span>
                </>
              )}.
            </>
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
                  <span className="emoji not-italic">{flagFor(m.homeTeam)}</span> {m.homeTeam}{" "}
                  <span className="font-mono not-italic tabular text-gold font-bold mx-1">
                    {m.homeScore ?? "—"} : {m.awayScore ?? "—"}
                  </span>{" "}
                  {m.awayTeam} <span className="emoji not-italic">{flagFor(m.awayTeam)}</span>
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
                  Closes{" "}
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
                        {ROUND_CONFIG[r].label.split(" ")[0].slice(0, 4)}
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
      <section className="grid sm:grid-cols-2 gap-6 anim-fade-up" style={{animationDelay: '160ms'}}>
        <MatchSummaryList
          title="Just played"
          kicker="Results"
          matches={recentlyFinished}
          emptyText="No matches finished yet."
          showScore
        />
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
          <div className="mt-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {roundsWithMatches.map((rs, i) => (
              <div
                key={rs.round}
                className={`relative bg-card border rounded-lg p-4 shadow-paper anim-fade-up transition-colors
                  ${rs.isComplete ? "border-green-deep/30" : rs.isOpen ? "border-accent/40" : "border-line"}
                `}
                style={{ animationDelay: `${220 + i * 50}ms` }}
              >
                <div className="flex items-center gap-2 mb-2">
                  {rs.isComplete && <span className="h-1.5 w-1.5 rounded-full bg-green-deep" />}
                  {rs.isOpen && <span className="h-1.5 w-1.5 rounded-full bg-accent anim-ring-pulse" />}
                  {!rs.isComplete && !rs.isOpen && <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--ink-faint)]/30" />}
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] ink-faint">
                    {rs.isComplete ? "Done" : rs.isOpen ? "Open" : "Soon"}
                  </span>
                </div>
                <p className="font-serif text-[16px] ink font-medium leading-tight" style={{fontVariationSettings: '"opsz" 32'}}>
                  {rs.label}
                </p>
                <p className="mt-2 font-mono text-[11px] ink-faint tabular">
                  {rs.matchCount} {rs.matchCount === 1 ? "match" : "matches"} &middot; {rs.pointsValue}pt
                </p>
              </div>
            ))}
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

function MatchSummaryList({ title, kicker, matches, emptyText, showScore }: {
  title: string; kicker: string; matches: Match[]; emptyText: string; showScore?: boolean;
}) {
  return (
    <div className="bg-card border border-line rounded-lg p-5 sm:p-6 shadow-paper">
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent mb-2">{kicker}</p>
      <h3 className="font-serif text-[22px] font-medium ink leading-tight" style={{fontVariationSettings: '"opsz" 48'}}>
        {title}
      </h3>
      <ul className="mt-5 space-y-3.5">
        {matches.length === 0 ? (
          <li className="text-[13.5px] ink-faint italic font-serif">{emptyText}</li>
        ) : matches.map(m => (
          <li key={m.matchId} className="flex items-center justify-between gap-3 text-[14px] py-1">
            <span className="ink leading-tight">
              <span className="emoji ink-faint mr-1">{flagFor(m.homeTeam)}</span>
              <span className="font-medium">{m.homeTeam}</span>
              {" "}<span className="ink-faint">vs</span>{" "}
              <span className="font-medium">{m.awayTeam}</span>
              <span className="emoji ink-faint ml-1">{flagFor(m.awayTeam)}</span>
            </span>
            <span className="font-mono text-[12px] tabular ink-soft flex-shrink-0">
              {showScore && m.homeScore !== null
                ? <span className="ink font-semibold">{m.homeScore} – {m.awayScore}</span>
                : relativeTime(m.kickoffUtc)
              }
            </span>
          </li>
        ))}
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
      onClick={onClose}
    >
      <div
        className="bg-card border border-line rounded-lg shadow-lift max-w-lg w-full max-h-[85vh] overflow-y-auto anim-scale-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-5 border-b border-line flex items-center justify-between">
          <div>
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-accent mb-1">
              Head to head
            </p>
            <h2 className="font-serif text-[22px] font-medium ink" style={{fontVariationSettings: '"opsz" 48'}}>
              {a.name} <span className="italic ink-faint">vs</span> {b.name}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-md ink-faint hover:ink hover:bg-paper-deep text-lg font-mono transition-colors"
          >
            ×
          </button>
        </div>

        <div className="p-6">
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
