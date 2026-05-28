import type { Match, Pick, User, OddsData } from "../types";

export const MOCK_MATCHES: Match[] = [
  // Group A
  { matchId: "1", round: "GROUP", homeTeam: "Mexico", awayTeam: "South Africa", result: "H", status: "FINISHED", kickoffUtc: "2026-06-11T18:00:00Z", pointsValue: 1, homeScore: 2, awayScore: 0 },
  { matchId: "2", round: "GROUP", homeTeam: "Korea", awayTeam: "Czechia", result: "T", status: "FINISHED", kickoffUtc: "2026-06-11T21:00:00Z", pointsValue: 1, homeScore: 1, awayScore: 1 },
  { matchId: "3", round: "GROUP", homeTeam: "Mexico", awayTeam: "Czechia", result: "H", status: "FINISHED", kickoffUtc: "2026-06-15T18:00:00Z", pointsValue: 1, homeScore: 3, awayScore: 1 },
  { matchId: "4", round: "GROUP", homeTeam: "South Africa", awayTeam: "Korea", result: "A", status: "FINISHED", kickoffUtc: "2026-06-15T21:00:00Z", pointsValue: 1, homeScore: 0, awayScore: 1 },
  { matchId: "5", round: "GROUP", homeTeam: "Mexico", awayTeam: "Korea", result: null, status: "SCHEDULED", kickoffUtc: "2026-06-20T00:00:00Z", pointsValue: 1, homeScore: null, awayScore: null },
  { matchId: "6", round: "GROUP", homeTeam: "Czechia", awayTeam: "South Africa", result: null, status: "SCHEDULED", kickoffUtc: "2026-06-20T00:00:00Z", pointsValue: 1, homeScore: null, awayScore: null },
  // Group B
  { matchId: "7", round: "GROUP", homeTeam: "Brazil", awayTeam: "Scotland", result: "H", status: "FINISHED", kickoffUtc: "2026-06-12T15:00:00Z", pointsValue: 1, homeScore: 4, awayScore: 1 },
  { matchId: "8", round: "GROUP", homeTeam: "Morocco", awayTeam: "Haiti", result: "H", status: "FINISHED", kickoffUtc: "2026-06-12T18:00:00Z", pointsValue: 1, homeScore: 2, awayScore: 0 },
  { matchId: "9", round: "GROUP", homeTeam: "USA", awayTeam: "Turkey", result: null, status: "IN_PLAY", kickoffUtc: "2026-06-13T00:00:00Z", pointsValue: 1, homeScore: 1, awayScore: 1 },
  { matchId: "10", round: "GROUP", homeTeam: "Argentina", awayTeam: "Algeria", result: null, status: "SCHEDULED", kickoffUtc: "2026-06-21T18:00:00Z", pointsValue: 1, homeScore: null, awayScore: null },
  { matchId: "11", round: "GROUP", homeTeam: "France", awayTeam: "Senegal", result: null, status: "SCHEDULED", kickoffUtc: "2026-06-22T18:00:00Z", pointsValue: 1, homeScore: null, awayScore: null },
  { matchId: "12", round: "GROUP", homeTeam: "England", awayTeam: "Croatia", result: null, status: "SCHEDULED", kickoffUtc: "2026-06-23T21:00:00Z", pointsValue: 1, homeScore: null, awayScore: null },
  // Round of 32 (locked, upcoming)
  { matchId: "50", round: "ROUND_OF_32", homeTeam: "TBD", awayTeam: "TBD", result: null, status: "SCHEDULED", kickoffUtc: "2026-07-04T18:00:00Z", pointsValue: 2, homeScore: null, awayScore: null },
];

export const MOCK_USERS: User[] = [
  { email: "alex@example.com",    name: "Alex P.",    createdAt: "2026-05-01T00:00:00Z", supportedTeam: "England" },
  { email: "sarah@example.com",   name: "Sarah K.",   createdAt: "2026-05-01T00:00:00Z", supportedTeam: "Brazil" },
  { email: "mike@example.com",    name: "Mike D.",    createdAt: "2026-05-02T00:00:00Z", supportedTeam: "Argentina" },
  { email: "jessica@example.com", name: "Jessica M.", createdAt: "2026-05-02T00:00:00Z", supportedTeam: null },
  { email: "tom@example.com",     name: "Tom R.",     createdAt: "2026-05-03T00:00:00Z", supportedTeam: "France" },
  { email: "emily@example.com",   name: "Emily S.",   createdAt: "2026-05-03T00:00:00Z", supportedTeam: null },
];

