-- ─────────────────────────────────────────────────────────────────────────
-- Clear out TEST leagues before going live.
-- Run in: Supabase dashboard → SQL Editor → paste → Run.
--
-- Deletes (in foreign-key-safe order): picks, league memberships, leagues,
-- and the deadline-reminder dedup table.
-- PRESERVES: users, matches, odds, sync_log.
--
-- Wrapped in a transaction — if anything errors, nothing is deleted.
-- ─────────────────────────────────────────────────────────────────────────

begin;

delete from picks;            -- all picks (they belong to the test leagues)
delete from league_members;   -- all memberships
delete from leagues;          -- the leagues themselves
delete from round_reminders;  -- reset the 24h-reminder dedup (optional, clean slate)

commit;

-- Sanity check (should all be 0):
-- select
--   (select count(*) from leagues)        as leagues,
--   (select count(*) from league_members) as members,
--   (select count(*) from picks)          as picks;
