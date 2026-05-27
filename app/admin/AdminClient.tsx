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

      <div>
        <h1 className="font-display text-2xl font-semibold text-stone-900">Admin</h1>
        <p className="text-stone-500 text-sm mt-1">Manage match data and sync status</p>
      </div>

      {/* Sync status */}
      <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm space-y-4">
        <h2 className="font-semibold text-stone-800 text-[15px]">Sync Status</h2>
        {lastSync ? (
          <dl className="space-y-2.5 text-sm">
            <div className="flex justify-between items-center py-2 border-b border-stone-50">
              <dt className="text-stone-500">Last synced</dt>
              <dd className="font-medium text-stone-800">
                {new Date(lastSync.syncedAt).toLocaleString("en-CA")}
              </dd>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-stone-50">
              <dt className="text-stone-500">Matches updated</dt>
              <dd className="font-medium text-stone-800 tabular-nums">{lastSync.matchesUpdated}</dd>
            </div>
            {lastSync.error && (
              <div className="flex justify-between items-start py-2">
                <dt className="text-stone-500 flex-shrink-0">Last error</dt>
                <dd className="text-red-600 text-xs text-right max-w-xs ml-4">{lastSync.error}</dd>
              </div>
            )}
          </dl>
        ) : (
          <p className="text-sm text-stone-400">No syncs recorded yet.</p>
        )}
        <p className="text-xs text-stone-400 pt-1">
          Auto-sync runs every 15 minutes via Vercel Cron.
        </p>
      </div>

      {/* Manual sync */}
      <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm space-y-4">
        <div>
          <h2 className="font-semibold text-stone-800 text-[15px]">Manual Sync</h2>
          <p className="text-sm text-stone-500 mt-1">
            Pulls latest match results from football-data.org, updates odds, and sends any pending emails.
          </p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="rounded-lg bg-green-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors shadow-sm"
        >
          {syncing ? "Syncing…" : "Sync Now"}
        </button>

        {result && (
          <div className={`rounded-lg border p-4 text-sm space-y-1.5
            ${result.error ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"}`}>
            {result.error ? (
              <p className="text-red-700 font-medium">{result.error}</p>
            ) : (
              <p className="text-green-800 font-semibold">Sync complete</p>
            )}
            <p className="text-stone-600">
              <span className="font-medium tabular-nums">{result.matchesUpdated}</span> matches updated
            </p>
            <p className="text-stone-600">
              <span className="font-medium tabular-nums">{result.emailsSent}</span> emails sent
            </p>
            {result.roundsOpened.length > 0 && (
              <p className="text-stone-600">
                Rounds opened: <span className="font-medium">{result.roundsOpened.join(", ")}</span>
              </p>
            )}
            <p className="text-stone-400 text-xs pt-0.5">
              {new Date(result.syncedAt).toLocaleString("en-CA")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
