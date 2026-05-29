import type { Match, Round } from "../types";

/**
 * Static description of the 2026 World Cup knockout bracket.
 *
 * The bracket is a binary tree of 31 nodes:
 *   16 Round-of-32 leaves → 8 Round-of-16 → 4 Quarterfinals → 2 Semifinals → 1 Final.
 *
 * Each non-leaf node is fed by two child nodes; the winner the user advances out
 * of a child flows into the parent slot. R32 leaves map onto the 16 real R32
 * matches (which carry real teams + odds once the group stage completes).
 *
 * NOTE: because scoring is advancement-based (you earn a round's points for every
 * team you correctly predict to advance, regardless of the specific opponent),
 * the exact left/right pairing of the tree only affects the *visual* layout — it
 * never changes anyone's score. The adjacent-pairing tree below is aligned to the
 * official FIFA 2026 slotting via R32_SLOTS / NODE_KICKOFF (see below).
 */

export type KnockoutRound =
  | "ROUND_OF_32"
  | "ROUND_OF_16"
  | "QUARTER_FINALS"
  | "SEMI_FINALS"
  | "FINAL";

export const KNOCKOUT_ROUNDS: KnockoutRound[] = [
  "ROUND_OF_32",
  "ROUND_OF_16",
  "QUARTER_FINALS",
  "SEMI_FINALS",
  "FINAL",
];

export interface BracketNode {
  id: string;
  round: KnockoutRound;
  /** Child node ids feeding this node. Empty for R32 leaves. */
  children: string[];
  /** R32 leaves only: 0-based slot into the ordered real R32 match list. */
  matchSlot?: number;
}

function buildNodes(): BracketNode[] {
  const nodes: BracketNode[] = [];
  for (let i = 1; i <= 16; i++)
    nodes.push({ id: `R32-${i}`, round: "ROUND_OF_32", children: [], matchSlot: i - 1 });
  for (let i = 1; i <= 8; i++)
    nodes.push({ id: `R16-${i}`, round: "ROUND_OF_16", children: [`R32-${2 * i - 1}`, `R32-${2 * i}`] });
  for (let i = 1; i <= 4; i++)
    nodes.push({ id: `QF-${i}`, round: "QUARTER_FINALS", children: [`R16-${2 * i - 1}`, `R16-${2 * i}`] });
  for (let i = 1; i <= 2; i++)
    nodes.push({ id: `SF-${i}`, round: "SEMI_FINALS", children: [`QF-${2 * i - 1}`, `QF-${2 * i}`] });
  nodes.push({ id: "F-1", round: "FINAL", children: ["SF-1", "SF-2"] });
  return nodes;
}

export const BRACKET_NODES: BracketNode[] = buildNodes();
export const BRACKET_NODE_MAP: Map<string, BracketNode> = new Map(
  BRACKET_NODES.map(n => [n.id, n])
);

const PARENT_OF: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const n of BRACKET_NODES) for (const c of n.children) m.set(c, n.id);
  return m;
})();

export function parentOf(nodeId: string): string | null {
  return PARENT_OF.get(nodeId) ?? null;
}

export function nodesInRound(round: KnockoutRound): BracketNode[] {
  return BRACKET_NODES.filter(n => n.round === round);
}

export function isKnockoutRound(round: Round): round is KnockoutRound {
  return (KNOCKOUT_ROUNDS as string[]).includes(round);
}

/**
 * Official FIFA 2026 Round-of-32 slotting, in bracket (top-to-bottom) order so
 * adjacent pairs feed the correct Round-of-16 match. Each slot carries its
 * group-position seed labels (shown as placeholders until the group stage sets
 * real teams) and the scheduled kickoff. Source: FIFA 2026 match schedule
 * (matches 73–88). This order matches Apple Sports' bracket.
 */
export interface R32Slot {
  /** FIFA match number (73–88). */
  matchNo: number;
  /** Group-position seed label for the top participant, e.g. "1E". */
  home: string;
  /** Seed label for the bottom participant, e.g. "3A/B/C/D/F". */
  away: string;
  /** Scheduled kickoff (UTC ISO). */
  kickoffUtc: string;
}

