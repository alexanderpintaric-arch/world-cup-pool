import { Resend } from "resend";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY ?? "placeholder");
}
const FROM = () => process.env.RESEND_FROM_EMAIL ?? "Nutmeg <pool@nutmeg.bet>";

/**
 * Send via Resend and SURFACE failures. The Resend SDK resolves with
 * { data, error } instead of throwing on API errors (bad key, unverified
 * domain, from-address mismatch, etc.), so we must inspect `error` ourselves
 * and throw — otherwise sends fail silently with no log.
 */
async function deliver(payload: Parameters<ReturnType<typeof getResend>["emails"]["send"]>[0]) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not set");
  }
  const { data, error } = await getResend().emails.send(payload);
  if (error) {
    throw new Error(`Resend error [${(error as { name?: string }).name ?? "unknown"}]: ${error.message ?? JSON.stringify(error)}`);
  }
  return data;
}
const APP_NAME = () => process.env.NEXT_PUBLIC_APP_NAME ?? "Nutmeg";
const APP_URL = () =>
  process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? "https://nutmeg.bet";

// ── Brand tokens (mirror globals.css) ───────────────────────────────────────
const C = {
  paper:     "#F5F1E8",
  paperDeep: "#ECE6D4",
  card:      "#FFFEFA",
  ink:       "#0B1426",
  inkSoft:   "#475065",
  inkFaint:  "#8089A0",
  line:      "#E0DACA",
  accent:    "#C9302C",
  gold:      "#A07820",
  green:     "#1B5E20",
};

const SERIF = "Georgia, 'Times New Roman', serif";
const SANS  = "Helvetica, Arial, sans-serif";
const MONO  = "'Courier New', ui-monospace, monospace";

// ── Reusable pieces ─────────────────────────────────────────────────────────

function p(text: string, extra = ""): string {
  return `<p style="font-family:${SANS};font-size:15px;line-height:1.62;color:${C.inkSoft};margin:0 0 16px;${extra}">${text}</p>`;
}

function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:${C.ink};color:#FFFDF8;font-family:${SANS};font-size:14px;font-weight:600;text-decoration:none;padding:13px 28px;border-radius:10px;">${label} &rarr;</a>`;
}

/** Branded email shell — paper background, serif masthead, accent stripe. */
function shell(opts: { preview?: string; kicker?: string; heading: string; bodyHtml: string }): string {
  const { preview = "", kicker = "", heading, bodyHtml } = opts;
  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light">
</head>
<body style="margin:0;padding:0;background:${C.paperDeep};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.paperDeep};">${preview}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.paperDeep};padding:30px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:${C.card};border:1px solid ${C.line};border-radius:18px;overflow:hidden;">
        <tr><td style="height:5px;background:${C.accent};line-height:5px;font-size:0;">&nbsp;</td></tr>
        <tr><td style="padding:30px 34px 6px;text-align:center;">
          <div style="font-family:${SERIF};font-style:italic;font-weight:600;font-size:31px;color:${C.ink};line-height:1;">Nutmeg</div>
          <div style="font-family:${MONO};font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:${C.inkFaint};margin-top:9px;">World Cup 2026 &middot; Pool</div>
        </td></tr>
        <tr><td style="padding:0 34px;"><div style="border-top:1px solid ${C.line};margin:22px 0;"></div></td></tr>
        <tr><td style="padding:0 34px 6px;">
          ${kicker ? `<div style="font-family:${MONO};font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${C.accent};margin-bottom:12px;">${kicker}</div>` : ""}
          <h1 style="font-family:${SERIF};font-weight:600;font-size:27px;line-height:1.15;color:${C.ink};margin:0 0 18px;">${heading}</h1>
          ${bodyHtml}
        </td></tr>
        <tr><td style="padding:26px 34px 32px;">
          <div style="border-top:1px solid ${C.line};padding-top:18px;font-family:${MONO};font-size:11px;line-height:1.6;color:${C.inkFaint};text-align:center;">
            Nutmeg &middot; A friend&rsquo;s pool, built for friends<br>Jun 11 &mdash; Jul 19, 2026 &middot; 🇨🇦 🇲🇽 🇺🇸
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function firstName(name: string): string {
  return (name ?? "").trim().split(/\s+/)[0] || "there";
}

// ── 1. League welcome (on create / join) ────────────────────────────────────

