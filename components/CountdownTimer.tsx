"use client";
import { useEffect, useState } from "react";

function pad(n: number) { return String(n).padStart(2, "0"); }

export default function CountdownTimer({ deadline, label }: { deadline: string; label: string }) {
  const [timeLeft, setTimeLeft] = useState("");
  const [urgent, setUrgent] = useState(false);

  useEffect(() => {
    function update() {
      const diff = new Date(deadline).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft("Picks locked"); return; }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1_000);
      setUrgent(diff < 3_600_000);
      setTimeLeft(h > 0 ? `${h}h ${pad(m)}m ${pad(s)}s` : `${pad(m)}m ${pad(s)}s`);
    }
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [deadline]);

  return (
    <div className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium border
      ${urgent
        ? "bg-red-50 text-red-700 border-red-200"
        : "bg-stone-50 text-stone-600 border-stone-200"
      }`}>
      <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${urgent ? "bg-red-500 animate-pulse" : "bg-green-600"}`} />
      <span className="text-stone-400">{label}:</span>
      <span className="font-mono font-semibold tabular-nums">{timeLeft}</span>
    </div>
  );
}
