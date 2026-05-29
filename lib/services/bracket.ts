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
 * never changes anyone's score. That makes the simple adjacent-pairing tree below
 * safe; the official FIFA slotting can be layered on later via R32_MATCH_ORDER
 * without touching scoring.
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
 * Optional manual override for R32 bracket slotting. When set to the 16 real
 * R32 match ids in official bracket order, it pins each match to its slot.
 * Left empty by default — we fall back to a deterministic kickoff/id sort, which
 * is score-neutral (see module docstring).
 */
export const R32_MATCH_ORDER: string[] = [];

/**
 * Map the 16 real Round-of-32 matches onto bracket slots 0..15.
 * Returns a fixed-length-16 array; entries are null until the matchup is known.
 */
export function orderedR32Matches(allMatches: Match[]): (Match | null)[] {
  const r32 = allMatches.filter(
    m => m.round === "ROUND_OF_32" && !(m.homeTeam === "TBD" && m.awayTeam === "TBD")
  );

  let ordered: Match[];
  if (R32_MATCH_ORDER.length === 16) {
    const byId = new Map(r32.map(m => [m.matchId, m]));
    ordered = R32_MATCH_ORDER.map(id => byId.get(id)).filter((m): m is Match => !!m);
  } else {
    ordered = [...r32].sort(
      (a, b) =>
        new Date(a.kickoffUtc).getTime() - new Date(b.kickoffUtc).getTime() ||
        a.matchId.localeCompare(b.matchId)
    );
  }

  const slots: (Match | null)[] = Array(16).fill(null);
  for (let i = 0; i < 16; i++) slots[i] = ordered[i] ?? null;
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
