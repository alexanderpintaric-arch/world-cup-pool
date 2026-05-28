"use client";
import { useState, useActionState } from "react";
import { handleCreateLeague, handleJoinLeague } from "@/app/actions";

type Mode = "create" | "join";

export default function OnboardingClient({ defaultMode }: { defaultMode: Mode }) {
  const [mode, setMode] = useState<Mode>(defaultMode);

  const [createState, createAction, createPending] = useActionState(handleCreateLeague, null);
  const [joinState,   joinAction,   joinPending]   = useActionState(handleJoinLeague,   null);

  return (
    <div className="min-h-[60vh] flex items-start sm:items-center justify-center py-10">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="mb-8 anim-fade-up">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] ink-faint mb-3">
            Nutmeg &middot; WC &rsquo;26
          </p>
          <h1
            className="font-serif font-medium leading-tight tracking-[-0.02em] ink"
            style={{ fontSize: "clamp(2rem, 6vw, 2.75rem)", fontVariationSettings: '"opsz" 80' }}
          >
            {mode === "create" ? (
              <>Start your<br /><span className="italic text-accent">own league.</span></>
            ) : (
              <>Join a<br /><span className="italic text-accent">league.</span></>
            )}
          </h1>
          <p className="mt-3 text-[15px] ink-soft leading-relaxed">
            {mode === "create"
              ? "Create a private pool for your group. You'll get a 6-character code to share with friends."
              : "Enter the code your league creator shared with you to join their pool."}
          </p>
        </div>

        {/* Mode tabs */}
        <div
          className="flex gap-1 bg-paper-deep border border-line rounded-lg p-1 mb-7 anim-fade-up"
          style={{ animationDelay: "60ms" }}
        >
          <button
            type="button"
            onClick={() => setMode("create")}
            className={`flex-1 py-2 px-4 rounded-md text-[13.5px] font-medium transition-all
              ${mode === "create" ? "bg-ink text-paper shadow-sm" : "ink-soft hover:ink"}`}
          >
            Create a league
          </button>
          <button
            type="button"
            onClick={() => setMode("join")}
            className={`flex-1 py-2 px-4 rounded-md text-[13.5px] font-medium transition-all
              ${mode === "join" ? "bg-ink text-paper shadow-sm" : "ink-soft hover:ink"}`}
          >
            Join with a code
          </button>
        </div>

        {/* ── Create form ── */}
        {mode === "create" && (
          <form
            action={createAction}
            className="space-y-4 anim-fade-up"
            style={{ animationDelay: "100ms" }}
          >
            <div>
              <label
                htmlFor="league-name"
                className="block font-mono text-[10.5px] uppercase tracking-[0.18em] ink-faint mb-2"
              >
                League name
              </label>
              <input
                id="league-name"
                name="name"
                type="text"
                required
                maxLength={50}
                placeholder="e.g. The Lads, Family Pool, Work Chaos…"
                autoComplete="off"
                className="w-full px-4 py-3.5 bg-card border border-line rounded-lg text-[15px] ink placeholder:ink-faint/50 focus:outline-none focus:border-accent transition-colors"
              />
            </div>

            {createState?.error && (
              <p className="font-mono text-[12px] text-accent bg-accent-soft px-3 py-2 rounded-md">
                {createState.error}
              </p>
            )}

            <button
              type="submit"
              disabled={createPending}
              className="w-full group flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg bg-ink text-paper text-[15px] font-semibold hover:bg-accent transition-all disabled:opacity-50"
            >
              {createPending ? "Creating…" : "Create league"}
              {!createPending && (
                <span className="font-mono transition-transform group-hover:translate-x-0.5">&rarr;</span>
              )}
            </button>

            <p className="text-[12px] ink-faint text-center">
              You can invite friends with a code once the league is created.
            </p>
          </form>
        )}

        {/* ── Join form ── */}
        {mode === "join" && (
          <form
            action={joinAction}
            className="space-y-4 anim-fade-up"
            style={{ animationDelay: "100ms" }}
          >
            <div>
              <label
                htmlFor="league-code"
                className="block font-mono text-[10.5px] uppercase tracking-[0.18em] ink-faint mb-2"
              >
                League code
              </label>
              <input
                id="league-code"
                name="code"
                type="text"
                required
                maxLength={6}
                placeholder="WOLF42"
                autoComplete="off"
                className="w-full px-4 py-3.5 bg-card border border-line rounded-lg text-[18px] font-mono uppercase tracking-[0.18em] ink placeholder:ink-faint/50 placeholder:text-[15px] placeholder:normal-case placeholder:tracking-normal focus:outline-none focus:border-accent transition-colors"
              />
              <p className="mt-1.5 font-mono text-[10.5px] ink-faint">6 characters, uppercase letters and numbers.</p>
            </div>

            {joinState?.error && (
              <p className="font-mono text-[12px] text-accent bg-accent-soft px-3 py-2 rounded-md">
                {joinState.error}
              </p>
            )}

            <button
              type="submit"
              disabled={joinPending}
              className="w-full group flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg bg-ink text-paper text-[15px] font-semibold hover:bg-accent transition-all disabled:opacity-50"
            >
              {joinPending ? "Joining…" : "Join league"}
              {!joinPending && (
                <span className="font-mono transition-transform group-hover:translate-x-0.5">&rarr;</span>
              )}
            </button>
          </form>
        )}

      </div>
    </div>
  );
}
