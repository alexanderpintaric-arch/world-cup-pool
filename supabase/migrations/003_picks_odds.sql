-- Migration 003: snapshot the decimal odds of the picked outcome at pick time
-- Nullable: knockout/TBD matches and pre-existing picks won't have odds.
-- Safe to run multiple times.

ALTER TABLE picks
  ADD COLUMN IF NOT EXISTS odds numeric;
