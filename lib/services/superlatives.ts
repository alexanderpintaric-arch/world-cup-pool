import type { Match, Pick, BracketPick, LeaderboardEntry, Round } from "../types";
import { computeActualAdvancers } from "./scoring";
import type { KnockoutRound } from "./bracket";

/**
 * The "funny superlatives" engine. One catalogue of awards, used in two places:
 *   • Round-recap email — one winner per award, scoped to the round just played.
 *   • Stats page — the titles a given player has earned overall (their "honours").
 *
 * Keeping both in one module guarantees the email and the profile speak the
 * same language ("The Oracle" means the same thing everywhere).
 */

export interface AwardWinner {
  key: string;
  emoji: string;
  title: string;
  /** Short, sharable one-liner about why they won it (already includes the value). */
  blurb: string;
  email: string;
  name: string;
}

export interface Title {
  key: string;
  emoji: string;
  title: string;
  blurb: string;
  /** Visual tier — drives colour on the stats page. */
  tone: "gold" | "accent" | "green" | "ink";
}

const PICK_TEAM = (m: Match, p: Pick["pick"]): string =>
  p === "H" ? m.homeTeam : p === "A" ? m.awayTeam : "Draw";

/** Pool pick split per match (how many league members backed each outcome). */
function poolSplit(picks: Pick[]) {
  const map = new Map<string, { H: number; A: number; T: number; total: number }>();
  for (const p of picks) {
    if (!p.pick) continue;
    if (!map.has(p.matchId)) map.set(p.matchId, { H: 0, A: 0, T: 0, total: 0 });
    const c = map.get(p.matchId)!;
    c[p.pick as "H" | "A" | "T"]++;
    c.total++;
  }
  return map;
}

interface RoundAgg {
  email: string;
  name: string;
  picked: number;
  correct: number;
  upsetsHit: number;          // correct picks that <30% of the pool backed
  withCrowd: number;          // picks aligned with the pool's majority outcome
  worstFavFlop: { team: string; odds: number } | null; // biggest favourite they backed that LOST
}

/**
 * Awards for a single round, scoped to that round's FINISHED matches.
 * Returns one winner per award that actually applies (skips empties/ties-to-noise).
 */
