import type { Round } from "./types";

export const ROUND_CONFIG: Record<Round, { label: string; shortLabel: string; pointsValue: number; order: number }> = {
  GROUP:          { label: "Group Stage",    shortLabel: "Group",  pointsValue: 1, order: 0 },
  ROUND_OF_32:    { label: "Round of 32",    shortLabel: "Ro32",   pointsValue: 2, order: 1 },
  ROUND_OF_16:    { label: "Round of 16",    shortLabel: "Ro16",   pointsValue: 3, order: 2 },
  QUARTER_FINALS: { label: "Quarterfinals",  shortLabel: "QF",     pointsValue: 4, order: 3 },
  SEMI_FINALS:    { label: "Semifinals",     shortLabel: "SF",     pointsValue: 5, order: 4 },
  FINAL:          { label: "Final",          shortLabel: "Final",  pointsValue: 6, order: 5 },
};

// football-data.org stage name -> our Round
export const STAGE_MAP: Record<string, Round> = {
  "GROUP_STAGE":              "GROUP",
  "LAST_32":                  "ROUND_OF_32",
  "LAST_16":                  "ROUND_OF_16",
  "QUARTER_FINALS":           "QUARTER_FINALS",
  "SEMI_FINALS":              "SEMI_FINALS",
  "FINAL":                    "FINAL",
  // 3rd-place playoff — bucket with Final (same round, same points)
  "THIRD_PLACE":              "FINAL",
  "THIRD_PLACE_PLAY_OFF":     "FINAL",
  "3RD_PLACE_PLAYOFF":        "FINAL",
  "PLAY_OFF_ROUND_ONE":       "ROUND_OF_32",
};

export const SHEET_NAMES = {
  MATCHES: "matches",
  PICKS:   "picks",
  USERS:   "users",
  ODDS:    "odds",
  SYNC_LOG: "sync_log",
};

// Max points a user can earn if they get everything right from here.
// Group stage: 12 groups × 6 matches = 72 matches × 1 pt = 72
// R32: 16 × 2 = 32 | R16: 8 × 3 = 24 | QF: 4 × 4 = 16
// SF: 2 × 5 = 10   | Final: 1 × 6 = 6  (the 3rd-place playoff is NOT picked)
// Total: 72+32+24+16+10+6 = 160
export const MAX_TOTAL_POINTS =
  72 * 1 +  // group stage  (12 groups × 6 matches)
  16 * 2 +  // R32
   8 * 3 +  // R16
   4 * 4 +  // QF
   2 * 5 +  // SF
   1 * 6;   // Final (champion) — no 3rd-place playoff pick
