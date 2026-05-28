import Flag from "@/components/Flag";

/**
 * Landing-page product showcase — live HTML mockups of the real UI
 * (Picks with odds + animated selection, Standings, and a bet-slip Receipt).
 * Pure CSS animation; respects prefers-reduced-motion.
 */

function initials(name: string) {
  return name.split(/\s+/).map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

// ── Browser-style frame ─────────────────────────────────────────────────────
function Frame({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-card shadow-lift overflow-hidden">
      <div className="flex items-center gap-2 px-4 h-9 border-b border-line bg-paper-deep/50">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--color-accent)", opacity: 0.7 }} />
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--color-gold)", opacity: 0.7 }} />
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--color-green-deep)", opacity: 0.5 }} />
        <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.16em] ink-faint truncate">{label}</span>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  );
}

// ── 1. Picks mockup (animated) ──────────────────────────────────────────────
function PicksMock() {
  return (
    <Frame label="My Picks · Group A">
      <div className="relative">
        {/* Match meta */}
        <div className="flex items-center justify-between mb-3.5">
          <span className="inline-flex items-center gap-2">
            <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1 rounded bg-ink text-paper font-mono text-[10px] font-bold">A</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] ink-faint">Match 1</span>
          </span>
          <span className="font-mono text-[10px] tabular ink-faint">Jun 11 · 12:00</span>
        </div>

        {/* Teams */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Flag team="Mexico" size={22} />
            <span className="font-serif text-[15px] font-medium ink truncate" style={{ fontVariationSettings: '"opsz" 24' }}>Mexico</span>
          </div>
          <span className="font-serif italic text-[12px] ink-faint flex-shrink-0">vs</span>
          <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
            <span className="font-serif text-[15px] font-medium ink truncate text-right" style={{ fontVariationSettings: '"opsz" 24' }}>South Africa</span>
            <Flag team="South Africa" size={22} />
          </div>
        </div>

        {/* Pick options */}
        <div className="grid grid-cols-3 gap-2">
          {/* Mexico — animates to selected */}
          <div className="sc-select flex flex-col items-center gap-0.5 rounded-md border-2 px-2 py-3" style={{ borderColor: "#E0DACA", background: "#F5F1E8", color: "#0B1426" }}>
            <Flag team="Mexico" size={18} />
            <span className="text-[11px] font-semibold mt-0.5">Mexico</span>
            <span className="font-mono text-[11px] tabular">58%</span>
            <span className="font-mono text-[10px] tabular" style={{ opacity: 0.7 }}>-175</span>
          </div>
          {/* Draw */}
          <div className="flex flex-col items-center gap-0.5 rounded-md border-2 border-line bg-paper px-2 py-3 ink">
            <span className="text-[16px] leading-none emoji">🤝</span>
            <span className="text-[11px] font-semibold mt-0.5">Draw</span>
            <span className="font-mono text-[11px] tabular ink-faint">26%</span>
            <span className="font-mono text-[10px] tabular ink-faint/60">+290</span>
          </div>
          {/* South Africa */}
          <div className="flex flex-col items-center gap-0.5 rounded-md border-2 border-line bg-paper px-2 py-3 ink">
            <Flag team="South Africa" size={18} />
            <span className="text-[11px] font-semibold mt-0.5">S. Africa</span>
            <span className="font-mono text-[11px] tabular ink-faint">16%</span>
            <span className="font-mono text-[10px] tabular ink-faint/60">+500</span>
          </div>
        </div>

        {/* Saved confirmation */}
        <div className="sc-saved mt-3 flex items-center justify-center gap-1.5 font-mono text-[11px] text-green-deep">
          <svg className="h-3 w-3" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M2 7l4 4 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Pick saved
        </div>

        {/* Faux cursor */}
        <div className="sc-cursor absolute z-10" style={{ left: "72%", top: "118%", filter: "drop-shadow(0 2px 3px rgba(11,20,38,0.3))" }} aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M5 2.5l13.5 6.8-5.7 1.9-1.9 5.8L5 2.5z" fill="#0B1426" stroke="#FFFEFA" strokeWidth="1.3" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </Frame>
  );
}

// ── 2. Standings mockup ─────────────────────────────────────────────────────
function StandingsMock() {
  const rows = [
    { rank: 1, name: "Sarah K.",  team: "Brazil",      pts: 14 },
    { rank: 2, name: "You",       team: "England",     pts: 12, me: true },
    { rank: 3, name: "Mike D.",   team: "Argentina",   pts: 11 },
    { rank: 4, name: "Tom R.",    team: "France",      pts: 9 },
    { rank: 5, name: "Jess M.",   team: "Netherlands", pts: 8 },
  ];
  return (
    <Frame label="Standings · The Lads">
      <table className="w-full">
        <tbody>
          {rows.map(r => (
            <tr key={r.rank} className={`border-t border-[color:var(--line-soft)] first:border-0 ${r.me ? "bg-green-soft/40" : ""}`}>
              <td className="py-2.5 pl-1 pr-2 w-7 align-middle">
                {r.rank === 1
                  ? <span className="font-serif font-bold text-[16px] text-gold leading-none" style={{ fontVariationSettings: '"opsz" 40' }}>1</span>
                  : <span className="font-mono text-[12px] tabular ink-faint">{r.rank}</span>}
              </td>
              <td className="py-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="h-7 w-7 rounded-full bg-ink text-paper flex items-center justify-center text-[9px] font-semibold flex-shrink-0">{initials(r.name)}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-serif text-[14px] font-medium ink leading-none" style={{ fontVariationSettings: '"opsz" 24' }}>{r.name}</span>
                      {r.me && <span className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-green-deep">You</span>}
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      <Flag team={r.team} size={11} />
                      <span className="font-mono text-[9.5px] ink-faint tracking-wide">{r.team}</span>
                    </div>
                  </div>
                </div>
              </td>
              <td className="py-2.5 pr-1 text-right align-middle">
                <span className="font-serif font-medium text-[18px] tabular ink leading-none" style={{ fontVariationSettings: '"opsz" 40' }}>{r.pts}</span>
                <span className="font-mono text-[10px] ink-faint">/18</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Frame>
  );
}

// ── 3. Receipt mockup ───────────────────────────────────────────────────────
function ReceiptMock() {
  const picks = [
    { d: "Jun 11", m: "Mexico 2–0 S. Africa", pick: "Mexico",  odds: "-175", status: "won",  pts: 1 },
    { d: "Jun 12", m: "Brazil 4–1 Senegal",   pick: "Brazil",  odds: "-260", status: "won",  pts: 1 },
    { d: "Jun 13", m: "Germany 1–2 Japan",     pick: "Germany", odds: "+120", status: "lost" },
    { d: "Jun 14", m: "France vs USA",         pick: "France",  odds: "-200", status: "open" },
  ];
  return (
    <div className="receipt-paper shadow-lift max-w-[19rem] mx-auto">
      <div className="receipt-edge receipt-edge-top" />
      <div className="px-6 pt-5 pb-6">
        <div className="text-center">
          <div className="font-serif italic text-[22px] font-medium ink leading-none">Nutmeg</div>
          <div className="font-mono text-[8.5px] uppercase tracking-[0.24em] ink-faint mt-1.5">Group Stage Receipt</div>
        </div>

        <div className="my-4 border-t border-dashed border-line" />

        <div className="space-y-2.5">
          {picks.map((p, i) => (
            <div key={i} className="font-mono text-[11px] leading-tight">
              <div className="flex items-baseline gap-2">
                <span className="ink-faint/60 text-[9.5px] w-[40px] flex-shrink-0">{p.d}</span>
                <span className="ink-soft truncate">{p.m}</span>
              </div>
              <div className="rcpt-line mt-1 pl-[48px]">
                <span className={p.status === "won" ? "text-green-deep font-semibold" : p.status === "lost" ? "text-accent font-semibold" : "ink font-medium"}>
                  &rsaquo; {p.pick} <span className="ink-faint/70 font-normal tabular">{p.odds}</span>
                </span>
                <span className="lead" />
                <span className="text-[9.5px] uppercase tracking-[0.06em] flex-shrink-0">
                  {p.status === "won"
                    ? <span className="text-green-deep font-bold">WON +{p.pts}</span>
                    : p.status === "lost"
                    ? <span className="text-accent font-bold">LOST</span>
                    : <span className="ink-faint/50">open</span>}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="my-4 border-t border-ink/30" />

        <div className="rcpt-line font-mono text-[13px]">
          <span className="font-bold ink uppercase tracking-[0.1em]">Round Total</span>
          <span className="lead" />
          <span className="font-bold ink tabular text-[15px]">2 PTS</span>
        </div>

        {/* Mini barcode */}
        <div className="mt-5 flex items-end justify-center gap-[2px] h-8" aria-hidden="true">
          {Array.from({ length: 38 }).map((_, i) => (
            <div key={i} style={{ width: `${(i % 3 ? 1.5 : 2.5)}px`, height: "100%", background: i % 2 ? "transparent" : "var(--color-ink)" }} />
          ))}
        </div>
        <p className="font-mono text-[9px] ink-soft tracking-[0.3em] text-center mt-1.5">7K2MX9</p>
      </div>
      <div className="receipt-edge receipt-edge-bottom" />
    </div>
  );
}

// ── 4. All-rounds timeline (pick every game; points climb) ──────────────────
function RoundsMock() {
  const rounds = [
    { name: "Group Stage",   sub: "72 matches · ✓ all picked", pts: 1, done: true },
    { name: "Round of 32",   sub: "16 matches",                pts: 2 },
    { name: "Round of 16",   sub: "8 matches",                 pts: 3 },
    { name: "Quarterfinals", sub: "4 matches",                 pts: 4 },
    { name: "Semifinals",    sub: "2 matches",                 pts: 5 },
    { name: "Final",         sub: "1 match",                   pts: 6, last: true },
  ];
  return (
    <Frame label="My Picks · All rounds">
      <div className="relative">
        {/* connector line */}
        <span className="absolute top-4 bottom-4 left-[4px] w-px bg-line" aria-hidden="true" />
        {rounds.map((r, i) => (
          <div key={i} className="relative flex items-center gap-3.5 py-2">
            <span
              className="relative z-10 h-2.5 w-2.5 rounded-full flex-shrink-0"
              style={{
                background: r.done ? "var(--color-green-deep)" : "var(--color-card)",
                border: `1.5px solid ${r.done ? "var(--color-green-deep)" : "var(--color-line)"}`,
              }}
            />
            <div className="flex-1 flex items-center justify-between gap-2 min-w-0">
              <div className="min-w-0">
                <div className="font-serif text-[15px] font-medium ink leading-tight" style={{ fontVariationSettings: '"opsz" 24' }}>{r.name}</div>
                <div className="font-mono text-[10px] ink-faint mt-0.5">{r.sub}</div>
              </div>
              <span
                className={`font-mono text-[11px] font-bold tabular px-2.5 py-1 rounded-md flex-shrink-0 border
                  ${r.last ? "bg-ink text-paper border-ink" : "bg-paper-deep ink-soft border-line"}`}
              >
                {r.pts} pt
              </span>
            </div>
          </div>
        ))}
      </div>
    </Frame>
  );
}

// ── 5. Pool distribution (competitive split) ────────────────────────────────
function PoolMock() {
  const HOME = "#1B7A3D", DRAW = "#A07820", AWAY = "#1E40AF";
  return (
    <Frame label="The Pool · Group C">
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] ink-faint">Match 3 · 24 picks in</span>
        <span className="font-mono text-[10px] tabular ink-faint">Jun 19</span>
      </div>

      <div className="flex items-center justify-between gap-3 mb-3.5">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Flag team="France" size={20} />
          <span className="font-serif text-[15px] font-medium ink truncate" style={{ fontVariationSettings: '"opsz" 24' }}>France</span>
        </div>
        <span className="font-serif italic text-[12px] ink-faint flex-shrink-0">vs</span>
        <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
          <span className="font-serif text-[15px] font-medium ink truncate text-right" style={{ fontVariationSettings: '"opsz" 24' }}>Brazil</span>
          <Flag team="Brazil" size={20} />
        </div>
      </div>

      {/* Distribution bar */}
      <div className="flex h-9 rounded-md overflow-hidden" style={{ gap: "1px", background: "var(--color-line)" }}>
        {[{ pct: 48, c: HOME }, { pct: 19, c: DRAW }, { pct: 33, c: AWAY }].map((s, i) => (
          <div key={i} className="relative flex items-center justify-center min-w-0" style={{ flex: s.pct, background: s.c }}>
            <span className="font-mono text-[10px] font-semibold tabular" style={{ color: "rgba(255,255,255,0.9)" }}>{s.pct}%</span>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-start justify-between gap-4">
        <div className="flex flex-col items-start gap-1.5 ink">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ background: HOME }} />
            <span className="font-mono text-[15px] font-semibold tabular leading-none">48%</span>
          </div>
          <span className="font-mono text-[12px] ink-faint leading-none pl-[18px]">11 picks</span>
          <span className="font-mono text-[11px] font-semibold text-accent leading-none pl-[18px]">← you</span>
        </div>
        <div className="flex flex-col items-center gap-1.5 ink-faint">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ background: DRAW }} />
            <span className="font-mono text-[15px] font-semibold tabular leading-none">19%</span>
          </div>
          <span className="font-mono text-[12px] leading-none">Draw</span>
        </div>
        <div className="flex flex-col items-end gap-1.5 ink-faint">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[15px] font-semibold tabular leading-none">33%</span>
            <span className="h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ background: AWAY }} />
          </div>
          <span className="font-mono text-[12px] leading-none pr-[18px]">8 picks</span>
        </div>
      </div>
    </Frame>
  );
}

// ── 6. Notifications (deadline alerts) ──────────────────────────────────────
function NotificationsMock() {
  const notes = [
    { icon: "⏰", bg: "bg-accent-soft", title: "Round of 16 picks lock in 24 hours", sub: "Last call — review your slip before kickoff", time: "1h" },
    { icon: "🏆", bg: "bg-gold-soft",   title: "The Lads is live — here's the playbook", sub: "Your league code: 8MCGJ4", time: "2d" },
    { icon: "⚽", bg: "bg-green-soft",  title: "Brazil 2–0 Senegal — you won +1", sub: "You're up to 3rd in The Lads", time: "3d" },
  ];
  return (
    <Frame label="Notifications">
      <div className="space-y-2.5">
        {notes.map((n, i) => (
          <div key={i} className="flex items-start gap-3 rounded-lg border border-line bg-paper/50 px-3.5 py-3">
            <span className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-[14px] emoji ${n.bg}`}>{n.icon}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-serif text-[13.5px] font-medium ink leading-tight" style={{ fontVariationSettings: '"opsz" 24' }}>{n.title}</span>
                <span className="font-mono text-[9.5px] ink-faint flex-shrink-0">{n.time}</span>
              </div>
              <p className="text-[11.5px] ink-faint mt-1 leading-snug truncate">{n.sub}</p>
            </div>
          </div>
        ))}
      </div>
    </Frame>
  );
}

// ── Feature row (text + mock, alternating) ──────────────────────────────────
function FeatureRow({ kicker, title, body, mock, flip, delay }: {
  kicker: string; title: React.ReactNode; body: string; mock: React.ReactNode; flip?: boolean; delay?: number;
}) {
  return (
    <div className="grid lg:grid-cols-2 gap-8 lg:gap-14 items-center">
      <div className={`anim-fade-up ${flip ? "lg:order-2" : ""}`} style={{ animationDelay: `${delay ?? 0}ms` }}>
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent mb-3">{kicker}</p>
        <h3 className="font-serif font-medium text-[27px] sm:text-[33px] leading-[1.06] tracking-[-0.02em] ink mb-4" style={{ fontVariationSettings: '"opsz" 80' }}>
          {title}
        </h3>
        <p className="text-[15.5px] ink-soft leading-[1.6] max-w-md">{body}</p>
      </div>
      <div className={`anim-fade-up ${flip ? "lg:order-1" : ""}`} style={{ animationDelay: `${(delay ?? 0) + 80}ms` }}>
        {mock}
      </div>
    </div>
  );
}

export default function LandingShowcase() {
  return (
    <section className="space-y-14 sm:space-y-24">
      {/* Section header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent mb-3">A look inside</p>
          <h2 className="font-serif font-medium leading-[1.05] tracking-[-0.02em] ink" style={{ fontSize: "clamp(2rem, 4.5vw, 3rem)", fontVariationSettings: '"opsz" 100' }}>
            See it in action.
          </h2>
        </div>
        <div className="h-px bg-line flex-1 max-w-[200px] mb-3 hidden sm:block" />
      </div>

      <FeatureRow
        kicker="Make your picks"
        title={<>Pick every match. <span className="italic text-accent">Odds included.</span></>}
        body="Tap a winner — or call a draw — for every match. Live bookmaker odds sit on every option in American format, so you always know the underdog from the lock. Picks save the instant you tap, and you can change your mind right up to kickoff."
        mock={<PicksMock />}
      />

      <FeatureRow
        kicker="Every round"
        title={<>From the opener <span className="italic text-accent">to the final.</span></>}
        body="You don't just call the group stage — you pick every game in every round, all the way to the final. Each knockout round is worth more than the last, so the points (and the stakes) climb to the final whistle."
        mock={<RoundsMock />}
        flip
      />

      <FeatureRow
        kicker="See the split"
        title={<>Watch the pool <span className="italic text-accent">fight it out.</span></>}
        body="See exactly how your league voted on every match. The percentages lay bare the favourites, the toss-ups, and who's brave enough to back the underdog. It gets competitive fast."
        mock={<PoolMock />}
      />

      <FeatureRow
        kicker="Climb the table"
        title={<>Your league. <span className="italic text-accent">Your bragging rights.</span></>}
        body="A private leaderboard just for your crew. Points stack up the moment each match finishes — and everyone flies the flag of the national team they back. First place earns four years of gloating."
        mock={<StandingsMock />}
        flip
      />

      <FeatureRow
        kicker="Keep the receipts"
        title={<>Every round, <span className="italic text-accent">printed like a bet slip.</span></>}
        body="Your picks, your odds, your hits and misses — laid out as a tear-off receipt with the locked-in price beside each call. One for every round, ready to copy or print and settle any argument."
        mock={<ReceiptMock />}
      />

      <FeatureRow
        kicker="Never miss a deadline"
        title={<>We&rsquo;ll tap you <span className="italic text-accent">on the shoulder.</span></>}
        body="Get an email the moment each round opens, plus a 24-hour warning before picks lock. Make your calls, then let us keep you on schedule — no spreadsheets, no nagging the group chat."
        mock={<NotificationsMock />}
        flip
      />
    </section>
  );
}
