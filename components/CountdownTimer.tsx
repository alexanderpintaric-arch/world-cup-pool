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

      setUrgent(diff < 3_600_000); // under 1 hour
      setTimeLeft(h > 0 ? `${h}h ${pad(m)}m ${pad(s)}s` : `${pad(m)}m ${pad(s)}s`);
    }
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [deadline]);

  return (
    <div className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium
      ${urgent ? "bg-red-100 text-red-700" : "bg-blue-50 text-blue-700"}`}>
      <span className={`h-2 w-2 rounded-full animate-pulse ${urgent ? "bg-red-500" : "bg-blue-500"}`} />
      {label}: <span className="font-mono font-bold">{timeLeft}</span>
    </div>
  );
}
