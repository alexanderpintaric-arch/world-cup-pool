"use client";
import { useState } from "react";

interface Props {
  lastSync: { syncedAt: string; matchesUpdated: number; error: string } | null;
  stats: { totalLeagues: number; totalUsers: number };
}

export default function AdminClient({ lastSync, stats }: Props) {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<{
    matchesUpdated: number;
    oddsUpdated: number;
    roundsOpened: string[];
    emailsSent: number;
    error?: string;
    syncedAt: string;
  } | null>(null);
  const [oddsSyncing, setOddsSyncing] = useState(false);
  const [oddsResult, setOddsResult] = useState<{
    oddsUpdated: number;
    error?: string;
    syncedAt: string;
  } | null>(null);

  async function handleSync() {
    setSyncing(true);
    setResult(null);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({ matchesUpdated: 0, oddsUpdated: 0, roundsOpened: [], emailsSent: 0, error: "Network error", syncedAt: new Date().toISOString() });
    } finally {
      setSyncing(false);
    }
  }

  async function handleOddsSync() {
    setOddsSyncing(true);
    setOddsResult(null);
    try {
      const res = await fetch("/api/sync/odds", { method: "POST" });
      const data = await res.json();
      setOddsResult(data);
    } catch {
      setOddsResult({ oddsUpdated: 0, error: "Network error", syncedAt: new Date().toISOString() });
    } finally {
      setOddsSyncing(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-8">

      <header className="anim-fade-up">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent mb-3">
          Operations
        </p>
        <h1 className="font-serif font-medium leading-[1.02] tracking-[-0.02em] ink" style={{fontSize: 'clamp(2rem, 4.5vw, 3rem)', fontVariationSettings: '"opsz" 100'}}>
          Admin <span className="italic ink-soft">console</span>
        </h1>
        <p className="mt-3 text-[14.5px] ink-soft">
          Sync match data, monitor cron health, and trigger manual updates.
        </p>
      </header>

      {/* Growth stats */}
      <section className="anim-fade-up grid grid-cols-2 gap-4" style={{animationDelay: '60ms'}}>
        <div className="bg-card border border-line rounded-lg px-6 py-5 shadow-paper">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] ink-faint mb-2">
            Leagues
          </p>
          <p className="font-serif font-medium leading-none ink tabular" style={{fontSize: '3rem', fontVariationSettings: '"opsz" 80'}}>
            {stats.totalLeagues}
          </p>
          <p className="mt-2 text-[12.5px] ink-faint">
            {stats.totalLeagues === 1 ? "league created" : "leagues created"}
          </p>
        </div>
        <div className="bg-card border border-line rounded-lg px-6 py-5 shadow-paper">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] ink-faint mb-2">
            Users
          </p>
          <p className="font-serif font-medium leading-none ink tabular" style={{fontSize: '3rem', fontVariationSettings: '"opsz" 80'}}>
            {stats.totalUsers}
          </p>
          <p className="mt-2 text-[12.5px] ink-faint">
            {stats.totalUsers === 1 ? "unique account" : "unique accounts"}
          </p>
        </div>
      </section>

      {/* Sync status */}
      <section className="anim-fade-up bg-card border border-line rounded-lg shadow-paper" style={{animationDelay: '80ms'}}>
        <div className="px-6 py-4 border-b border-line">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] ink-faint mb-0.5">
            Status
          </p>
          <h2 className="font-serif text-[20px] ink font-medium" style={{fontVariationSettings: '"opsz" 40'}}>
            Last sync
          </h2>
        </div>
        <div className="px-6 py-5">
          {lastSync ? (
            <dl className="space-y-3.5 text-[14px]">
              <Row label="Synced at" value={new Date(lastSync.syncedAt).toLocaleString("en-CA")} mono />
              <Row label="Matches updated" value={lastSync.matchesUpdated.toString()} mono />
              {lastSync.error && (
                <div className="pt-2 border-t border-[color:var(--line-soft)]">
                  <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-accent mb-1.5">
                    Error
                  </p>
                  <p className="text-[12.5px] text-accent font-mono bg-accent-soft rounded p-3 leading-relaxed">
                    {lastSync.error}
                  </p>
                </div>
              )}
            </dl>
          ) : (
            <p className="text-[13.5px] ink-faint italic font-serif">No syncs recorded yet.</p>
          )}
          <p className="mt-5 pt-4 border-t border-[color:var(--line-soft)] font-mono text-[10.5px] ink-faint">
            Auto-sync runs every 15 minutes via GitHub Actions, with a daily 15:00 UTC Vercel Cron fallback. Odds are only updated manually.
          </p>
        </div>
      </section>

      {/* Manual trigger */}
      <section className="anim-fade-up bg-card border border-line rounded-lg shadow-paper" style={{animationDelay: '120ms'}}>
        <div className="px-6 py-4 border-b border-line">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] ink-faint mb-0.5">
            Manual
          </p>
          <h2 className="font-serif text-[20px] ink font-medium" style={{fontVariationSettings: '"opsz" 40'}}>
            Force a sync
          </h2>
        </div>
        <div className="px-6 py-5">
          <p className="text-[14px] ink-soft leading-relaxed mb-5">
            Pulls fresh match data from football-data.org, recalculates scores, and dispatches any pending notification emails (daily digests, deadline reminders, round recaps). Odds are left untouched.
          </p>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-md bg-ink text-paper text-[13.5px] font-semibold hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {syncing ? (
              <>
                <span className="font-mono text-[15px] inline-block animate-spin">↻</span>
                Syncing…
              </>
            ) : (
              <>
                Sync now
                <span className="font-mono">&rarr;</span>
              </>
            )}
          </button>

          {result && (
            <div className={`mt-5 rounded-md border p-4 anim-fade-up
              ${result.error
                ? "border-[color:var(--accent)]/30 bg-accent-soft"
                : "border-[color:var(--green)]/30 bg-green-soft"
              }`}>
              <p className={`font-serif text-[16px] font-medium mb-2
                ${result.error ? "text-accent" : "text-green-deep"}
              `} style={{fontVariationSettings: '"opsz" 32'}}>
                {result.error ? "Sync failed" : "Sync complete"}
              </p>
              {result.error && (
                <p className="text-[12.5px] text-accent font-mono mb-3 leading-relaxed">
                  {result.error}
                </p>
              )}
              <dl className="space-y-1 text-[13px] ink-soft">
                <Row label="Matches updated" value={String(result.matchesUpdated)} compact mono />
                <Row label="Emails sent" value={String(result.emailsSent)} compact mono />
                {result.roundsOpened.length > 0 && (
                  <Row label="Rounds opened" value={result.roundsOpened.join(", ")} compact />
                )}
              </dl>
              <p className="mt-3 font-mono text-[10px] ink-faint tabular">
                {new Date(result.syncedAt).toLocaleString("en-CA")}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Odds refresh */}
      <section className="anim-fade-up bg-card border border-line rounded-lg shadow-paper" style={{animationDelay: '160ms'}}>
        <div className="px-6 py-4 border-b border-line">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] ink-faint mb-0.5">
            Manual
          </p>
          <h2 className="font-serif text-[20px] ink font-medium" style={{fontVariationSettings: '"opsz" 40'}}>
            Refresh odds
          </h2>
        </div>
        <div className="px-6 py-5">
          <p className="text-[14px] ink-soft leading-relaxed mb-5">
            Pulls fresh win probabilities from The Odds API for matches already in the database. Not part of the automatic sync — run this whenever you want updated odds.
          </p>
          <button
            onClick={handleOddsSync}
            disabled={oddsSyncing}
            className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-md bg-ink text-paper text-[13.5px] font-semibold hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {oddsSyncing ? (
              <>
                <span className="font-mono text-[15px] inline-block animate-spin">↻</span>
                Refreshing…
              </>
            ) : (
              <>
                Refresh odds
                <span className="font-mono">&rarr;</span>
              </>
            )}
          </button>

          {oddsResult && (
            <div className={`mt-5 rounded-md border p-4 anim-fade-up
              ${oddsResult.error
                ? "border-[color:var(--accent)]/30 bg-accent-soft"
                : "border-[color:var(--green)]/30 bg-green-soft"
              }`}>
              <p className={`font-serif text-[16px] font-medium mb-2
                ${oddsResult.error ? "text-accent" : "text-green-deep"}
              `} style={{fontVariationSettings: '"opsz" 32'}}>
                {oddsResult.error ? "Odds refresh failed" : "Odds refreshed"}
              </p>
              {oddsResult.error && (
                <p className="text-[12.5px] text-accent font-mono mb-3 leading-relaxed">
                  {oddsResult.error}
                </p>
              )}
              <dl className="space-y-1 text-[13px] ink-soft">
                <Row label="Odds refreshed" value={oddsResult.oddsUpdated > 0 ? String(oddsResult.oddsUpdated) : "none available"} compact mono />
              </dl>
              <p className="mt-3 font-mono text-[10px] ink-faint tabular">
                {new Date(oddsResult.syncedAt).toLocaleString("en-CA")}
              </p>
            </div>
          )}
        </div>
      </section>

    </div>
  );
}

function Row({ label, value, mono, compact }: { label: string; value: string; mono?: boolean; compact?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-4 ${compact ? "" : "py-1"}`}>
      <dt className="ink-soft">{label}</dt>
      <dd className={`ink font-medium text-right ${mono ? "font-mono tabular" : ""}`}>{value}</dd>
    </div>
  );
}