export async function sendLeagueWelcomeEmail(
  to: string,
  name: string,
  opts: { leagueName: string; code: string; isCreator: boolean }
): Promise<void> {
  const { leagueName, code, isCreator } = opts;
  const appUrl = APP_URL();

  const scoringRows = [
    ["Group stage", "1 pt"],
    ["Round of 32", "2 pts"],
    ["Round of 16", "3 pts"],
    ["Quarterfinals", "4 pts"],
    ["Semifinals", "5 pts"],
    ["Final", "6 pts"],
  ].map(([r, v], i) => `
    <tr>
      <td style="padding:7px 0;font-family:${SANS};font-size:13.5px;color:${C.inkSoft};${i > 0 ? `border-top:1px solid ${C.line};` : ""}">${r}</td>
      <td style="padding:7px 0;font-family:${MONO};font-size:13px;font-weight:bold;color:${C.ink};text-align:right;${i > 0 ? `border-top:1px solid ${C.line};` : ""}">${v}</td>
    </tr>`).join("");

  const codeBox = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 22px;">
      <tr><td style="background:${C.paper};border:1px dashed ${C.line};border-radius:12px;padding:18px 20px;text-align:center;">
        <div style="font-family:${MONO};font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:${C.inkFaint};margin-bottom:8px;">Your league code</div>
        <div style="font-family:${MONO};font-size:30px;font-weight:bold;letter-spacing:0.24em;color:${C.ink};">${code}</div>
        <div style="font-family:${SANS};font-size:12.5px;color:${C.inkSoft};margin-top:8px;">Share it so your crew can join <strong style="color:${C.ink};">${leagueName}</strong></div>
      </td></tr>
    </table>`;

  const body = `
    ${p(`Hey ${firstName(name)},`)}
    ${p(isCreator
      ? `<strong style="color:${C.ink};">${leagueName}</strong> is live, and you&rsquo;re the commissioner. 🏆 Time to round up your crew and start the trash talk early.`
      : `You&rsquo;re in <strong style="color:${C.ink};">${leagueName}</strong>! 🎉 Welcome to the pool — here&rsquo;s everything you need to know.`)}

    <div style="font-family:${MONO};font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${C.accent};margin:24px 0 10px;">How it works</div>
    ${p(`Pick a winner &mdash; or call a draw &mdash; for <strong style="color:${C.ink};">every single match</strong>, from the opening whistle to the final. The further the tournament goes, the more each correct pick is worth:`)}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.paper};border:1px solid ${C.line};border-radius:12px;padding:6px 18px;margin:0 0 20px;">
      ${scoringRows}
    </table>

    ${p(`Your picks save the instant you tap them, and you can change your mind as often as you like &mdash; right up until each round&rsquo;s deadline.`)}

    <div style="font-family:${MONO};font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${C.accent};margin:24px 0 10px;">What to expect</div>
    ${p(`&bull;&nbsp; <strong style="color:${C.ink};">Group stage</strong> kicks off <strong style="color:${C.ink};">June 11, 2026</strong> &mdash; pick every match individually before each kicks off.<br>
        &bull;&nbsp; <strong style="color:${C.ink};">Knockout bracket</strong> opens after the group stage. Fill it out <em>once</em> &mdash; your picks cover all five rounds from the Round of 32 to the Final. We&rsquo;ll email you when it opens.<br>
        &bull;&nbsp; We&rsquo;ll give you a friendly <strong style="color:${C.ink};">nudge 3 hours</strong> before each deadline, so you never get caught out.`)}

    ${codeBox}

    <div style="text-align:center;margin:6px 0 4px;">
      ${button(`${appUrl}/picks`, "Make your picks")}
    </div>
    ${p(`See you on the leaderboard.`, `text-align:center;margin-top:18px;font-style:italic;font-family:${SERIF};color:${C.inkFaint};`)}
  `;

  await deliver({
    from: FROM(),
    to,
    subject: isCreator
      ? `🏆 ${leagueName} is live — here's the playbook`
      : `🎉 You're in ${leagueName} — here's the playbook`,
    html: shell({
      preview: isCreator
        ? `Your league is live. Here's how to play and your code to share.`
        : `Welcome to ${leagueName}. Here's how the pool works.`,
      kicker: isCreator ? "League created" : "Welcome aboard",
      heading: isCreator ? "Your league is live." : `Welcome to the pool.`,
      bodyHtml: body,
    }),
  });
}

// ── 2. Deadline reminder (~24h before a round locks) ────────────────────────

