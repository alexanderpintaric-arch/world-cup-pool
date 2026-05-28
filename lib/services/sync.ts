import { fetchAllWCMatches } from "./football-data";
import { fetchWCOdds } from "./odds";
import {
  getAllMatches, upsertMatches, getAllPicks, getAllUsers,
  upsertOdds, logSync, getLastSync,
  getRemindedRounds, markRoundReminded,
} from "./supabase";
import { getAllMemberEmails } from "./leagues";
import { computeLeaderboard, getRoundStates, getActiveRound } from "./scoring";
import { sendScoreUpdateEmail, sendRoundOpenEmail, sendDeadlineReminderEmail } from "./email";
import type { SyncResult, Match } from "../types";

const REMIND_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h

export async function runSync(): Promise<SyncResult> {
  const syncedAt = new Date().toISOString();
  let matchesUpdated = 0;
  const roundsOpened: string[] = [];
  let emailsSent = 0;
  let error = "";

  try {
    // 1. Fetch fresh match data
    const freshMatches = await fetchAllWCMatches();

    // 2. Get current state before update (to detect changes)
    const prevMatches = await getAllMatches();
    const prevFinished = new Set(
      prevMatches.filter(m => m.status === "FINISHED").map(m => m.matchId)
    );
    const prevRoundStates = getRoundStates(prevMatches);

    // 3. Upsert matches into Sheets
    matchesUpdated = await upsertMatches(freshMatches);

    // 4. Detect newly finished matches
    const newlyFinished = freshMatches.filter(
      m => m.status === "FINISHED" && !prevFinished.has(m.matchId)
    );

    // 5. Fetch odds (non-fatal) — pass fresh matches so IDs can be resolved by team name
    try {
      const odds = await fetchWCOdds(freshMatches);
      if (odds.length > 0) await upsertOdds(odds);
    } catch (e) {
      console.error("Odds sync failed (non-fatal):", e);
    }

    // 6. Send score update emails for newly finished matches
    if (newlyFinished.length > 0) {
      const [allPicks, allUsers] = await Promise.all([getAllPicks(), getAllUsers()]);
      const leaderboard = computeLeaderboard(allUsers, allPicks, freshMatches);
      const totalParticipants = leaderboard.length;

      for (const match of newlyFinished) {
        const affectedPicks = allPicks.filter(p => p.matchId === match.matchId);

        for (const pick of affectedPicks) {
          const user = allUsers.find(u => u.email === pick.email);
          if (!user) continue;

          const entry = leaderboard.find(e => e.email === pick.email);
          if (!entry) continue;

          const rank = leaderboard.indexOf(entry) + 1;
          const correct = pick.pick === match.result;
          const resultLabel =
            match.result === "H" ? match.homeTeam :
            match.result === "A" ? match.awayTeam : "Draw";
          const pickLabel =
            pick.pick === "H" ? match.homeTeam :
            pick.pick === "A" ? match.awayTeam : "Draw";

          try {
            await sendScoreUpdateEmail(user.email, user.name, {
              matchName: `${match.homeTeam} vs ${match.awayTeam}`,
              result: resultLabel,
              yourPick: pickLabel,
              correct,
              pointsEarned: correct ? match.pointsValue : 0,
              newTotal: entry.totalScore,
              rank,
              totalParticipants,
            });
            emailsSent++;
          } catch (e) {
            console.error(`Email failed for ${user.email}:`, e);
          }
        }
      }
    }

    // 7. Detect newly opened rounds (send "picks open" emails)
    const newRoundStates = getRoundStates(freshMatches);
    const prevActiveRound = getActiveRound(prevRoundStates);
    const newActiveRound = getActiveRound(newRoundStates);

    if (newActiveRound && newActiveRound.round !== prevActiveRound?.round) {
      roundsOpened.push(newActiveRound.label);

      if (newActiveRound.round !== "GROUP") {
        // Only send "round open" emails for knockout rounds
        const allUsers = await getAllUsers();
        for (const user of allUsers) {
          try {
            await sendRoundOpenEmail(
              user.email, user.name,
              newActiveRound.label,
              newActiveRound.deadline!
            );
            emailsSent++;
          } catch (e) {
            console.error(`Round-open email failed for ${user.email}:`, e);
          }
        }
      }
    }

    // 8. Deadline reminders — ~24h before any available round locks
    try {
      const now = Date.now();
      const reminded = await getRemindedRounds();
      const dueRounds = newRoundStates.filter(rs =>
        rs.isAvailable &&
        rs.matchCount > 0 &&
        rs.deadline != null &&
        !reminded.has(rs.round) &&
        (() => {
          const ms = new Date(rs.deadline!).getTime() - now;
          return ms > 0 && ms <= REMIND_WINDOW_MS;
        })()
      );

      if (dueRounds.length > 0) {
        const [allUsers, memberEmails] = await Promise.all([
          getAllUsers(),
          getAllMemberEmails(),
        ]);
        const recipients = allUsers.filter(u => memberEmails.has(u.email));

        for (const rs of dueRounds) {
          let sentForRound = 0;
          for (const user of recipients) {
            try {
              await sendDeadlineReminderEmail(user.email, user.name, rs.label, rs.deadline!);
              emailsSent++;
              sentForRound++;
            } catch (e) {
              console.error(`Deadline reminder failed for ${user.email}:`, e);
            }
          }
          // Mark sent so a second run today won't re-send
          if (sentForRound > 0) await markRoundReminded(rs.round);
        }
      }
    } catch (e) {
      console.error("Deadline reminders failed (non-fatal):", e);
    }
  } catch (e) {
    error = e instanceof Error ? e.message : ((e as any)?.message ?? JSON.stringify(e));
    console.error("Sync error:", e);
  }

  await logSync({
    syncedAt,
    matchesUpdated,
    roundsOpened: roundsOpened.join(", "),
    emailsSent,
    error,
  });

  return { matchesUpdated, roundsOpened, emailsSent, error: error || undefined, syncedAt };
}
