import { fetchAllWCMatches } from "./football-data";
import { fetchWCOdds } from "./odds";
import {
  getAllMatches, upsertMatches, getAllPicks, getAllUsers,
  upsertOdds, logSync, getLastSync,
  getRemindedRounds, markRoundReminded, getAllBracketPicks,
} from "./supabase";
import { getAllMemberEmails, getAllLeaguesWithMembers } from "./leagues";
import { computeLeaderboard, getRoundStates, getActiveRound } from "./scoring";
import { computeRoundAwards, computeKnockoutAwards } from "./superlatives";
import { sendDailyDigestEmail, sendRoundOpenEmail, sendDeadlineReminderEmail, sendRoundRecapEmail } from "./email";
import type { DigestMatchLine } from "./email";
import type { KnockoutRound } from "./bracket";
import type { SyncResult, Match, Pick } from "../types";

const REMIND_WINDOW_MS = 3 * 60 * 60 * 1000; // 3h
const DIGEST_TZ = "America/Toronto";
const DIGEST_SEND_HOUR = 9; // don't send the daily digest before 9am Toronto

export async function runSync(options?: { includeOdds?: boolean }): Promise<SyncResult> {
  const syncedAt = new Date().toISOString();
  let matchesUpdated = 0;
  let oddsUpdated = 0;
  const roundsOpened: string[] = [];
  let emailsSent = 0;
  let error = "";

  try {
    // 1. Fetch fresh match data
    const freshMatches = await fetchAllWCMatches();

    // 2. Get current state before update (to detect changes)
    const prevMatches = await getAllMatches();
    const prevRoundStates = getRoundStates(prevMatches);

    // 3. Upsert matches into Sheets
    matchesUpdated = await upsertMatches(freshMatches);

    // 5. Fetch odds (opt-in only — the recurring sync skips this; odds are
    //    refreshed manually from the admin console)
    if (options?.includeOdds) {
      try {
        const odds = await fetchWCOdds(freshMatches);
        if (odds.length > 0) {
          await upsertOdds(odds);
          oddsUpdated = odds.length;
        }
      } catch (e) {
        console.error("Odds sync failed (non-fatal):", e);
      }
    }

    // 6. Daily digest — one summary email per match day instead of an email
    //    after every match. Covers the previous day's results (Toronto time),
    //    sent on the first sync after DIGEST_SEND_HOUR. Deduped per day via
    //    the round_reminders table with a "digest:" key.
    try {
      const now = new Date();
      const torontoHour = Number(new Intl.DateTimeFormat("en-CA", {
        timeZone: DIGEST_TZ, hour: "2-digit", hour12: false,
      }).format(now));
      // en-CA dateStyle:"short" formats as YYYY-MM-DD
      const torontoDate = (d: Date | string) => new Intl.DateTimeFormat("en-CA", {
        timeZone: DIGEST_TZ, dateStyle: "short",
      }).format(typeof d === "string" ? new Date(d) : d);
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const digestDay = torontoDate(yesterday);
      const digestKey = `digest:${digestDay}`;

      if (torontoHour >= DIGEST_SEND_HOUR) {
        const reminded = await getRemindedRounds();
        const digestMatches = freshMatches
          .filter(m => m.status === "FINISHED" && torontoDate(m.kickoffUtc) === digestDay)
          .sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc));

        if (!reminded.has(digestKey) && digestMatches.length > 0) {
          const [allPicks, allUsers, allBracketPicks] = await Promise.all([
            getAllPicks(), getAllUsers(), getAllBracketPicks(),
          ]);
          const leaderboard = computeLeaderboard(allUsers, allPicks, freshMatches, allBracketPicks);
          const totalParticipants = leaderboard.length;
          const digestIds = new Set(digestMatches.map(m => m.matchId));
          const dateLabel = new Intl.DateTimeFormat("en-CA", {
            timeZone: DIGEST_TZ, weekday: "long", month: "long", day: "numeric",
          }).format(yesterday);

          let sent = 0;
          for (const user of allUsers) {
            // Same match may be picked in several leagues — dedupe by matchId
            const userPicks = new Map<string, Pick>();
            for (const p of allPicks) {
              if (p.email === user.email && digestIds.has(p.matchId) && !userPicks.has(p.matchId)) {
                userPicks.set(p.matchId, p);
              }
            }
            // Only email people who had skin in yesterday's matches
            if (userPicks.size === 0) continue;

            const entry = leaderboard.find(e => e.email === user.email);
            if (!entry) continue;
            const rank = leaderboard.indexOf(entry) + 1;

            let dayPoints = 0;
            const lines: DigestMatchLine[] = digestMatches.map(m => {
              const resultLabel =
                m.result === "H" ? m.homeTeam :
                m.result === "A" ? m.awayTeam : "Draw";
              const scoreline = m.homeScore != null && m.awayScore != null
                ? `${m.homeScore}–${m.awayScore}` : "";
              const pick = userPicks.get(m.matchId);
              if (!pick) {
                return { matchName: `${m.homeTeam} vs ${m.awayTeam}`, scoreline, resultLabel, yourPick: null, correct: null, pointsEarned: 0 };
              }
              const correct = pick.pick === m.result;
              const pointsEarned = correct ? m.pointsValue : 0;
              dayPoints += pointsEarned;
              const yourPick =
                pick.pick === "H" ? m.homeTeam :
                pick.pick === "A" ? m.awayTeam : "Draw";
              return { matchName: `${m.homeTeam} vs ${m.awayTeam}`, scoreline, resultLabel, yourPick, correct, pointsEarned };
            });

            try {
              await sendDailyDigestEmail(user.email, user.name, {
                dateLabel, lines, dayPoints,
                totalScore: entry.totalScore, rank, totalParticipants,
              });
              emailsSent++; sent++;
            } catch (e) {
              console.error(`Digest email failed for ${user.email}:`, e);
            }
          }
          if (sent > 0) await markRoundReminded(digestKey);
        }
      }
    } catch (e) {
      console.error("Daily digest failed (non-fatal):", e);
    }

    // 7. Detect newly opened rounds (send "picks open" emails)
    const newRoundStates = getRoundStates(freshMatches);
    const prevActiveRound = getActiveRound(prevRoundStates);
    const newActiveRound = getActiveRound(newRoundStates);

    if (newActiveRound && newActiveRound.round !== prevActiveRound?.round) {
      roundsOpened.push(newActiveRound.label);

      // Knockout is now a single bracket filled out at once, so the only
      // knockout "round open" notice is when the bracket unlocks (R32 becomes
      // available). R16/QF/SF/Final no longer trigger per-round emails.
      if (newActiveRound.round === "ROUND_OF_32") {
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

    // 8. Deadline reminders — ~3h before any available round locks
    try {
      const now = Date.now();
      const reminded = await getRemindedRounds();
      // Knockout deadline reminders collapse to a single one for the bracket
      // (R32 lock); the later knockout rounds don't have their own deadlines now.
      const KNOCKOUT_NON_BRACKET = ["ROUND_OF_16", "QUARTER_FINALS", "SEMI_FINALS", "FINAL"];
      const dueRounds = newRoundStates.filter(rs =>
        rs.isAvailable &&
        rs.matchCount > 0 &&
        !KNOCKOUT_NON_BRACKET.includes(rs.round) &&
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

    // 9. Round recaps — when a round fully completes, email each league a recap
    //    with the standings + this round's funny superlatives. Deduped per
    //    (league, round) via the round_reminders table using a "recap:" prefix.
    try {
      const newlyCompleted = newRoundStates.filter(rs => {
        const prev = prevRoundStates.find(p => p.round === rs.round);
        return rs.matchCount > 0 && rs.isComplete && !prev?.isComplete;
      });

      if (newlyCompleted.length > 0) {
        const [allPicks, allBracketPicks, allUsers, leagues, reminded] = await Promise.all([
          getAllPicks(), getAllBracketPicks(), getAllUsers(), getAllLeaguesWithMembers(), getRemindedRounds(),
        ]);

        for (const rs of newlyCompleted) {
          for (const league of leagues) {
            const dedupKey = `recap:${league.id}:${rs.round}`;
            if (reminded.has(dedupKey)) continue;

            const memberSet = new Set(league.memberEmails);
            const leagueUsers = allUsers.filter(u => memberSet.has(u.email));
            if (leagueUsers.length === 0) continue;

            const leaguePicks   = allPicks.filter(p => p.leagueId === league.id);
            const leagueBracket = allBracketPicks.filter(b => b.leagueId === league.id);
            const entries = computeLeaderboard(leagueUsers, leaguePicks, freshMatches, leagueBracket);
            if (entries.length === 0) continue;

            const awards = rs.round === "GROUP"
              ? computeRoundAwards("GROUP", leagueUsers, leaguePicks, freshMatches)
              : computeKnockoutAwards(rs.round as KnockoutRound, leagueUsers, leagueBracket, freshMatches);
            const awardPayload = awards.map(a => ({ emoji: a.emoji, title: a.title, name: a.name, blurb: a.blurb }));

            let sentForLeague = 0;
            for (let i = 0; i < entries.length; i++) {
              const entry = entries[i];
              const top = entries.slice(0, 3).map(e => ({ name: e.name, score: e.totalScore, isYou: e.email === entry.email }));
              try {
                await sendRoundRecapEmail(entry.email, entry.name, {
                  roundLabel: rs.label,
                  leagueName: league.name,
                  rank: i + 1,
                  totalParticipants: entries.length,
                  totalScore: entry.totalScore,
                  top,
                  youInTop: i < 3,
                  awards: awardPayload,
                });
                emailsSent++; sentForLeague++;
              } catch (e) {
                console.error(`Recap email failed for ${entry.email}:`, e);
              }
            }
            if (sentForLeague > 0) await markRoundReminded(dedupKey);
          }
        }
      }
    } catch (e) {
      console.error("Round recaps failed (non-fatal):", e);
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

  return { matchesUpdated, oddsUpdated, roundsOpened, emailsSent, error: error || undefined, syncedAt };
}

// Standalone odds refresh, triggered manually from the admin console. Uses the
// matches already in the database rather than re-hitting football-data.org.
export async function runOddsSync(): Promise<{ oddsUpdated: number; syncedAt: string; error?: string }> {
  const syncedAt = new Date().toISOString();
  try {
    const matches = await getAllMatches();
    const odds = await fetchWCOdds(matches);
    if (odds.length > 0) await upsertOdds(odds);
    return { oddsUpdated: odds.length, syncedAt };
  } catch (e) {
    const error = e instanceof Error ? e.message : JSON.stringify(e);
    console.error("Odds sync failed:", e);
    return { oddsUpdated: 0, syncedAt, error };
  }
}