export async function sendDeadlineReminderEmail(
  to: string,
  name: string,
  roundLabel: string,
  deadline: string
): Promise<void> {
  const appUrl = APP_URL();
  const deadlineStr = new Date(deadline).toLocaleString("en-CA", {
    weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit",
    timeZone: "America/Toronto", timeZoneName: "short",
  });

  const body = `
    ${p(`Heads up, ${firstName(name)} &mdash;`)}
    ${p(`Picks for the <strong style="color:${C.ink};">${roundLabel}</strong> lock in about <strong style="color:${C.accent};">3 hours</strong>, when the first whistle blows.`)}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 22px;">
      <tr><td style="background:${C.paper};border:1px solid ${C.line};border-radius:12px;padding:16px 20px;text-align:center;">
        <div style="font-family:${MONO};font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:${C.inkFaint};margin-bottom:7px;">Picks lock</div>
        <div style="font-family:${MONO};font-size:16px;font-weight:bold;color:${C.ink};">${deadlineStr}</div>
      </td></tr>
    </table>

    ${p(`Already picked everything? Give your slip one last look &mdash; back a dark horse, trust a hunch, change your mind. Once the round kicks off, every pick is locked for good.`)}

    <div style="text-align:center;margin:6px 0 4px;">
      ${button(`${appUrl}/picks`, "Review my picks")}
    </div>
  `;

  await deliver({
    from: FROM(),
    to,
    subject: `⏰ ${roundLabel} picks lock in ~3 hours`,
    html: shell({
      preview: `Last call — lock in your ${roundLabel} picks before the first whistle.`,
      kicker: "Deadline approaching",
      heading: `Last call for ${roundLabel}.`,
      bodyHtml: body,
    }),
  });
}

// ── 3. Knockout bracket open (sent once, when R32 draw is set) ──────────────
// Note: this email is only sent when ROUND_OF_32 becomes available. Later
// knockout rounds (R16 → Final) are part of the same bracket — no separate
// email per round.

export async function sendRoundOpenEmail(
  to: string,
  name: string,
  roundLabel: string,
  deadline: string
): Promise<void> {
  const appUrl = APP_URL();
  const deadlineStr = new Date(deadline).toLocaleString("en-CA", {
    weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit",
    timeZone: "America/Toronto", timeZoneName: "short",
  });

  const bracketRounds = [
    ["Round of 32",  "2 pts"],
    ["Round of 16",  "3 pts"],
    ["Quarterfinals","4 pts"],
    ["Semifinals",   "5 pts"],
    ["Final",        "6 pts"],
  ].map(([r, v], i) => `
    <tr>
      <td style="padding:7px 0;font-family:${SANS};font-size:13.5px;color:${C.inkSoft};${i > 0 ? `border-top:1px solid ${C.line};` : ""}">${r}</td>
      <td style="padding:7px 0;font-family:${MONO};font-size:13px;font-weight:bold;color:${C.ink};text-align:right;${i > 0 ? `border-top:1px solid ${C.line};` : ""}">${v}</td>
    </tr>`).join("");

  const body = `
    ${p(`Hi ${firstName(name)},`)}
    ${p(`The group stage is done and the knockout draw is set. <strong style="color:${C.ink};">Your bracket is now open.</strong>`)}
    ${p(`Fill it out once &mdash; your picks cover all five knockout rounds from the Round of 32 to the Final. Every team you correctly pick to advance scores points:`)}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.paper};border:1px solid ${C.line};border-radius:12px;padding:6px 18px;margin:0 0 20px;">
      ${bracketRounds}
    </table>

    ${p(`Your bracket locks when the Round of 32 kicks off &mdash; fill it in before:`)}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 22px;">
      <tr><td style="background:${C.paper};border:1px solid ${C.line};border-radius:12px;padding:16px 20px;text-align:center;">
        <div style="font-family:${MONO};font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:${C.inkFaint};margin-bottom:7px;">Bracket locks</div>
        <div style="font-family:${MONO};font-size:16px;font-weight:bold;color:${C.ink};">${deadlineStr}</div>
      </td></tr>
    </table>

    <div style="text-align:center;margin:6px 0 4px;">
      ${button(`${appUrl}/picks`, "Fill out my bracket")}
    </div>
    ${p(`Good luck &mdash; may your bracket survive the first weekend.`, `text-align:center;margin-top:18px;font-style:italic;font-family:${SERIF};color:${C.inkFaint};`)}
  `;

  await deliver({
    from: FROM(),
    to,
    subject: `🏆 Your knockout bracket is open — ${APP_NAME()}`,
    html: shell({
      preview: `The knockout draw is set. Fill out your bracket before the Round of 32 kicks off.`,
      kicker: "Bracket open",
      heading: `Fill out your bracket.`,
      bodyHtml: body,
    }),
  });
}