export function computeRoundAwards(
  round: Round,
  users: { email: string; name: string }[],
  picks: Pick[],
  matches: Match[],
): AwardWinner[] {
  const roundMatches = matches.filter(
    m => m.round === round && m.status === "FINISHED" && m.result,
  );
  if (roundMatches.length === 0) return [];
  const roundIds = new Set(roundMatches.map(m => m.matchId));
  const matchById = new Map(roundMatches.map(m => [m.matchId, m]));
  const pool = poolSplit(picks.filter(p => roundIds.has(p.matchId)));

  const byEmail = new Map<string, RoundAgg>();
  const nameOf = new Map(users.map(u => [u.email, u.name]));

  for (const p of picks) {
    if (!roundIds.has(p.matchId) || !p.pick) continue;
    const m = matchById.get(p.matchId)!;
    if (!byEmail.has(p.email)) {
      byEmail.set(p.email, {
        email: p.email, name: nameOf.get(p.email) ?? p.email,
        picked: 0, correct: 0, upsetsHit: 0, withCrowd: 0, worstFavFlop: null,
      });
    }
    const a = byEmail.get(p.email)!;
    a.picked++;

    const split = pool.get(p.matchId);
    const correct = p.pick === m.result;
    if (correct) {
      a.correct++;
      if (split && split.total > 0 && split[p.pick as "H" | "A" | "T"] / split.total < 0.3) a.upsetsHit++;
    } else if (typeof p.odds === "number" && p.odds > 1) {
      // backed a favourite (low decimal odds) that lost — track the most shocking flop
      if (!a.worstFavFlop || p.odds < a.worstFavFlop.odds) {
        a.worstFavFlop = { team: PICK_TEAM(m, p.pick), odds: p.odds };
      }
    }
    // crowd alignment: did they side with the pool's most-popular outcome?
    if (split) {
      const top = (["H", "A", "T"] as const).reduce((b, k) => (split[k] > split[b] ? k : b), "H");
      if (p.pick === top) a.withCrowd++;
    }
  }

  const aggs = [...byEmail.values()].filter(a => a.picked > 0);
  if (aggs.length === 0) return [];

  const awards: AwardWinner[] = [];
  const pickMax = <T>(arr: T[], score: (t: T) => number): T | null => {
    let best: T | null = null, bestS = -Infinity;
    for (const t of arr) { const s = score(t); if (s > bestS) { bestS = s; best = t; } }
    return best;
  };

  // 🔮 The Oracle — most correct calls this round
  const oracle = pickMax(aggs, a => a.correct);
  if (oracle && oracle.correct > 0) {
    awards.push({
      key: "oracle", emoji: "🔮", title: "The Oracle", email: oracle.email, name: oracle.name,
      blurb: `Read the round like a book — ${oracle.correct} of ${oracle.picked} dead right.`,
    });
  }

  // 🎯 Flawless — a clean sweep (picked every match, got them all)
  const flawless = aggs.find(a => a.picked === roundMatches.length && a.correct === a.picked);
  if (flawless) {
    awards.push({
      key: "flawless", emoji: "🎯", title: "Flawless", email: flawless.email, name: flawless.name,
      blurb: `A perfect ${flawless.correct}/${flawless.correct}. Not a single slip.`,
    });
  }

  // 🧠 The Contrarian — most against-the-grain calls that landed
  const contrarian = pickMax(aggs, a => a.upsetsHit);
  if (contrarian && contrarian.upsetsHit > 0 && contrarian.email !== oracle?.email) {
    awards.push({
      key: "contrarian", emoji: "🧠", title: "The Contrarian", email: contrarian.email, name: contrarian.name,
      blurb: `Backed ${contrarian.upsetsHit} pick${contrarian.upsetsHit > 1 ? "s" : ""} the room laughed at — and cashed.`,
    });
  }

  // 💔 Heartbreaker — backed the biggest favourite that still went down
  const flops = aggs.filter(a => a.worstFavFlop);
  const heartbreak = pickMax(flops, a => -(a.worstFavFlop!.odds)); // smallest odds = biggest fav
  if (heartbreak && heartbreak.worstFavFlop) {
    awards.push({
      key: "heartbreaker", emoji: "💔", title: "Heartbreaker", email: heartbreak.email, name: heartbreak.name,
      blurb: `Trusted ${heartbreak.worstFavFlop.team} with their heart. ${heartbreak.worstFavFlop.team} did not reciprocate.`,
    });
  }

  // 🐑 Chalk Muncher — sided with the crowd every single time (no courage, all safety)
  const chalk = aggs.find(a => a.picked >= 3 && a.withCrowd === a.picked);
  if (chalk && chalk.email !== oracle?.email) {
    awards.push({
      key: "chalk", emoji: "🐑", title: "Chalk Muncher", email: chalk.email, name: chalk.name,
      blurb: `Sided with the herd on all ${chalk.picked}. Safe. Very, very safe.`,
    });
  }

  // 🥄 Wooden Spoon — the round's cold streak (fewest right, when others did better)
  if (aggs.length >= 3) {
    const spoon = pickMax(aggs, a => -a.correct);
    if (spoon && oracle && spoon.correct < oracle.correct && spoon.email !== heartbreak?.email) {
      awards.push({
        key: "spoon", emoji: "🥄", title: "Wooden Spoon", email: spoon.email, name: spoon.name,
        blurb: `Just ${spoon.correct} of ${spoon.picked}. There's always next round.`,
      });
    }
  }

  return awards;
}

/**
 * Awards for a completed KNOCKOUT round, scored on advancement (which teams the
 * player correctly sent through this round's bracket nodes).
 */
