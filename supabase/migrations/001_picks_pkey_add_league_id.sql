-- Migration: fix picks primary key to include league_id
-- Without this, a user making picks in a second league hits a duplicate key
-- violation because the old PK was only (email, match_id).
--
-- Run in Supabase SQL Editor: supabase.com → your project → SQL Editor

-- Step 1: remove any orphaned rows that pre-date the league_id column
-- (league_id is a UUID column, so there's no valid sentinel value to backfill)
DELETE FROM picks WHERE league_id IS NULL;
ALTER TABLE picks ALTER COLUMN league_id SET NOT NULL;

-- Step 2: replace the primary key
ALTER TABLE picks DROP CONSTRAINT picks_pkey;
ALTER TABLE picks ADD PRIMARY KEY (email, match_id, league_id);