const MOCK_LEAGUE_ID = "mock-league";

export const MOCK_PICKS: Pick[] = [
  // Alex's picks
  { email: "alex@example.com", matchId: "1", round: "GROUP", pick: "H", leagueId: MOCK_LEAGUE_ID, odds: 1.55, submittedAt: "2026-06-10T12:00:00Z", updatedAt: "2026-06-10T12:00:00Z" },
  { email: "alex@example.com", matchId: "2", round: "GROUP", pick: "T", leagueId: MOCK_LEAGUE_ID, odds: 3.10, submittedAt: "2026-06-10T12:00:00Z", updatedAt: "2026-06-10T12:00:00Z" },
  { email: "alex@example.com", matchId: "3", round: "GROUP", pick: "H", leagueId: MOCK_LEAGUE_ID, odds: 1.40, submittedAt: "2026-06-10T12:00:00Z", updatedAt: "2026-06-10T12:00:00Z" },
  { email: "alex@example.com", matchId: "4", round: "GROUP", pick: "H", leagueId: MOCK_LEAGUE_ID, odds: 2.20, submittedAt: "2026-06-10T12:00:00Z", updatedAt: "2026-06-10T12:00:00Z" },
  { email: "alex@example.com", matchId: "7", round: "GROUP", pick: "H", leagueId: MOCK_LEAGUE_ID, odds: 1.30, submittedAt: "2026-06-10T12:00:00Z", updatedAt: "2026-06-10T12:00:00Z" },
  { email: "alex@example.com", matchId: "8", round: "GROUP", pick: "H", leagueId: MOCK_LEAGUE_ID, odds: 1.85, submittedAt: "2026-06-10T12:00:00Z", updatedAt: "2026-06-10T12:00:00Z" },
  // Sarah
  { email: "sarah@example.com", matchId: "1", round: "GROUP", pick: "H", leagueId: MOCK_LEAGUE_ID, submittedAt: "2026-06-10T12:00:00Z", updatedAt: "2026-06-10T12:00:00Z" },
  { email: "sarah@example.com", matchId: "2", round: "GROUP", pick: "H", leagueId: MOCK_LEAGUE_ID, submittedAt: "2026-06-10T12:00:00Z", updatedAt: "2026-06-10T12:00:00Z" },
  { email: "sarah@example.com", matchId: "3", round: "GROUP", pick: "H", leagueId: MOCK_LEAGUE_ID, submittedAt: "2026-06-10T12:00:00Z", updatedAt: "2026-06-10T12:00:00Z" },
  { email: "sarah@example.com", matchId: "7", round: "GROUP", pick: "H", leagueId: MOCK_LEAGUE_ID, submittedAt: "2026-06-10T12:00:00Z", updatedAt: "2026-06-10T12:00:00Z" },
  // Mike
  { email: "mike@example.com", matchId: "1", round: "GROUP", pick: "T", leagueId: MOCK_LEAGUE_ID, submittedAt: "2026-06-10T12:00:00Z", updatedAt: "2026-06-10T12:00:00Z" },
  { email: "mike@example.com", matchId: "2", round: "GROUP", pick: "T", leagueId: MOCK_LEAGUE_ID, submittedAt: "2026-06-10T12:00:00Z", updatedAt: "2026-06-10T12:00:00Z" },
  { email: "mike@example.com", matchId: "3", round: "GROUP", pick: "A", leagueId: MOCK_LEAGUE_ID, submittedAt: "2026-06-10T12:00:00Z", updatedAt: "2026-06-10T12:00:00Z" },
  { email: "mike@example.com", matchId: "7", round: "GROUP", pick: "H", leagueId: MOCK_LEAGUE_ID, submittedAt: "2026-06-10T12:00:00Z", updatedAt: "2026-06-10T12:00:00Z" },
  { email: "mike@example.com", matchId: "8", round: "GROUP", pick: "A", leagueId: MOCK_LEAGUE_ID, submittedAt: "2026-06-10T12:00:00Z", updatedAt: "2026-06-10T12:00:00Z" },
  // Jessica
  { email: "jessica@example.com", matchId: "1", round: "GROUP", pick: "H", leagueId: MOCK_LEAGUE_ID, submittedAt: "2026-06-10T12:00:00Z", updatedAt: "2026-06-10T12:00:00Z" },
  { email: "jessica@example.com", matchId: "2", round: "GROUP", pick: "A", leagueId: MOCK_LEAGUE_ID, submittedAt: "2026-06-10T12:00:00Z", updatedAt: "2026-06-10T12:00:00Z" },
  { email: "jessica@example.com", matchId: "7", round: "GROUP", pick: "H", leagueId: MOCK_LEAGUE_ID, submittedAt: "2026-06-10T12:00:00Z", updatedAt: "2026-06-10T12:00:00Z" },
  // Tom
  { email: "tom@example.com", matchId: "1", round: "GROUP", pick: "A", leagueId: MOCK_LEAGUE_ID, submittedAt: "2026-06-10T12:00:00Z", updatedAt: "2026-06-10T12:00:00Z" },
  { email: "tom@example.com", matchId: "3", round: "GROUP", pick: "H", leagueId: MOCK_LEAGUE_ID, submittedAt: "2026-06-10T12:00:00Z", updatedAt: "2026-06-10T12:00:00Z" },
  { email: "tom@example.com", matchId: "7", round: "GROUP", pick: "T", leagueId: MOCK_LEAGUE_ID, submittedAt: "2026-06-10T12:00:00Z", updatedAt: "2026-06-10T12:00:00Z" },
  // Emily
  { email: "emily@example.com", matchId: "1", round: "GROUP", pick: "H", leagueId: MOCK_LEAGUE_ID, submittedAt: "2026-06-10T12:00:00Z", updatedAt: "2026-06-10T12:00:00Z" },
  { email: "emily@example.com", matchId: "2", round: "GROUP", pick: "T", leagueId: MOCK_LEAGUE_ID, submittedAt: "2026-06-10T12:00:00Z", updatedAt: "2026-06-10T12:00:00Z" },
  { email: "emily@example.com", matchId: "8", round: "GROUP", pick: "H", leagueId: MOCK_LEAGUE_ID, submittedAt: "2026-06-10T12:00:00Z", updatedAt: "2026-06-10T12:00:00Z" },
];

