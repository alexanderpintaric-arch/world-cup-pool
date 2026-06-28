import { fetchAllWCMatches } from "./football-data";
import { fetchWCOdds, fetchWCScores, fetchWCMatchups } from "./odds";
import {
  getAllMatches, upsertMatches, getAllPicks, getAllUsers,
  upsertOdds, logSync, getLastSync,
  getRemindedRounds, markRoundReminded, getAllBracketPicks,
} from "./supabase";
import { getAllMemberEmails, getAllLeaguesWithMembers } from "./leagues";
import { computeLeaderboard, getRoundStates, getActiveRound } from "./scoring";
import { computeRoundAwards, computeKnockoutAwards } from "./superlatives";
import { sendPoolDigestEmail, sendRoundOpenEmail, sendDeadlineReminderEmail, sendRoundRecapEmail } from "./email";
import type { DigestMatchLine, DigestDay } from "./email";
import type { KnockoutRound } from "./bracket";
import type { SyncResult, Match, Pick } from "../types";

const REMIND_WINDOW_MS = 3 * 60 * 60 * 1000; // 3h
// How long after kickoff we keep checking the fallback score source for a match
// the primary feed hasn't settled. Generous (12h) to cover extra time, penalties
// and football-data's settlement lag, while keeping the extra API call confined
// to the window right after a game where a result is actually pending.
const SCORE_FALLBACK_WINDOW_MS = 12 * 60 * 60 * 1000;
const DIGEST_TZ = "America/Toronto";
const DIGEST_SEND_HOUR = 9;     // don't send the digest before 9am Toronto
const DIGEST_INTERVAL_DAYS = 3; // recap covers (at least) this many match days

/**
 * Protect data we've already learned from a glitchy feed on a later sync.
 * football-data intermittently regresses matches, and an unguarded upsert would
 * faithfully overwrite good data with the regressed values. Two guards:
 *
 *  1. Results — once a match is FINISHED with a result in our DB, never revert it
 *     to unsettled. football-data occasionally drops a result back to null or
 *     flips a finished match to a non-final status, which silently wipes points
 *     from the standings. We keep our stored result; a genuine correction (feed
 *     still settled, just a different score) flows through normally.
 *
 *  2. Teams — once we know a knockout fixture's real team, never revert it to
 *     "TBD". As the bracket is decided, football-data flips knockout fixtures
 *     back to placeholder (null ⇒ "TBD") teams while it reprocesses them; a sync
 *     in that window would overwrite the real matchup we already had and wipe the
 *     bracket to "0/31 — all TBD". We keep each known side; a genuine matchup
 *     change (feed supplies a *real* team) still flows through, since we only
 *     restore when the incoming side is TBD.
 */
function mergeStickyMatchData(feed: Match[], prev: Match[]): Match[] {
  const prevById = new Map(prev.map(m => [m.matchId, m]));
  return feed.map(fm => {
    const p = prevById.get(fm.matchId);
    if (!p) return fm;
    let next = fm;

    // 1. Don't un-settle a result we've already recorded.
    if (p.status === "FINISHED" && p.result != null &&
        (fm.result == null || fm.status !== "FINISHED")) {
      next = { ...next, status: p.status, result: p.result, homeScore: p.homeScore, awayScore: p.awayScore };
    }

    // 2. Don't revert a known team back to TBD.
    const keepHome = fm.homeTeam === "TBD" && p.homeTeam !== "TBD" && p.homeTeam !== "";
    const keepAway = fm.awayTeam === "TBD" && p.awayTeam !== "TBD" && p.awayTeam !== "";
    if (keepHome || keepAway) {
      next = {
        ...next,
        homeTeam: keepHome ? p.homeTeam : next.homeTeam,
        awayTeam: keepAway ? p.awayTeam : next.awayTeam,
      };
    }

    return next;
  });
}

/**
 * Fill the still-TBD side of knockout matchups from the fallback source (The
 * Odds API /events) on every sync. football-data is slow to publish the knockout
 * draw, leaving bracket slots empty while people are picking; this resolves them
 * as soon as the matchup is known anywhere. Fill-only — a real team the primary
 * feed already has is never overwritten — and the /events call is free, so this
 * can run unconditionally (it self-skips when nothing is TBD).
 */
