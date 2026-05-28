import type { Match, RoundState } from "@/lib/types";
import { MAX_TOTAL_POINTS } from "@/lib/constants";

interface Props {
  matches: Match[];
  roundStates: RoundState[];
  participantCount: number;
}

const STEPS = [
  {
    n: "01",
    title: "Pick every match.",
    body: "From the opening whistle in Mexico City to the final in New Jersey. 104 matches. Group stage, then every knockout round.",
  },
  {
    n: "02",
    title: "Earn as games end.",
    body: "Group games count for 1. Each knockout round is worth more — last 32 → 2, last 16 → 3, quarters → 4, semis → 5, final → 6.",
  },
  {
    n: "03",
    title: "Beat your friends.",
    body: "The leaderboard updates within minutes of each final whistle. Trash talk in the group chat. Trophy bragging rights until 2030.",
  },
];

const FAQ = [
  {
    q: "When do picks lock?",
    a: "Group stage picks lock at the first whistle of each group&rsquo;s opening match. Knockout picks lock the moment that round begins.",
  },
  {
    q: "Can I change a pick before the deadline?",
    a: "Yes — every pick saves instantly and you can change it as many times as you like up until the round&rsquo;s deadline.",
  },
  {
    q: "What about draws in the knockouts?",
    a: "Knockout matches don&rsquo;t have a draw option. Pick whoever you think advances, whether it&rsquo;s in 90, extra time, or penalties.",
  },
  {
    q: "What happens if a match gets postponed?",
    a: "We follow FIFA&rsquo;s official call. Postponed matches don&rsquo;t score until they&rsquo;re rescheduled and finished.",
  },
  {
    q: "Who runs this?",
    a: "A friend&rsquo;s side project. Free to play. No app to install. Built for the group chat.",
  },
];

