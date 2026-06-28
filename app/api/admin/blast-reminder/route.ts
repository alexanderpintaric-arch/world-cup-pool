export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { auth, isAdmin } from "@/lib/auth";
import { getAllUsers } from "@/lib/services/supabase";
import { sendDeadlineReminderEmail } from "@/lib/services/email";

// POST /api/admin/blast-reminder
// Body: { round: string, deadline: string (ISO) }
// Sends the deadline reminder email to every user immediately.
export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`;
  if (!isCron) {
    const session = await auth();
    if (!isAdmin(session?.user?.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const { round, deadline } = await req.json() as { round: string; deadline: string };
  if (!round || !deadline) {
    return NextResponse.json({ error: "Missing round or deadline" }, { status: 400 });
  }

  const users = await getAllUsers();
  let sent = 0;
  const errors: string[] = [];

  for (const user of users) {
    try {
      await sendDeadlineReminderEmail(user.email, user.name, round, deadline);
      sent++;
      // Stay well under Resend's 10 req/s limit
      await new Promise(r => setTimeout(r, 150));
    } catch (e) {
      errors.push(`${user.email}: ${e}`);
    }
  }

  return NextResponse.json({ sent, errors, total: users.length });
}