// ── 4. Daily digest (one summary per match day, replaces per-match emails) ──

export interface DigestMatchLine {
  matchName: string;          // "Mexico vs Poland"
  scoreline: string;          // "2–1", or "" if scores unavailable
  resultLabel: string;        // winning team name, or "Draw"
  yourPick: string | null;    // null = recipient didn't pick this match
  correct: boolean | null;
  pointsEarned: number;
}

export async function sendDailyDigestEmail(
  to: string,
  name: string,
  opts: {
    dateLabel: string;        // "Thursday, June 12"
    lines: DigestMatchLine[];
    dayPoints: number;
    totalScore: number;
    rank: number;
    totalParticipants: number;
  }
): Promise<void> {
  const { dateLabel, lines, dayPoints, totalScore, rank, totalParticipants } = opts;
  const appUrl = APP_URL();

  const picked = lines.filter(l => l.yourPick !== null);
  const correctCount = picked.filter(l => l.correct).length;

  const matchRows = lines.map((l, i) => {
    const border = i > 0 ? `border-top:1px solid ${C.line};` : "";
    const verdict = l.yourPick === null
      ? `<span style="color:${C.inkFaint};">&mdash;</span>`
      : l.correct
        ? `<span style="color:${C.green};">&#10003; +${l.pointsEarned}</span>`
        : `<span style="color:${C.accent};">&#10007;</span>`;
    return `
      <tr>
        <td style="padding:10px 0;${border}">
          <div style="font-family:${SANS};font-size:13.5px;font-weight:600;color:${C.ink};">${l.matchName}</div>
          <div style="font-family:${SANS};font-size:12px;color:${C.inkSoft};margin-top:3px;">${l.scoreline ? `${l.scoreline} &middot; ` : ""}${l.resultLabel === "Draw" ? "Draw" : `${l.resultLabel} won`}${l.yourPick ? ` &middot; you picked ${l.yourPick}` : ""}</div>
        </td>
        <td style="padding:10px 0;font-family:${MONO};font-size:13px;font-weight:bold;text-align:right;vertical-align:top;${border}">${verdict}</td>
      </tr>`;
  }).join("");

  const body = `
    ${p(`Hi ${firstName(name)},`)}
    ${p(`Here&rsquo;s how <strong style="color:${C.ink};">${dateLabel}</strong> shook out${picked.length > 0 ? ` &mdash; you went <strong style="color:${C.ink};">${correctCount}/${picked.length}</strong> on the day` : ""}.`)}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.paper};border:1px solid ${C.line};border-radius:12px;padding:4px 18px;margin:4px 0 20px;">
      ${matchRows}
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.paper};border:1px solid ${C.line};border-radius:12px;padding:6px 18px;margin:0 0 20px;">
      <tr>
        <td style="padding:9px 0;font-family:${SANS};font-size:13.5px;color:${C.inkSoft};">Points won</td>
        <td style="padding:9px 0;font-family:${MONO};font-size:13.5px;font-weight:bold;color:${dayPoints > 0 ? C.green : C.ink};text-align:right;">+${dayPoints}</td>
      </tr>
      <tr>
        <td style="padding:9px 0;font-family:${SANS};font-size:13.5px;color:${C.inkSoft};border-top:1px solid ${C.line};">Your total</td>
        <td style="padding:9px 0;font-family:${MONO};font-size:13.5px;font-weight:bold;color:${C.ink};text-align:right;border-top:1px solid ${C.line};">${totalScore} pts</td>
      </tr>
      <tr>
        <td style="padding:9px 0;font-family:${SANS};font-size:13.5px;color:${C.inkSoft};border-top:1px solid ${C.line};">Current rank</td>
        <td style="padding:9px 0;font-family:${MONO};font-size:13.5px;font-weight:bold;color:${C.ink};text-align:right;border-top:1px solid ${C.line};">#${rank} of ${totalParticipants}</td>
      </tr>
    </table>

    <div style="text-align:center;margin:6px 0 4px;">
      ${button(`${appUrl}`, "View the standings")}
    </div>
  `;

  await deliver({
    from: FROM(),
    to,
    subject: picked.length > 0
      ? `⚽ ${dateLabel} recap: ${correctCount}/${picked.length} picks, +${dayPoints} pts`
      : `⚽ ${dateLabel} recap — ${APP_NAME()}`,
    html: shell({
      preview: `Yesterday's results and where you stand: #${rank} of ${totalParticipants}.`,
      kicker: "Daily recap",
      heading: `Yesterday, settled.`,
      bodyHtml: body,
    }),
  });
}

