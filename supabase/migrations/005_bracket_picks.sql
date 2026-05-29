-- Knockout bracket picks (March Madness style).
-- Run this in the Supabase SQL Editor.
--
-- The group stage keeps using the existing `picks` table untouched. Knockout
-- predictions move here: one row per bracket node the user has filled. A node's
-- `team` is the team the user advances out of that slot. Later-round matchups
-- are hypothetical (invented by the user), so they can't live in `picks`, which
-- is keyed by real match ids.

create table if not exists bracket_picks (
  email        text not null references users(email),
  league_id    text not null,            -- scopes the bracket per league
  node_id      text not null,            -- 'R32-1' ... 'F-1'
  round        text not null,            -- ROUND_OF_32 ... FINAL
  team         text not null,            -- predicted winner advancing from this node
  odds         numeric,                  -- decimal odds snapshot; R32 only, else null
  submitted_at timestamptz default now(),
  updated_at   timestamptz default now(),
  primary key (email, league_id, node_id) -- one pick per node per league per user
);

create index if not exists bracket_picks_league_idx on bracket_picks (league_id);
create index if not exists bracket_picks_email_league_idx on bracket_picks (email, league_id);