export const R32_SLOTS: R32Slot[] = [
  { matchNo: 74, home: "1E", away: "3A/B/C/D/F", kickoffUtc: "2026-06-29T20:30:00Z" },
  { matchNo: 77, home: "1I", away: "3C/D/F/G/H", kickoffUtc: "2026-06-30T21:00:00Z" },
  { matchNo: 73, home: "2A", away: "2B",         kickoffUtc: "2026-06-28T19:00:00Z" },
  { matchNo: 75, home: "1F", away: "2C",         kickoffUtc: "2026-06-30T01:00:00Z" },
  { matchNo: 83, home: "2K", away: "2L",         kickoffUtc: "2026-07-02T23:00:00Z" },
  { matchNo: 84, home: "1H", away: "2J",         kickoffUtc: "2026-07-02T19:00:00Z" },
  { matchNo: 81, home: "1D", away: "3B/E/F/I/J", kickoffUtc: "2026-07-02T00:00:00Z" },
  { matchNo: 82, home: "1G", away: "3A/E/H/I/J", kickoffUtc: "2026-07-01T20:00:00Z" },
  { matchNo: 76, home: "1C", away: "2F",         kickoffUtc: "2026-06-29T17:00:00Z" },
  { matchNo: 78, home: "2E", away: "2I",         kickoffUtc: "2026-06-30T17:00:00Z" },
  { matchNo: 79, home: "1A", away: "3C/E/F/H/I", kickoffUtc: "2026-07-01T01:00:00Z" },
  { matchNo: 80, home: "1L", away: "3E/H/I/J/K", kickoffUtc: "2026-07-01T16:00:00Z" },
  { matchNo: 86, home: "1J", away: "2H",         kickoffUtc: "2026-07-03T22:00:00Z" },
  { matchNo: 88, home: "2D", away: "2G",         kickoffUtc: "2026-07-03T18:00:00Z" },
  { matchNo: 85, home: "1B", away: "3E/F/G/I/J", kickoffUtc: "2026-07-03T03:00:00Z" },
  { matchNo: 87, home: "1K", away: "3D/E/I/J/L", kickoffUtc: "2026-07-04T01:30:00Z" },
];

/**
 * Scheduled kickoff (UTC ISO) for every bracket node, official FIFA 2026
 * schedule. Lets every card show a date/time even before teams are decided.
 * R16/QF/SF/F follow the tree pairing of R32_SLOTS (see knockout stage matches
 * 89–104; the Final is match 104, not the third-place playoff).
 */
export const NODE_KICKOFF: Record<string, string> = {
  ...Object.fromEntries(R32_SLOTS.map((s, i) => [`R32-${i + 1}`, s.kickoffUtc])),
  // R16 (matches 89,90,93,94,91,92,95,96 in node order R16-1..8)
  "R16-1": "2026-07-04T21:00:00Z", "R16-2": "2026-07-04T17:00:00Z",
  "R16-3": "2026-07-06T19:00:00Z", "R16-4": "2026-07-07T00:00:00Z",
  "R16-5": "2026-07-05T20:00:00Z", "R16-6": "2026-07-06T00:00:00Z",
  "R16-7": "2026-07-07T16:00:00Z", "R16-8": "2026-07-07T20:00:00Z",
  // QF (97,98,99,100)
  "QF-1": "2026-07-09T20:00:00Z", "QF-2": "2026-07-10T19:00:00Z",
  "QF-3": "2026-07-11T21:00:00Z", "QF-4": "2026-07-12T01:00:00Z",
  // SF (101,102)
  "SF-1": "2026-07-14T19:00:00Z", "SF-2": "2026-07-15T19:00:00Z",
  // Final (104)
  "F-1": "2026-07-19T19:00:00Z",
};

/**
 * Official FIFA match number for every bracket node (matches 73–104). R16/QF/SF
 * follow the same tree pairing as NODE_KICKOFF; the Final is match 104.
 */
