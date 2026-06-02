"use client";
import { useMemo, useState } from "react";
import type { PlayerStats } from "@/lib/services/stats";
import { ordinal } from "@/lib/services/stats";
import Flag from "@/components/Flag";

const TONE: Record<string, { bg: string; ring: string; text: string }> = {
  gold:   { bg: "bg-gold-soft",   ring: "ring-gold/30",        text: "text-gold" },
  accent: { bg: "bg-accent-soft", ring: "ring-accent/25",      text: "text-accent" },
  green:  { bg: "bg-green-soft",  ring: "ring-green-deep/20",  text: "text-green-deep" },
  ink:    { bg: "bg-paper-deep",  ring: "ring-line",           text: "ink" },
};

export default function StatsClient({ stats, firstName }: { stats: PlayerStats | null; firstName: string }) {
  if (!stats) {
    return (
      <div className="py-24 text-center anim-fade-up">
        <p className="font-serif italic text-[22px] ink-faint" style={{ fontVariationSettings: '"opsz" 40' }}>
          No stats yet — make some picks and your dossier fills in.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      <DossierHeader stats={stats} firstName={firstName} />
      {stats.titles.length > 0 && <Honours stats={stats} />}
      <StatGrid stats={stats} />
      <ShareCard stats={stats} />
    </div>
  );
}

/* ─── Header + hero standing ──────────────────────────────────────────────── */

function DossierHeader({ stats, firstName }: { stats: PlayerStats; firstName: string }) {
  const { rank, leagueSize, totalScore, pointsBehindLeader, pointsAheadOfNext } = stats;
  const standingLine =
    rank === 1
      ? (pointsAheadOfNext !== null
          ? `Top of ${stats.leagueName} — ${pointsAheadOfNext} clear of 2nd.`
          : `Top of ${stats.leagueName}.`)
      : `${pointsBehindLeader} ${pointsBehindLeader === 1 ? "point" : "points"} off the lead in ${stats.leagueName}.`;

  return (
    <header className="anim-fade-up">
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] ink-faint mb-3">
        Your dossier &middot; Hi, {firstName}
      </p>
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div className="min-w-0">
          <h1 className="font-serif font-medium leading-[1.0] tracking-[-0.02em] ink flex items-center gap-4 flex-wrap" style={{ fontSize: "clamp(2.25rem, 5vw, 3.5rem)", fontVariationSettings: '"opsz" 120' }}>
            {stats.supportedTeam && <Flag team={stats.supportedTeam} size={40} className="rounded-[3px] shadow-paper" />}
            <span className="italic">{stats.name}</span>
          </h1>
          <p className="mt-3 text-[15px] ink-soft max-w-xl">{standingLine}</p>
        </div>

        {/* Rank / points plate */}
        <div className="flex items-stretch rounded-xl border border-line bg-card shadow-paper overflow-hidden flex-shrink-0">
          <div className="px-5 py-4 text-center border-r border-line">
            <div className="font-serif font-bold leading-none tabular ink" style={{ fontSize: "38px", fontVariationSettings: '"opsz" 80' }}>
              {ordinal(rank)}
            </div>
            <div className="mt-1.5 font-mono text-[9.5px] uppercase tracking-[0.18em] ink-faint">of {leagueSize}</div>
          </div>
          <div className="px-5 py-4 text-center">
            <div className="font-serif font-bold leading-none tabular text-accent" style={{ fontSize: "38px", fontVariationSettings: '"opsz" 80' }}>
              {totalScore}
            </div>
            <div className="mt-1.5 font-mono text-[9.5px] uppercase tracking-[0.18em] ink-faint">points</div>
          </div>
        </div>
      </div>
    </header>
  );
}

/* ─── Honours (earned superlatives) ───────────────────────────────────────── */

