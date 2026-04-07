-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ============================================================
-- players
-- ============================================================
create table if not exists players (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,
  username    text not null,
  platform    text not null check (platform in ('PC', 'PS4', 'X1', 'Switch')),
  rank_tier   text check (rank_tier in ('Rookie', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Master', 'Predator')),
  rank_lp     integer,
  cached_at   timestamptz,
  created_at  timestamptz not null default now(),

  unique (username, platform)
);

create index if not exists players_username_platform on players (username, platform);
create index if not exists players_user_id on players (user_id);

-- ============================================================
-- matches
-- ============================================================
create table if not exists matches (
  id          uuid primary key default gen_random_uuid(),
  match_id    text not null,
  player_id   uuid not null references players(id) on delete cascade,
  date        timestamptz not null,
  placement   integer not null,
  map         text,
  game_mode   text,
  created_at  timestamptz not null default now(),

  unique (match_id, player_id)
);

create index if not exists matches_player_id_date on matches (player_id, date desc);

-- ============================================================
-- match_players  (per-legend stats for each player in a match)
-- ============================================================
create table if not exists match_players (
  id             uuid primary key default gen_random_uuid(),
  match_id       uuid not null references matches(id) on delete cascade,
  player_id      uuid not null references players(id) on delete cascade,
  legend         text not null,
  kills          integer not null default 0,
  damage         integer not null default 0,
  assists        integer,
  survived_time  integer,  -- seconds
  created_at     timestamptz not null default now(),

  unique (match_id, player_id)
);

create index if not exists match_players_match_id   on match_players (match_id);
create index if not exists match_players_player_id  on match_players (player_id);
create index if not exists match_players_legend     on match_players (player_id, legend);

-- ============================================================
-- sessions
-- ============================================================
create table if not exists sessions (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid not null references players(id) on delete cascade,
  started_at  timestamptz not null,
  ended_at    timestamptz,
  match_ids   uuid[] not null default '{}',
  created_at  timestamptz not null default now(),

  unique (player_id, started_at)
);

create index if not exists sessions_player_id_started on sessions (player_id, started_at desc);

-- ============================================================
-- insights
-- ============================================================
create table if not exists insights (
  id            uuid primary key default gen_random_uuid(),
  player_id     uuid not null references players(id) on delete cascade,
  type          text not null check (type in ('legend_chemistry', 'session_fatigue', 'ranked_momentum', 'squad_role_gap')),
  content       text not null,
  generated_at  timestamptz not null default now(),
  seen          boolean not null default false
);

create index if not exists insights_player_id_seen on insights (player_id, seen);
create index if not exists insights_player_id_type on insights (player_id, type, generated_at desc);

-- ============================================================
-- updated_at trigger for players cache invalidation
-- ============================================================
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.cached_at = now();
  return new;
end;
$$;

-- ============================================================
-- Row Level Security
-- ============================================================
alter table players      enable row level security;
alter table matches      enable row level security;
alter table match_players enable row level security;
alter table sessions     enable row level security;
alter table insights     enable row level security;

-- Players: users own their own player record
create policy "players: owner access"
  on players for all
  using (user_id = auth.uid());

-- Matches: accessible if player belongs to the current user
create policy "matches: owner access"
  on matches for all
  using (
    exists (
      select 1 from players
      where players.id = matches.player_id
        and players.user_id = auth.uid()
    )
  );

-- Match players: same ownership check through matches → players
create policy "match_players: owner access"
  on match_players for all
  using (
    exists (
      select 1 from matches
      join players on players.id = matches.player_id
      where matches.id = match_players.match_id
        and players.user_id = auth.uid()
    )
  );

-- Sessions: owner via player
create policy "sessions: owner access"
  on sessions for all
  using (
    exists (
      select 1 from players
      where players.id = sessions.player_id
        and players.user_id = auth.uid()
    )
  );

-- Insights: owner via player
create policy "insights: owner access"
  on insights for all
  using (
    exists (
      select 1 from players
      where players.id = insights.player_id
        and players.user_id = auth.uid()
    )
  );

-- Service role bypasses RLS (used by API routes with SUPABASE_SERVICE_ROLE_KEY)