export const NODE_MATCH_NO: Record<string, number> = {
  ...Object.fromEntries(R32_SLOTS.map((s, i) => [`R32-${i + 1}`, s.matchNo])),
  "R16-1": 89, "R16-2": 90, "R16-3": 93, "R16-4": 94,
  "R16-5": 91, "R16-6": 92, "R16-7": 95, "R16-8": 96,
  "QF-1": 97, "QF-2": 98, "QF-3": 99, "QF-4": 100,
  "SF-1": 101, "SF-2": 102,
  "F-1": 104,
};

/** Seed labels for a Round-of-32 node, or null for non-R32 nodes. */
export function r32SlotLabels(nodeId: string): [string, string] | null {
  const node = BRACKET_NODE_MAP.get(nodeId);
  if (!node || node.round !== "ROUND_OF_32" || node.matchSlot === undefined) return null;
  const slot = R32_SLOTS[node.matchSlot];
  return slot ? [slot.home, slot.away] : null;
}

/**
 * Map the 16 real Round-of-32 matches onto bracket slots 0..15 in official
 * order: the k-th-earliest real fixture fills the k-th-earliest official slot,
 * so each match lands in its true bracket position (same schedule ⇒ same order).
 * Returns a fixed-length-16 array; entries are null until the matchup is known.
 */
export function orderedR32Matches(allMatches: Match[]): (Match | null)[] {
  const slots: (Match | null)[] = Array(16).fill(null);
  const r32 = allMatches.filter(
    m => m.round === "ROUND_OF_32" && !(m.homeTeam === "TBD" && m.awayTeam === "TBD")
  );
  if (r32.length === 0) return slots;

  const slotOrder = R32_SLOTS
    .map((s, i) => ({ i, t: new Date(s.kickoffUtc).getTime() }))
    .sort((a, b) => a.t - b.t)
    .map(x => x.i);
  const sortedReal = [...r32].sort(
    (a, b) =>
      new Date(a.kickoffUtc).getTime() - new Date(b.kickoffUtc).getTime() ||
      a.matchId.localeCompare(b.matchId)
  );

  for (let k = 0; k < sortedReal.length && k < 16; k++) slots[slotOrder[k]] = sortedReal[k];
  return slots;
}

/**
 * The two teams competing for a bracket node, given the user's current picks.
 * For R32 leaves the participants are the real match's home/away teams; for
 * deeper nodes they are whatever teams the user advanced from the two children.
 * A slot is `null` when its feeder hasn't been decided yet.
 */
export function participantsOf(
  nodeId: string,
  picksByNode: Record<string, string | undefined>,
  r32Slots: (Match | null)[]
): [string | null, string | null] {
  const node = BRACKET_NODE_MAP.get(nodeId);
  if (!node) return [null, null];

  if (node.round === "ROUND_OF_32") {
    const m = r32Slots[node.matchSlot ?? -1] ?? null;
    return m ? [m.homeTeam, m.awayTeam] : [null, null];
  }

  const [c0, c1] = node.children;
  return [picksByNode[c0] ?? null, picksByNode[c1] ?? null];
}

/**
 * Re-validate a bracket from the leaves up, dropping any pick whose team is no
 * longer one of its slot's participants (e.g. after an upstream winner changed).
 * Returns a cleaned copy. Pure — does not mutate the input.
 */
export function sanitizeBracket(
  picksByNode: Record<string, string | undefined>,
  r32Slots: (Match | null)[]
): Record<string, string> {
  const next: Record<string, string> = {};
  // Process shallow→deep so a node's children are already validated when we reach it.
  for (const round of KNOCKOUT_ROUNDS) {
    for (const node of nodesInRound(round)) {
      const chosen = picksByNode[node.id];
      if (!chosen) continue;
      const [a, b] = participantsOf(node.id, next, r32Slots);
      if (chosen === a || chosen === b) next[node.id] = chosen;
      // else: invalid given current upstream picks — drop it (and, implicitly,
      // anything downstream that depended on it, since it won't be a participant).
    }
  }
  return next;
}
