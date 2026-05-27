"use client";
import { useState } from "react";

interface Props {
  lastSync: { syncedAt: string; matchesUpdated: number; error: string } | null;
}

export default function AdminClient({ lastSync }: Props) {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<{
    matchesUpdated: number;
    roundsOpened: string[];
    emailsSent: number;
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
      setResult({ matchesUpdated: 0, roundsOpened: [], emailsSent: 0, error: "Network error", syncedAt: new Date().toISOString() });
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Admin</h1>

      {/* Last sync status */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
        <h2 className="font-semibold text-slate-700">Sync Status</h2>
        {lastSync ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-slate-500">Last synced</dt>
            <dd className="font-medium text-slate-800">
              {new Date(lastSync.syncedAt).toLocaleString("en-CA")}
            </dd>
            <dt className="text-slate-500">Matches updated</dt>
            <dd className="font-medium">{lastSync.matchesUpdated}</dd>
            {lastSync.error && (
              <>
                <dt className="text-slate-500">Last error</dt>
                <dd className="text-red-600 text-xs">{lastSync.error}</dd>
              </>
            )}
          </dl>
        ) : (
          <p className="text-sm text-slate-400">No syncs recorded yet.</p>
        )}

        <p className="text-xs text-slate-400">
          Auto-sync runs every 15 minutes via Vercel Cron.
        </p>
      </div>

      {/* Manual sync */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <h2 className="font-semibold text-slate-700">Manual Sync</h2>
        <p className="text-sm text-slate-500">
          Force a sync now — pulls latest match results from football-data.org,
          updates odds, recalculates scores, and sends any pending emails.
        </p>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 transition"
        >
          {syncing ? "Syncing…" : "Sync Now"}
        </button>

        {result && (
          <div className={`rounded-lg border p-4 text-sm space-y-1
            ${result.error ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"}`}>
            {result.error ? (
              <p className="text-red-700 font-medium">Error: {result.error}</p>
            ) : (
              <p className="text-green-700 font-medium">Sync complete</p>
            )}
            <p className="text-slate-600">Matches updated: {result.matchesUpdated}</p>
            <p className="text-slate-600">Emails sent: {result.emailsSent}</p>
            {result.roundsOpened.length > 0 && (
              <p className="text-slate-600">Rounds opened: {result.roundsOpened.join(", ")}</p>
            )}
            <p className="text-slate-400 text-xs">
              {new Date(result.syncedAt).toLocaleString("en-CA")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