async function applyMatchupFallback(matches: Match[]): Promise<Match[]> {
  const fills = await fetchWCMatchups(matches);
  if (fills.length === 0) return matches;

  const byId = new Map(fills.map(f => [f.matchId, f]));
  return matches.map(m => {
    const f = byId.get(m.matchId);
    if (!f) return m;
    return {
      ...m,
      homeTeam: m.homeTeam === "TBD" && f.home ? f.home : m.homeTeam,
      awayTeam: m.awayTeam === "TBD" && f.away ? f.away : m.awayTeam,
    };
  });
}

/**
 * Fill results the primary feed (football-data) hasn't settled yet from the
 * fallback score source (The Odds API /scores). football-data routinely leaves a
 * finished match unsettled for hours; this stops a decided game from sitting
 * blank — and stranding everyone's points — while we wait on the primary feed.
 *
 * Only fills matches still unsettled in `matches` (the primary feed always wins
 * when it has a result), and only calls the API when a recently-kicked-off game
 * is actually pending, so it costs nothing outside the window around a match.
 */
async function applyScoreFallback(matches: Match[]): Promise<Match[]> {
  const now = Date.now();
  const pending = matches.some(m => {
    if (m.result != null || m.homeTeam === "TBD" || m.awayTeam === "TBD") return false;
    const k = new Date(m.kickoffUtc).getTime();
    return k <= now && now - k <= SCORE_FALLBACK_WINDOW_MS;
  });
  if (!pending) return matches;

  const updates = await fetchWCScores(matches);
  if (updates.length === 0) return matches;

  const byId = new Map(updates.map(u => [u.matchId, u]));
  return matches.map(m => {
    if (m.status === "FINISHED" && m.result != null) return m; // primary already settled it
    const u = byId.get(m.matchId);
    if (!u) return m;
    return { ...m, status: "FINISHED", result: u.result, homeScore: u.homeScore, awayScore: u.awayScore };
  });
}