export function computeKnockoutAwards(
  round: KnockoutRound,
  users: { email: string; name: string }[],
  bracketPicks: BracketPick[],
  matches: Match[],
): AwardWinner[] {
  const advancers = computeActualAdvancers(matches)[round];
  if (advancers.size === 0) return [];
  const nameOf = new Map(users.map(u => [u.email, u.name]));

  // teams eliminated THIS round (lost a finished match in this round)
  const eliminatedThisRound = new Set<string>();
  for (const m of matches) {
    if (m.round !== round || m.status !== "FINISHED" || !m.result) continue;
    if (m.result === "H") eliminatedThisRound.add(m.awayTeam);
    else if (m.result === "A") eliminatedThisRound.add(m.homeTeam);
  }

  const agg = new Map<string, { correct: number; picked: number }>();
  const champByEmail = new Map<string, string>();
  for (const bp of bracketPicks) {
    if (bp.nodeId === "F-1") champByEmail.set(bp.email, bp.team);
    if (bp.round !== round) continue;
    if (!agg.has(bp.email)) agg.set(bp.email, { correct: 0, picked: 0 });
    const a = agg.get(bp.email)!;
    a.picked++;
    if (advancers.has(bp.team)) a.correct++;
  }

  const rows = [...agg.entries()].map(([email, a]) => ({ email, name: nameOf.get(email) ?? email, ...a }));
  if (rows.length === 0) return [];

  const awards: AwardWinner[] = [];
  const best = rows.reduce((b, r) => (r.correct > b.correct ? r : b), rows[0]);
  if (best.correct > 0) {
    awards.push({
      key: "ko-oracle", emoji: "🔮", title: "The Oracle", email: best.email, name: best.name,
      blurb: `Called ${best.correct} of this round's survivors. Spooky.`,
    });
  }
  const flawless = rows.find(r => r.picked > 0 && r.correct === r.picked && r.correct >= 2);
  if (flawless && flawless.email !== best.email) {
    awards.push({
      key: "ko-flawless", emoji: "🎯", title: "Flawless", email: flawless.email, name: flawless.name,
      blurb: `Every team they sent through, went through. ${flawless.correct}/${flawless.correct}.`,
    });
  }
  // 💥 Bracket Buster — someone's predicted champion got dumped out this round
  for (const [email, champ] of champByEmail) {
    if (eliminatedThisRound.has(champ)) {
      awards.push({
        key: "ko-buster", emoji: "💥", title: "Bracket Buster", email, name: nameOf.get(email) ?? email,
        blurb: `Their pick to win it all — ${champ} — just went home. Ouch.`,
      });
      break;
    }
  }
  return awards;
}

/**
 * The honours a single player has earned across the tournament so far — shown on
 * their stats page. Derived from the league standings + their picks; pure.
 */
export function earnedTitlesFor(
  email: string,
  entries: LeaderboardEntry[],
  picks: Pick[],
  matches: Match[],
): Title[] {
  const me = entries.find(e => e.email === email);
  if (!me) return [];
  const titles: Title[] = [];

  const rank = entries.findIndex(e => e.email === email) + 1;
  const anyScored = entries.some(e => e.totalScore > 0);
  const acc = me.totalPicks > 0 ? me.correctPicks / me.totalPicks : 0;

  // 👑 Front-Runner — top of the table (only meaningful once points exist)
  if (rank === 1 && anyScored && entries.length > 1) {
    titles.push({
      key: "frontrunner", emoji: "👑", title: "Front-Runner", tone: "gold",
      blurb: "Top of the table. For now.",
    });
  }

  // 🔥 On Fire — a live streak of 3+ correct calls
  if (me.streak >= 3) {
    titles.push({
      key: "onfire", emoji: "🔥", title: "On Fire", tone: "accent",
      blurb: `${me.streak} correct in a row and counting.`,
    });
  }

  // 💎 Perfectionist — flawless record with real volume
  if (acc === 1 && me.correctPicks >= 5) {
    titles.push({
      key: "perfect", emoji: "💎", title: "Perfectionist", tone: "green",
      blurb: `${me.correctPicks} picks, ${me.correctPicks} right. Spotless.`,
    });
  } else if (me.totalPicks >= 8 && acc >= 0.6) {
    // 🎓 The Oracle — best accuracy in the league (with volume)
    const eligible = entries.filter(e => e.totalPicks >= 8);
    const topAcc = Math.max(...eligible.map(e => e.correctPicks / e.totalPicks));
    if (acc === topAcc) {
      titles.push({
        key: "oracle", emoji: "🔮", title: "The Oracle", tone: "gold",
        blurb: `Sharpest read in the league — ${Math.round(acc * 100)}% called right.`,
      });
    }
  }

  // 🧠 The Contrarian — most against-the-grain correct calls in the league
  if (me.upsets > 0) {
    const topUpsets = Math.max(...entries.map(e => e.upsets));
    if (me.upsets === topUpsets) {
      titles.push({
        key: "contrarian", emoji: "🧠", title: "The Contrarian", tone: "accent",
        blurb: `${me.upsets} upset${me.upsets > 1 ? "s" : ""} nobody else saw coming.`,
      });
    }
  }

  // 🐴 Dark Horse — bottom half of the table but the best max-possible upside left
  if (rank > entries.length / 2 && entries.length >= 4) {
    const topCeiling = Math.max(...entries.map(e => e.maxPossibleScore));
    if (me.maxPossibleScore === topCeiling) {
      titles.push({
        key: "darkhorse", emoji: "🐴", title: "Dark Horse", tone: "ink",
        blurb: "Down the table, but the highest ceiling left in the pack.",
      });
    }
  }

  return titles;
}