export default function Landing({ matches, participantCount }: Props) {
  const totalMatches = Math.max(matches.length, 104);
  const teamCount = 48;
  const groupCount = 12;

  return (
    <div className="space-y-20 sm:space-y-28">

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="relative pt-6 sm:pt-10">

        {/* Floating editorial label */}
        <div className="flex items-center gap-3 mb-8 anim-fade-up">
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] ink-faint">
            Vol. 1 &middot; Iss. 26
          </span>
          <span className="h-px flex-1 bg-line max-w-[100px]" />
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] ink-faint">
            Est. 2026
          </span>
        </div>

        <h1 className="font-serif font-medium leading-[0.95] tracking-[-0.025em] ink anim-fade-up" style={{fontSize: 'clamp(2.75rem, 7.5vw, 5.5rem)', fontVariationSettings: '"opsz" 120'}}>
          The beautiful game,<br />
          <span className="italic text-accent" style={{fontVariationSettings: '"opsz" 144'}}>made personal.</span>
        </h1>

        <div className="mt-8 sm:mt-10 max-w-2xl anim-fade-up" style={{animationDelay: '120ms'}}>
          <p className="text-[18px] sm:text-[19px] ink-soft leading-[1.55]">
            A friendly prediction pool for the 2026 World Cup. Pick every match across all{" "}
            <strong className="ink">{groupCount} groups</strong> and every knockout round.
            Earn points as games end. Whoever ends with the most points wins the bragging rights for{" "}
            <span className="italic font-serif text-accent">four entire years.</span>
          </p>
        </div>

        <div className="mt-9 flex flex-wrap items-center gap-4 anim-fade-up" style={{animationDelay: '200ms'}}>
          <a
            href="/auth/signin"
            className="group inline-flex items-center gap-3 px-6 py-3.5 rounded-md bg-ink text-paper text-[15px] font-semibold hover:bg-accent transition-all shadow-paper hover:shadow-lift"
          >
            Sign in with Google
            <span className="font-mono text-[15px] transition-transform group-hover:translate-x-0.5">&rarr;</span>
          </a>
          <p className="text-[13px] ink-faint">
            Free &middot; Google sign-in &middot; No app to install
          </p>
        </div>

        {/* Stats strip */}
        <div className="mt-16 grid grid-cols-2 sm:grid-cols-3 gap-px bg-line border border-line rounded-lg overflow-hidden anim-fade-up" style={{animationDelay: '300ms'}}>
          {[
            { v: String(totalMatches), l: "Matches" },
            { v: String(teamCount), l: "Teams" },
            { v: String(groupCount), l: "Groups" },
            { v: "39",  l: "Days" },
            { v: String(MAX_TOTAL_POINTS), l: "Max points" },
            { v: "1",   l: "Champion" },
          ].map((s) => (
            <div key={s.l} className="bg-card px-5 py-4 sm:py-5">
              <div className="font-serif font-medium text-[28px] sm:text-[34px] leading-none ink tabular" style={{fontVariationSettings: '"opsz" 80'}}>
                {s.v}
              </div>
              <div className="mt-1.5 font-mono text-[10.5px] uppercase tracking-[0.18em] ink-faint">
                {s.l}
              </div>
            </div>
          ))}
        </div>

        {participantCount > 0 && (
          <p className="mt-5 text-[13px] ink-faint anim-fade-up" style={{animationDelay: '380ms'}}>
            <span className="font-mono tabular ink-soft font-semibold">{participantCount}</span>{" "}
            {participantCount === 1 ? "friend has" : "friends have"} already joined.
          </p>
        )}
      </section>

      {/* ── LEAGUES ──────────────────────────────────────────── */}
      <section>
        <SectionHeader kicker="Your league" title="Play with your people." />

        <p className="mt-4 max-w-xl text-[16px] ink-soft leading-relaxed">
          Every pool runs inside a private league. Create one for your group or
          join one a friend already started — either way you get your own
          leaderboard, your own bragging rights.
        </p>

        <div className="mt-10 grid sm:grid-cols-2 gap-5 sm:gap-7">

          {/* Create */}
          <div className="bg-card border border-line rounded-xl p-7 shadow-paper flex flex-col gap-5">
            <div>
              <div className="inline-flex items-center gap-2 bg-accent/10 text-accent rounded-md px-3 py-1.5 mb-4">
                <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true">
                  <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M8 5v6M5 8h6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
                </svg>
                <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] font-medium">Create a league</span>
              </div>
              <h3 className="font-serif text-[22px] font-medium ink leading-snug mb-2" style={{fontVariationSettings: '"opsz" 48'}}>
                Start your own pool.
              </h3>
              <p className="text-[14.5px] ink-soft leading-[1.6]">
                Give it a name, grab the invite code, and share it with your group chat.
                Anyone who joins lands on the same leaderboard as you.
              </p>
            </div>
            <ul className="space-y-2 text-[13.5px] ink-soft">
              {["You pick the name", "Invite as many friends as you like", "Only members see each other's picks"].map(item => (
                <li key={item} className="flex items-center gap-2.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <a
              href="/auth/signin?callbackUrl=%2Fonboarding"
              className="mt-auto group inline-flex items-center gap-2.5 px-5 py-3 rounded-lg bg-ink text-paper text-[14px] font-semibold hover:bg-accent transition-colors self-start"
            >
              Create a league
              <span className="font-mono transition-transform group-hover:translate-x-0.5">&rarr;</span>
            </a>
          </div>

          {/* Join */}
          <div className="bg-card border border-line rounded-xl p-7 shadow-paper flex flex-col gap-5">
            <div>
              <div className="inline-flex items-center gap-2 bg-paper-deep text-ink-faint rounded-md px-3 py-1.5 mb-4">
                <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true">
                  <path d="M2 8h10M8 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] font-medium">Join a league</span>
              </div>
              <h3 className="font-serif text-[22px] font-medium ink leading-snug mb-2" style={{fontVariationSettings: '"opsz" 48'}}>
                Already got a code?
              </h3>
              <p className="text-[14.5px] ink-soft leading-[1.6]">
                A friend created a league and sent you the code? Sign in, enter the
                code, and you&rsquo;re on the board. Takes about ten seconds.
              </p>
            </div>
            <ul className="space-y-2 text-[13.5px] ink-soft">
              {["Sign in with Google", "Enter the invite code", "Start picking immediately"].map(item => (
                <li key={item} className="flex items-center gap-2.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-line-hard flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <a
              href="/auth/signin?callbackUrl=%2Fonboarding%3Fmode%3Djoin"
              className="mt-auto group inline-flex items-center gap-2.5 px-5 py-3 rounded-lg border border-line text-ink text-[14px] font-semibold hover:bg-paper-deep transition-colors self-start"
            >
              Join a league
              <span className="font-mono transition-transform group-hover:translate-x-0.5">&rarr;</span>
            </a>
          </div>

        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────── */}
      <section>
        <SectionHeader kicker="The format" title="Three rules. That&rsquo;s all." />

        <div className="grid sm:grid-cols-3 gap-5 sm:gap-7 mt-10">
          {STEPS.map((s, i) => (
            <article
              key={s.n}
              className="relative bg-card border border-line rounded-lg p-6 sm:p-7 shadow-paper anim-fade-up"
              style={{ animationDelay: `${100 + i * 80}ms` }}
            >
              <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent mb-5">
                {s.n}
              </div>
              <h3 className="font-serif text-[24px] sm:text-[26px] font-medium leading-tight tracking-[-0.01em] ink mb-3" style={{fontVariationSettings: '"opsz" 60'}}>
                {s.title}
              </h3>
              <p className="text-[14.5px] ink-soft leading-[1.6]">
                {s.body}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* ── SCORING TABLE ────────────────────────────────────── */}
      <section>
        <SectionHeader kicker="Points" title="Get harder, worth more." />

        <div className="mt-10 bg-card border border-line rounded-lg overflow-hidden shadow-paper">
          <table className="w-full text-[14.5px]">
            <thead>
              <tr className="border-b border-line bg-paper-deep">
                <th className="text-left font-medium ink-soft px-5 sm:px-7 py-3.5 text-[11px] uppercase tracking-[0.16em]">Round</th>
                <th className="text-right font-medium ink-soft px-5 sm:px-7 py-3.5 text-[11px] uppercase tracking-[0.16em]">Matches</th>
                <th className="text-right font-medium ink-soft px-5 sm:px-7 py-3.5 text-[11px] uppercase tracking-[0.16em]">Per pick</th>
                <th className="text-right font-medium ink-soft px-5 sm:px-7 py-3.5 text-[11px] uppercase tracking-[0.16em]">Round total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--line-soft)]">
              {[
                ["Group stage",     72, 1, 72],
                ["Round of 32",     16, 2, 32],
                ["Round of 16",      8, 3, 24],
                ["Quarterfinals",    4, 4, 16],
                ["Semifinals",       2, 5, 10],
                ["Final + 3rd place", 2, 6, 12],
              ].map(([round, count, per, total]) => (
                <tr key={String(round)} className="hover:bg-paper-deep/40 transition-colors">
                  <td className="px-5 sm:px-7 py-3.5 ink font-medium">{round}</td>
                  <td className="px-5 sm:px-7 py-3.5 text-right font-mono tabular ink-soft">{count}</td>
                  <td className="px-5 sm:px-7 py-3.5 text-right font-mono tabular ink-soft">{per}pt</td>
                  <td className="px-5 sm:px-7 py-3.5 text-right font-mono tabular ink font-semibold">{total}</td>
                </tr>
              ))}
              <tr className="bg-paper-deep/60">
                <td className="px-5 sm:px-7 py-3.5 ink font-serif italic">Maximum possible</td>
                <td className="px-5 sm:px-7 py-3.5 text-right font-mono tabular ink-soft">104</td>
                <td className="px-5 sm:px-7 py-3.5 text-right ink-faint">&mdash;</td>
                <td className="px-5 sm:px-7 py-3.5 text-right font-mono tabular ink font-bold">{MAX_TOTAL_POINTS}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────── */}
      <section>
        <SectionHeader kicker="Questions" title="Things people ask." />

        <div className="mt-8 max-w-2xl">
          {FAQ.map((item, i) => (
            <details
              key={item.q}
              className="group border-b border-line py-5 anim-fade-up"
              style={{ animationDelay: `${80 + i * 60}ms` }}
            >
              <summary className="flex items-start justify-between gap-6 cursor-pointer list-none">
                <span className="font-serif text-[19px] sm:text-[20px] ink font-medium leading-snug" style={{fontVariationSettings: '"opsz" 32'}}>
                  {item.q}
                </span>
                <span className="font-mono text-[18px] ink-faint flex-shrink-0 mt-0.5 transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p
                className="mt-3 text-[14.5px] ink-soft leading-[1.65] max-w-prose"
                dangerouslySetInnerHTML={{ __html: item.a }}
              />
            </details>
          ))}
        </div>
      </section>

      {/* ── FINAL CTA ────────────────────────────────────────── */}
      <section className="relative">
        <div className="bg-ink text-paper rounded-lg px-8 sm:px-12 py-12 sm:py-16 overflow-hidden relative">

          {/* Subtle radial accent */}
          <div
            className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-20 pointer-events-none"
            style={{ background: "radial-gradient(circle, var(--accent) 0%, transparent 70%)" }}
          />

          <div className="relative">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-paper/60 mb-5">
              The clock is ticking
            </p>
            <h2 className="font-serif font-medium text-[36px] sm:text-[48px] leading-[1.02] tracking-[-0.02em] max-w-3xl" style={{fontVariationSettings: '"opsz" 100'}}>
              The opening whistle blows{" "}
              <span className="italic text-gold">June 11, 2026.</span>
            </h2>
            <p className="mt-5 text-[16px] text-paper/75 max-w-xl leading-relaxed">
              Make your picks before the group stage starts. After that, you&rsquo;ll have until each new round opens to commit.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="/auth/signin?callbackUrl=%2Fonboarding"
                className="group inline-flex items-center gap-3 px-6 py-3.5 rounded-md bg-paper text-ink text-[15px] font-semibold hover:bg-gold hover:text-ink transition-colors"
              >
                Create a league
                <span className="font-mono text-[15px] transition-transform group-hover:translate-x-0.5">&rarr;</span>
              </a>
              <a
                href="/auth/signin?callbackUrl=%2Fonboarding%3Fmode%3Djoin"
                className="group inline-flex items-center gap-3 px-6 py-3.5 rounded-md bg-paper/20 text-paper text-[15px] font-semibold hover:bg-paper/30 transition-colors border border-paper/30"
              >
                Join with a code
                <span className="font-mono text-[15px] transition-transform group-hover:translate-x-0.5">&rarr;</span>
              </a>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}

function SectionHeader({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent mb-3">
          {kicker}
        </p>
        <h2 className="font-serif font-medium leading-[1.05] tracking-[-0.02em] ink" style={{fontSize: 'clamp(2rem, 4.5vw, 3rem)', fontVariationSettings: '"opsz" 100'}}>
          {title}
        </h2>
      </div>
      <div className="h-px bg-line flex-1 max-w-[200px] mb-3 hidden sm:block" />
    </div>
  );
}