function Honours({ stats }: { stats: PlayerStats }) {
  return (
    <section className="anim-fade-up" style={{ animationDelay: "60ms" }}>
      <SectionLabel kicker="Honours" title="Titles you've earned" />
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {stats.titles.map((t, i) => {
          const tone = TONE[t.tone] ?? TONE.ink;
          return (
            <div key={t.key} className={`relative rounded-xl border border-line ${tone.bg} p-4 ring-1 ${tone.ring} anim-fade-up`} style={{ animationDelay: `${100 + i * 70}ms` }}>
              <div className="flex items-start gap-3">
                <span className="text-[26px] leading-none flex-shrink-0 emoji">{t.emoji}</span>
                <div className="min-w-0">
                  <p className={`font-serif font-semibold text-[17px] leading-tight ${tone.text}`} style={{ fontVariationSettings: '"opsz" 32' }}>
                    {t.title}
                  </p>
                  <p className="mt-1 text-[12.5px] ink-soft leading-snug">{t.blurb}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ─── Stat grid ───────────────────────────────────────────────────────────── */

function StatGrid({ stats }: { stats: PlayerStats }) {
  const groupTotal = stats.groupPoints + stats.bracketPoints;
  const groupPct = groupTotal > 0 ? (stats.groupPoints / groupTotal) * 100 : 0;

  return (
    <section className="anim-fade-up" style={{ animationDelay: "120ms" }}>
      <SectionLabel kicker="By the numbers" title="The full picture" />
      <div className="mt-5 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">

        {/* Accuracy dial */}
        <Card className="flex items-center gap-5">
          <AccuracyDial pct={stats.accuracy} />
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] ink-faint">Accuracy</p>
            <p className="font-serif font-medium text-[15px] ink mt-1 leading-snug" style={{ fontVariationSettings: '"opsz" 28' }}>
              {stats.correctPicks} right<br />of {stats.totalPicks} picks
            </p>
          </div>
        </Card>

        {/* Streaks */}
        <Card>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] ink-faint">Streaks</p>
          <div className="mt-3 flex items-end gap-6">
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-serif font-bold text-[34px] leading-none tabular text-accent" style={{ fontVariationSettings: '"opsz" 60' }}>{stats.currentStreak}</span>
                {stats.currentStreak >= 3 && <span className="text-[18px] emoji">🔥</span>}
              </div>
              <p className="mt-1.5 font-mono text-[9.5px] uppercase tracking-[0.16em] ink-faint">Current</p>
            </div>
            <div>
              <span className="font-serif font-bold text-[34px] leading-none tabular ink-soft" style={{ fontVariationSettings: '"opsz" 60' }}>{stats.longestStreak}</span>
              <p className="mt-1.5 font-mono text-[9.5px] uppercase tracking-[0.16em] ink-faint">Best run</p>
            </div>
          </div>
        </Card>

        {/* Upsets */}
        <Card>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] ink-faint">Against the grain</p>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="font-serif font-bold text-[34px] leading-none tabular text-gold" style={{ fontVariationSettings: '"opsz" 60' }}>{stats.upsets}</span>
            <span className="text-[16px] emoji">🧠</span>
          </div>
          <p className="mt-2 text-[12.5px] ink-soft leading-snug">
            Correct calls fewer than a third of the pool backed.
          </p>
        </Card>

        {/* Group vs bracket split */}
        <Card className="sm:col-span-2 lg:col-span-2">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] ink-faint">Where your points come from</p>
            <p className="font-mono text-[11px] tabular ink-soft">{groupTotal} pts</p>
          </div>
          <div className="mt-3.5 flex h-3 rounded-full overflow-hidden bg-paper-deep" style={{ gap: 2 }}>
            {groupTotal > 0 ? (
              <>
                <div style={{ width: `${groupPct}%`, background: "var(--color-ink)" }} />
                <div style={{ width: `${100 - groupPct}%`, background: "var(--color-accent)" }} />
              </>
            ) : null}
          </div>
          <div className="mt-3 flex items-center gap-5 text-[12.5px]">
            <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--color-ink)" }} /> <span className="ink-soft">Group</span> <span className="font-mono tabular ink font-semibold">{stats.groupPoints}</span></span>
            <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-accent" /> <span className="ink-soft">Bracket</span> <span className="font-mono tabular ink font-semibold">{stats.bracketPoints}</span></span>
          </div>
        </Card>

        {/* Champion pick */}
        <Card>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] ink-faint">Pick to lift the trophy</p>
          {stats.champion ? (
            <>
              <div className="mt-3 flex items-center gap-2.5">
                <Flag team={stats.champion.team} size={24} className="rounded-[2px]" />
                <span className="font-serif font-medium text-[20px] ink leading-none" style={{ fontVariationSettings: '"opsz" 32' }}>{stats.champion.team}</span>
              </div>
              <p className={`mt-2.5 font-mono text-[10.5px] uppercase tracking-[0.14em] ${
                stats.champion.alive === false ? "text-accent" : stats.champion.alive === true ? "text-green-deep" : "ink-faint"
              }`}>
                {stats.champion.alive === false ? "✗ Eliminated" : stats.champion.alive === true ? "✓ Still alive" : "Awaiting kickoff"}
              </p>
            </>
          ) : (
            <p className="mt-3 font-serif italic text-[15px] ink-faint" style={{ fontVariationSettings: '"opsz" 28' }}>
              {stats.bracketFilled > 0 ? "Bracket in progress…" : "Not set yet."}
            </p>
          )}
        </Card>
      </div>

      {/* Biggest upset callout */}
      {stats.biggestUpset && (
        <div className="mt-3.5 rounded-xl border border-gold/30 bg-gold-soft/40 p-5 anim-fade-up flex items-start gap-4">
          <span className="text-[28px] leading-none flex-shrink-0 emoji">🎯</span>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold mb-1.5">Your boldest call that landed</p>
            <p className="font-serif text-[17px] ink leading-snug" style={{ fontVariationSettings: '"opsz" 32' }}>
              You backed <span className="font-semibold">{stats.biggestUpset.team}</span> in {stats.biggestUpset.matchLabel} —
              and only <span className="font-semibold text-gold">{stats.biggestUpset.poolPct}%</span> of the pool agreed.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function AccuracyDial({ pct }: { pct: number }) {
  const r = 30, c = 2 * Math.PI * r, off = c * (1 - pct / 100);
  return (
    <div className="relative flex-shrink-0" style={{ width: 76, height: 76 }}>
      <svg width="76" height="76" viewBox="0 0 76 76" className="-rotate-90">
        <circle cx="38" cy="38" r={r} fill="none" stroke="var(--color-paper-deep)" strokeWidth="7" />
        <circle cx="38" cy="38" r={r} fill="none" stroke="var(--color-green-deep)" strokeWidth="7" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={off} style={{ transition: "stroke-dashoffset 0.9s cubic-bezier(0.22,1,0.36,1)" }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-serif font-bold text-[18px] tabular ink" style={{ fontVariationSettings: '"opsz" 32' }}>{pct}%</span>
      </div>
    </div>
  );
}

/* ─── Shareable card ──────────────────────────────────────────────────────── */

function ShareCard({ stats }: { stats: PlayerStats }) {
  const [status, setStatus] = useState<string | null>(null);

  const cardPath = useMemo(() => {
    const p = new URLSearchParams({
      n: stats.name,
      t: stats.supportedTeam ?? "",
      r: String(stats.rank),
      z: String(stats.leagueSize),
      p: String(stats.totalScore),
      a: String(stats.accuracy),
      s: String(stats.currentStreak),
      ti: stats.headline,
      lg: stats.leagueName,
      c: stats.champion?.team ?? "",
    });
    return `/stats/card?${p.toString()}`;
  }, [stats]);

  const absoluteUrl = () => (typeof window !== "undefined" ? window.location.origin + cardPath : cardPath);

  const flash = (msg: string) => { setStatus(msg); setTimeout(() => setStatus(null), 2200); };

  async function download() {
    try {
      const res = await fetch(cardPath);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nutmeg-${stats.name.replace(/\s+/g, "-").toLowerCase()}.png`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      flash("Saved to your device");
    } catch { flash("Couldn’t download — try again"); }
  }

  async function share() {
    try {
      const res = await fetch(cardPath);
      const blob = await res.blob();
      const file = new File([blob], "nutmeg-scorecard.png", { type: "image/png" });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "My Nutmeg scorecard", text: `${stats.headline} — ${stats.totalScore} pts in ${stats.leagueName}. nutmeg.bet` });
        return;
      }
      if (navigator.share) { await navigator.share({ title: "My Nutmeg scorecard", url: absoluteUrl() }); return; }
      await navigator.clipboard.writeText(absoluteUrl());
      flash("Link copied");
    } catch { /* user cancelled or unsupported */ }
  }

  async function copyLink() {
    try { await navigator.clipboard.writeText(absoluteUrl()); flash("Link copied"); }
    catch { flash("Couldn’t copy"); }
  }

  return (
    <section className="anim-fade-up" style={{ animationDelay: "180ms" }}>
      <SectionLabel kicker="Brag a little" title="Your shareable scorecard" />
      <div className="mt-5 grid lg:grid-cols-[1.6fr_1fr] gap-6 items-start">
        {/* Live preview — exactly what gets shared */}
        <div className="rounded-xl border border-line bg-paper-deep/40 p-3 shadow-paper overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cardPath}
            alt="Your Nutmeg scorecard"
            className="w-full rounded-lg shadow-lift block"
            style={{ aspectRatio: "1200 / 630" }}
          />
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <p className="text-[14.5px] ink-soft leading-relaxed">
            A snapshot of your dossier, ready for the group chat. Drop it in and let the trash talk write itself.
          </p>
          <button onClick={share} className="group inline-flex items-center justify-center gap-2.5 px-5 py-3 rounded-lg bg-ink text-paper text-[14px] font-semibold hover:bg-accent transition-colors">
            <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4"><path d="M11 5.5a2 2 0 1 0-1.9-2.6L6 4.6a2 2 0 1 0 0 2.8l3.1 1.7a2 2 0 1 0 .5-.9L6.5 6.5a2 2 0 0 0 0-1l3.1-1.7A2 2 0 0 0 11 5.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>
            Share my card
          </button>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={download} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-line bg-card text-[13px] font-medium ink-soft hover:ink hover:border-ink/30 transition-colors">
              <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5"><path d="M8 2v8m0 0L5 7m3 3 3-3M3 13h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Download
            </button>
            <button onClick={copyLink} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-line bg-card text-[13px] font-medium ink-soft hover:ink hover:border-ink/30 transition-colors">
              <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5"><path d="M6 10a2 2 0 0 1 0-2.8l2-2a2 2 0 0 1 2.8 2.8l-1 1M10 6a2 2 0 0 1 0 2.8l-2 2A2 2 0 0 1 5.2 8l1-1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Copy link
            </button>
          </div>
          <div className="h-5">
            {status && <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-green-deep anim-fade-in">{status} ✓</p>}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Bits ────────────────────────────────────────────────────────────────── */

function SectionLabel({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent mb-2">{kicker}</p>
      <h2 className="font-serif font-medium leading-tight tracking-[-0.015em] ink text-[26px] sm:text-[30px]" style={{ fontVariationSettings: '"opsz" 80' }}>
        {title}
      </h2>
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-card border border-line rounded-xl p-5 shadow-paper ${className}`}>{children}</div>;
}
