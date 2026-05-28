-- Migration 004: add buy_in column to leagues
-- Run this in the Supabase SQL editor before deploying the buy-in feature.

ALTER TABLE leagues
  ADD COLUMN IF NOT EXISTS buy_in INTEGER NOT NULL DEFAULT 0;