export async function runSync(options?: { includeOdds?: boolean }): Promise<SyncResult> {
  const syncedAt = new Date().toISOString();
  let matchesUpdated = 0;
  let oddsUpdated = 0;
  const roundsOpened: string[] = [];
  let emailsSent = 0;
  let error = "";

  try {
    // 1. Fetch fresh match data (pinned manual results already applied)
    const feedMatches = await fetchAllWCMatches();

    // 2. Get current state before update (to detect changes)
    const prevMatches = await getAllMatches();
    const prevRoundStates = getRoundStates(prevMatches);

    // 2b. Guard against a feed glitch un-settling a result we've recorded (wiping
    //     points) or reverting a known knockout matchup back to TBD (wiping the
    //     bracket) — football-data does both as it reprocesses the knockout stage.
    let freshMatches = mergeStickyMatchData(feedMatches, prevMatches);

    // 2c. Matchup fallback: fill the still-TBD side of any knockout fixture from
    //     The Odds API /events (free), so bracket slots resolve as soon as the
    //     matchup is known instead of waiting on football-data's lagging draw.
    try {
      freshMatches = await applyMatchupFallback(freshMatches);
    } catch (e) {
      console.error("Matchup fallback failed (non-fatal):", e);
    }

    // 2d. Score fallback: where football-data still hasn't settled a finished
    //     match, fill the result from The Odds API /scores so a decided game
    //     doesn't sit blank for hours waiting on the primary feed.
    try {
      freshMatches = await applyScoreFallback(freshMatches);
    } catch (e) {
      console.error("Score fallback failed (non-fatal):", e);
    }

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

    // 6. Pool digest — one summary email every DIGEST_INTERVAL_DAYS instead of
    //    an email after every match. Covers all match days (Toronto time)
    //    since the previous digest, through yesterday, sent on the first sync
    //    after DIGEST_SEND_HOUR. The last covered day is recorded in the
    //    round_reminders table as "digest:YYYY-MM-DD"; the next digest is due
    //    once yesterday is at least DIGEST_INTERVAL_DAYS past that.
    try {
      const dayMs = 24 * 60 * 60 * 1000;
      const now = new Date();
      const torontoHour = Number(new Intl.DateTimeFormat("en-CA", {
        timeZone: DIGEST_TZ, hour: "2-digit", hour12: false,
      }).format(now));
      // en-CA dateStyle:"short" formats as YYYY-MM-DD
      const torontoDate = (d: Date | string) => new Intl.DateTimeFormat("en-CA", {
        timeZone: DIGEST_TZ, dateStyle: "short",
      }).format(typeof d === "string" ? new Date(d) : d);
      // Pure calendar math on YYYY-MM-DD strings (UTC-pinned, no tz drift)
      const addDays = (day: string, n: number) =>
        new Date(Date.parse(`${day}T00:00:00Z`) + n * dayMs).toISOString().slice(0, 10);
      const daysBetween = (a: string, b: string) =>
        Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / dayMs);

      const endDay = torontoDate(new Date(now.getTime() - dayMs)); // yesterday
      const digestKey = `digest:${endDay}`;

      if (torontoHour >= DIGEST_SEND_HOUR) {
        const reminded = await getRemindedRounds();
        const lastSent = [...reminded]
          .filter(k => k.startsWith("digest:"))
          .map(k => k.slice("digest:".length))
          .sort()
          .pop();
        const due = !lastSent || daysBetween(lastSent, endDay) >= DIGEST_INTERVAL_DAYS;
        const startDay = lastSent
          ? addDays(lastSent, 1)
          : addDays(endDay, -(DIGEST_INTERVAL_DAYS - 1));

        const digestMatches = freshMatches
          .filter(m => {
            const day = torontoDate(m.kickoffUtc);
            return m.status === "FINISHED" && day >= startDay && day <= endDay;
          })
          .sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc));

        if (due && digestMatches.length > 0) {
          const [allPicks, allUsers, allBracketPicks] = await Promise.all([
            getAllPicks(), getAllUsers(), getAllBracketPicks(),
          ]);
          const leaderboard = computeLeaderboard(allUsers, allPicks, freshMatches, allBracketPicks);
          const totalParticipants = leaderboard.length;
          const digestIds = new Set(digestMatches.map(m => m.matchId));

          // Group matches by Toronto match day, preserving kickoff order
          const dayGroups: { day: string; matches: Match[] }[] = [];
          for (const m of digestMatches) {
            const day = torontoDate(m.kickoffUtc);
            const group = dayGroups[dayGroups.length - 1];
            if (group && group.day === day) group.matches.push(m);
            else dayGroups.push({ day, matches: [m] });
          }

          // "June 11–14" within a month, "June 30 – July 2" across months.
          // Pin to UTC noon so the YYYY-MM-DD strings format as-is.
          const fmtDay = (day: string, opts: Intl.DateTimeFormatOptions) =>
            new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", ...opts })
              .format(new Date(`${day}T12:00:00Z`));
          const firstDay = dayGroups[0].day;
          const lastDay = dayGroups[dayGroups.length - 1].day;
          const rangeLabel = firstDay === lastDay
            ? fmtDay(firstDay, { month: "long", day: "numeric" })
            : firstDay.slice(0, 7) === lastDay.slice(0, 7)
              ? `${fmtDay(firstDay, { month: "long", day: "numeric" })}–${fmtDay(lastDay, { day: "numeric" })}`
              : `${fmtDay(firstDay, { month: "long", day: "numeric" })} – ${fmtDay(lastDay, { month: "long", day: "numeric" })}`;

          let sent = 0;
          for (const user of allUsers) {
            // Same match may be picked in several leagues — dedupe by matchId
            const userPicks = new Map<string, Pick>();
            for (const p of allPicks) {
              if (p.email === user.email && digestIds.has(p.matchId) && !userPicks.has(p.matchId)) {
                userPicks.set(p.matchId, p);
              }
            }
            // Only email people who had skin in this stretch's matches
            if (userPicks.size === 0) continue;

            const entry = leaderboard.find(e => e.email === user.email);
            if (!entry) continue;
            const rank = leaderboard.indexOf(entry) + 1;

            let pointsWon = 0;
            const toLine = (m: Match): DigestMatchLine => {
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
              pointsWon += pointsEarned;
              const yourPick =
                pick.pick === "H" ? m.homeTeam :
                pick.pick === "A" ? m.awayTeam : "Draw";
              return { matchName: `${m.homeTeam} vs ${m.awayTeam}`, scoreline, resultLabel, yourPick, correct, pointsEarned };
            };
            const days: DigestDay[] = dayGroups.map(g => ({
              label: fmtDay(g.day, { weekday: "long", month: "long", day: "numeric" }),
              lines: g.matches.map(toLine),
            }));

            try {
              await sendPoolDigestEmail(user.email, user.name, {
                rangeLabel, days, pointsWon,
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
      console.error("Pool digest failed (non-fatal):", e);
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
