-- Run this in the Supabase SQL Editor (supabase.com → your project → SQL Editor)

create table matches (
  match_id     text primary key,
  round        text not null,
  home_team    text not null,
  away_team    text not null,
  result       text,          -- 'H' | 'A' | 'T' | null
  status       text not null,
  kickoff_utc  timestamptz not null,
  points_value int not null,
  home_score   int,
  away_score   int,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create table users (
  email          text primary key,
  name           text not null,
  supported_team text,           -- nullable; user-chosen WC team (cosmetic only)
  created_at     timestamptz default now()
);

create table picks (
  email        text not null references users(email),
  match_id     text not null references matches(match_id),
  round        text not null,
  pick         text not null,  -- 'H' | 'A' | 'T'
  league_id    text not null,  -- scopes picks per league
  submitted_at timestamptz default now(),
  updated_at   timestamptz default now(),
  primary key (email, match_id, league_id)  -- one pick per match per league per user
);

create table odds (
  match_id   text primary key references matches(match_id),
  home_odds  numeric,
  draw_odds  numeric,
  away_odds  numeric,
  home_prob  numeric,
  draw_prob  numeric,
  away_prob  numeric,
  updated_at timestamptz default now()
);

create table sync_log (
  id               bigint generated always as identity primary key,
  synced_at        timestamptz default now(),
  matches_updated  int default 0,
  rounds_opened    text default '',
  emails_sent      int default 0,
  error            text default ''
);