export const MOCK_ODDS: OddsData[] = [
  { matchId: "5", homeOdds: 1.85, drawOdds: 3.40, awayOdds: 4.20, homeProb: 54, drawProb: 29, awayProb: 24, updatedAt: "2026-06-19T12:00:00Z" },  // fixed to sum ~100% after normalization
  { matchId: "6", homeOdds: 2.10, drawOdds: 3.10, awayOdds: 3.60, homeProb: 46, drawProb: 32, awayProb: 28, updatedAt: "2026-06-19T12:00:00Z" },
  { matchId: "9", homeOdds: 2.20, drawOdds: 3.20, awayOdds: 3.40, homeProb: 44, drawProb: 31, awayProb: 29, updatedAt: "2026-06-19T12:00:00Z" },
  { matchId: "10", homeOdds: 1.45, drawOdds: 4.20, awayOdds: 7.00, homeProb: 65, drawProb: 22, awayProb: 14, updatedAt: "2026-06-19T12:00:00Z" },
  { matchId: "11", homeOdds: 1.60, drawOdds: 3.80, awayOdds: 5.50, homeProb: 59, drawProb: 25, awayProb: 17, updatedAt: "2026-06-19T12:00:00Z" },
  { matchId: "12", homeOdds: 2.00, drawOdds: 3.30, awayOdds: 3.80, homeProb: 47, drawProb: 30, awayProb: 25, updatedAt: "2026-06-19T12:00:00Z" },
];