// ── 5. Round recap (when a round fully completes) — superlatives + standings ──

export interface RecapAward { emoji: string; title: string; name: string; blurb: string }
export interface RecapStanding { name: string; score: number; isYou: boolean }

export async function sendRoundRecapEmail(
  to: string,
  name: string,
  opts: {
    roundLabel: string;
    leagueName: string;
    rank: number;
    totalParticipants: number;
    totalScore: number;
    top: RecapStanding[];   // top 3 (pre-sorted)
    youInTop: boolean;      // is the recipient already shown in `top`?
    awards: RecapAward[];
  },
): Promise<void> {
  const { roundLabel, leagueName, rank, totalParticipants, totalScore, top, youInTop, awards } = opts;
  const appUrl = APP_URL();

  const medal = (i: number) => (i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "·");

  const standingRow = (label: string, score: number, mark: string, you: boolean) => `
    <tr>
      <td style="padding:9px 0;font-family:${SANS};font-size:14px;color:${you ? C.ink : C.inkSoft};font-weight:${you ? 700 : 400};border-top:1px solid ${C.line};">
        <span style="display:inline-block;width:22px;">${mark}</span>${label}${you ? ` <span style="font-family:${MONO};font-size:9px;letter-spacing:0.14em;color:${C.green};text-transform:uppercase;">you</span>` : ""}
      </td>
      <td style="padding:9px 0;font-family:${MONO};font-size:14px;font-weight:bold;color:${C.ink};text-align:right;border-top:1px solid ${C.line};">${score}</td>
    </tr>`;

  const standingsRows = top.map((s, i) => standingRow(s.name, s.score, medal(i), s.isYou)).join("");
  const youRow = youInTop ? "" : standingRow(name, totalScore, `${rank}`, true);

  const awardsHtml = awards.length === 0 ? "" : `
    <div style="font-family:${MONO};font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${C.accent};margin:26px 0 12px;">This round's honours</div>
    ${awards.map(a => `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.paper};border:1px solid ${C.line};border-radius:12px;margin:0 0 10px;">
        <tr>
          <td style="padding:13px 14px;vertical-align:top;width:40px;font-size:24px;line-height:1;">${a.emoji}</td>
          <td style="padding:13px 14px 13px 0;">
            <div style="font-family:${SERIF};font-weight:700;font-size:16px;color:${C.ink};line-height:1.1;">${a.title} <span style="font-weight:400;color:${C.inkSoft};">— ${a.name}</span></div>
            <div style="font-family:${SANS};font-size:13px;color:${C.inkSoft};margin-top:4px;line-height:1.5;">${a.blurb}</div>
          </td>
        </tr>
      </table>`).join("")}`;

  const body = `
    ${p(`Hey ${firstName(name)},`)}
    ${p(`The <strong style="color:${C.ink};">${roundLabel}</strong> is in the books. Here's how <strong style="color:${C.ink};">${leagueName}</strong> shook out.`)}

    <div style="font-family:${MONO};font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${C.accent};margin:24px 0 6px;">Standings</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 4px;">
      ${standingsRows}
      ${youRow}
    </table>
    ${p(rank === 1
        ? `You're <strong style="color:${C.ink};">top of the table</strong> with ${totalScore} pts. Stay there. 👑`
        : `You're <strong style="color:${C.ink};">${rank}${ordinalSuffix(rank)}</strong> of ${totalParticipants} on ${totalScore} pts.`,
      `margin-top:14px;`)}

    ${awardsHtml}

    <div style="text-align:center;margin:24px 0 4px;">
      ${button(`${appUrl}/stats`, "See your dossier")}
    </div>
    <div style="text-align:center;margin-top:12px;">
      <a href="${appUrl}/" style="font-family:${MONO};font-size:12px;color:${C.inkSoft};text-decoration:none;letter-spacing:0.06em;">View full standings &rarr;</a>
    </div>
  `;

  await deliver({
    from: FROM(),
    to,
    subject: `🏁 ${roundLabel} recap — ${leagueName}`,
    html: shell({
      preview: `How ${leagueName} shook out after the ${roundLabel}, plus this round's honours.`,
      kicker: "Round recap",
      heading: `${roundLabel}: the verdict.`,
      bodyHtml: body,
    }),
  });
}

function ordinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return s[(v - 20) % 10] ?? s[v] ?? s[0];
}
