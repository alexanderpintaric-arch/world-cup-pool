import type { Round } from "./types";

export const ROUND_CONFIG: Record<Round, { label: string; pointsValue: number; order: number }> = {
  GROUP:          { label: "Group Stage",    pointsValue: 1, order: 0 },
  ROUND_OF_32:    { label: "Round of 32",    pointsValue: 2, order: 1 },
  ROUND_OF_16:    { label: "Round of 16",    pointsValue: 3, order: 2 },
  QUARTER_FINALS: { label: "Quarterfinals",  pointsValue: 4, order: 3 },
  SEMI_FINALS:    { label: "Semifinals",     pointsValue: 5, order: 4 },
  FINAL:          { label: "Final",          pointsValue: 6, order: 5 },
};

// football-data.org stage name -> our Round
export const STAGE_MAP: Record<string, Round> = {
  "GROUP_STAGE":         "GROUP",
  "LAST_32":             "ROUND_OF_32",
  "LAST_16":             "ROUND_OF_16",
  "QUARTER_FINALS":      "QUARTER_FINALS",
  "SEMI_FINALS":         "SEMI_FINALS",
  "FINAL":               "FINAL",
};

export const SHEET_NAMES = {
  MATCHES: "matches",
  PICKS:   "picks",
  USERS:   "users",
  ODDS:    "odds",
  SYNC_LOG: "sync_log",
};

// Max points a user can earn if they get everything right from here
export const MAX_TOTAL_POINTS =
  48 * 1 +  // group stage
  16 * 2 +  // R32
   8 * 3 +  // R16
   4 * 4 +  // QF
   2 * 5 +  // SF
   1 * 6;   // Final  = 48+32+24+16+10+6 = 136
