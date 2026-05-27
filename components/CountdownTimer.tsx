"use client";
import { useEffect, useState } from "react";

function pad(n: number) { return String(n).padStart(2, "0"); }

export default function CountdownTimer({ deadline, label }: { deadline: string; label: string }) {
  const [parts, setParts] = useState({ d: 0, h: 0, m: 0, s: 0 });
  const [locked, setLocked] = useState(false);
  const [urgent, setUrgent] = useState(false);

  useEffect(() => {
    function update() {
      const diff = new Date(deadline).getTime() - Date.now();
      if (diff <= 0) { setLocked(true); setParts({ d: 0, h: 0, m: 0, s: 0 }); return; }
      const d = Math.floor(diff / 86_400_000);
      const h = Math.floor((diff % 86_400_000) / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1_000);
      setUrgent(diff < 3_600_000);
      setParts({ d, h, m, s });
    }
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [deadline]);

  if (locked) {
    return (
      <div className="inline-flex items-center gap-2 rounded-md px-3.5 py-2 bg-paper-deep border border-line">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] ink-faint">Picks locked</span>
      </div>
    );
  }

  return (
    <div className={`inline-flex flex-col rounded-md px-4 py-2.5 border transition-colors
      ${urgent ? "bg-accent-soft border-[color:var(--accent)]/30" : "bg-card border-line shadow-paper"}
    `}>
      <span className={`font-mono text-[9.5px] uppercase tracking-[0.18em] mb-1
        ${urgent ? "text-accent" : "ink-faint"}
      `}>
        {label}
      </span>
      <div className="flex items-baseline gap-1.5">
        {parts.d > 0 && (
          <>
            <Unit value={parts.d} suffix="d" urgent={urgent} />
            <Sep />
          </>
        )}
        <Unit value={parts.h} suffix="h" urgent={urgent} pad={parts.d > 0} />
        <Sep />
        <Unit value={parts.m} suffix="m" urgent={urgent} pad />
        <Sep />
        <Unit value={parts.s} suffix="s" urgent={urgent} pad />
      </div>
    </div>
  );
}

function Unit({ value, suffix, urgent, pad: doPad }: { value: number; suffix: string; urgent: boolean; pad?: boolean }) {
  return (
    <span className={`font-mono tabular text-[18px] font-bold leading-none
      ${urgent ? "text-accent" : "ink"}
    `}>
      {doPad ? pad(value) : value}
      <span className="text-[10px] font-normal ink-faint ml-0.5">{suffix}</span>
    </span>
  );
}

function Sep() {
  return <span className="ink-faint text-[14px] font-mono">·</span>;
}
