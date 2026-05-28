"use client";
import { useState, useRef, useEffect } from "react";
import type { LeagueWithRole } from "@/lib/types";
import { handleSwitchLeague } from "@/app/actions";

export function LeagueSwitcher({
  active,
  all,
}: {
  active: LeagueWithRole;
  all: LeagueWithRole[];
}) {
  const [open,   setOpen]   = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const others = all.filter(l => l.id !== active.id);

  async function copyCode() {
    try { await navigator.clipboard.writeText(active.code); } catch {}
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div ref={ref} className="relative">

      {/* Chip trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[13px] font-medium transition-colors
          ${open
            ? "bg-paper-deep border-line ink"
            : "border-line/70 ink-soft hover:ink hover:border-line hover:bg-paper-deep"}`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-accent flex-shrink-0" />
        <span className="max-w-[88px] sm:max-w-[120px] truncate leading-none">{active.name}</span>
        <svg
          className={`h-3 w-3 flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          viewBox="0 0 12 12" fill="none"
        >
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-[17rem] bg-paper border border-line rounded-xl shadow-lift z-50 overflow-hidden">

          {/* Active league header */}
          <div className="px-4 pt-4 pb-3.5 border-b border-line">
            <p className="font-mono text-[9.5px] uppercase tracking-[0.18em] ink-faint mb-1.5">
              Active league
            </p>
            <p
              className="font-serif text-[16px] font-medium ink leading-tight truncate"
              style={{ fontVariationSettings: '"opsz" 32' }}
            >
              {active.name}
            </p>
            <div className="mt-2.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <code className="font-mono text-[14px] font-bold ink tracking-[0.14em]">
                  {active.code}
                </code>
                <button
                  type="button"
                  onClick={copyCode}
                  className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-line ink-faint hover:text-accent hover:border-accent transition-colors"
                >
                  {copied ? "✓ copied" : "copy"}
                </button>
              </div>
              <span className="font-mono text-[10px] ink-faint flex-shrink-0">
                {active.memberCount} {active.memberCount === 1 ? "member" : "members"}
              </span>
            </div>
          </div>

          {/* Switch to another league */}
          {others.length > 0 && (
            <div className="py-1 border-b border-line">
              <p className="px-4 pt-2 pb-1 font-mono text-[9.5px] uppercase tracking-[0.18em] ink-faint">
                Switch to
              </p>
              {others.map(l => {
                const switchAction = handleSwitchLeague.bind(null, l.id);
                return (
                  <form key={l.id} action={switchAction}>
                    <button
                      type="submit"
                      className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-paper-deep transition-colors group"
                    >
                      <span className="text-[13.5px] ink font-medium truncate">{l.name}</span>
                      <span className="font-mono text-[10px] ink-faint group-hover:ink-soft ml-2 flex-shrink-0">
                        {l.memberCount} {l.memberCount === 1 ? "member" : "members"}
                      </span>
                    </button>
                  </form>
                );
              })}
            </div>
          )}

          {/* Create / Join */}
          <div className="py-1.5">
            <a
              href="/onboarding?mode=create"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-[13.5px] ink-soft hover:ink hover:bg-paper-deep transition-colors"
            >
              <span className="font-mono text-[13px] w-4 text-center leading-none">+</span>
              Create new league
            </a>
            <a
              href="/onboarding?mode=join"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-[13.5px] ink-soft hover:ink hover:bg-paper-deep transition-colors"
            >
              <span className="font-mono text-[13px] w-4 text-center leading-none">↗</span>
              Join with a code
            </a>
          </div>

        </div>
      )}
    </div>
  );
}
