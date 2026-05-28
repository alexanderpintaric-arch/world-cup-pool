-- Migration 004: dedup table for 24h deadline-reminder emails
-- Without it, the once-daily cron still naturally avoids duplicates; this table
-- makes reminders idempotent even if the sync runs more than once in a day.
-- Safe to run multiple times.

create table if not exists round_reminders (
  round   text primary key,
  sent_at timestamptz default now()
);
