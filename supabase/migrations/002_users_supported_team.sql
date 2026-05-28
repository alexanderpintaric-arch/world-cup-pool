-- Migration 002: add supported_team column to users table
-- Safe to run multiple times (IF NOT EXISTS guard)

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS supported_team TEXT NULL;
