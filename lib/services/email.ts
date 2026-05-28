import { Resend } from "resend";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY ?? "placeholder");
}
const FROM = () => process.env.RESEND_FROM_EMAIL ?? "pool@worldcuppool.app";
const APP_NAME = () => process.env.NEXT_PUBLIC_APP_NAME ?? "Nutmeg";
const APP_URL = () => process.env.NEXTAUTH_URL ?? "http://localhost:3000";

export async function sendScoreUpdateEmail(
  to: string,
  name: string,
  opts: {
    matchName: string;
    result: string;
    yourPick: string;
    correct: boolean;
    pointsEarned: number;
    newTotal: number;
    rank: number;
    totalParticipants: number;
  }
): Promise<void> {
  const { matchName, result, yourPick, correct, pointsEarned, newTotal, rank, totalParticipants } = opts;
  const appName = APP_NAME();
  const appUrl = APP_URL();

  await getResend().emails.send({
    from: FROM(),
    to,
    subject: `${correct ? "✓" : "✗"} ${matchName} result — ${appName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="margin: 0 0 16px">${appName}</h2>
        <p>Hi ${name},</p>
        <p>
          <strong>${matchName}</strong> finished: <strong>${result}</strong><br/>
          Your pick: <strong>${yourPick}</strong> —
          <span style="color:${correct ? "#16a34a" : "#dc2626"}">
            ${correct ? `+${pointsEarned} points` : "0 points"}
          </span>
        </p>
        <p>
          Your total score: <strong>${newTotal} pts</strong><br/>
          Current rank: <strong>#${rank}</strong> of ${totalParticipants}
        </p>
        <p>
          <a href="${appUrl}" style="background:#1d4ed8;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block">
            View Leaderboard
          </a>
        </p>
      </div>
    `,
  });
}

export async function sendRoundOpenEmail(
  to: string,
  name: string,
  roundLabel: string,
  deadline: string
): Promise<void> {
  const deadlineStr = new Date(deadline).toLocaleString("en-CA", {
    dateStyle: "full", timeStyle: "short", timeZone: "America/Toronto",
  });
  const appName = APP_NAME();
  const appUrl = APP_URL();

  await getResend().emails.send({
    from: FROM(),
    to,
    subject: `Picks open: ${roundLabel} — ${appName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="margin: 0 0 16px">${appName}</h2>
        <p>Hi ${name},</p>
        <p>The <strong>${roundLabel}</strong> bracket is now set. Submit your picks before:</p>
        <p style="font-size:1.2em;font-weight:bold">${deadlineStr}</p>
        <p>
          <a href="${appUrl}/picks" style="background:#1d4ed8;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block">
            Submit Picks
          </a>
        </p>
      </div>
    `,
  });
}
