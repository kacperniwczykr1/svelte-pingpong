create table if not exists public.sessions (
	id uuid primary key,
	code text not null unique,
	name text not null,
	created_at timestamptz not null default now()
);

create table if not exists public.players (
	id uuid primary key,
	session_id uuid not null references public.sessions(id) on delete cascade,
	name text not null,
	elo integer not null,
	wins integer not null default 0,
	losses integer not null default 0
);

create table if not exists public.matches (
	id uuid primary key,
	session_id uuid not null references public.sessions(id) on delete cascade,
	player_a_id uuid not null,
	player_b_id uuid not null,
	winner_id uuid not null,
	date text not null,
	score_a integer not null,
	score_b integer not null,
	elo_before_a integer not null,
	elo_before_b integer not null,
	elo_after_a integer not null,
	elo_after_b integer not null
);

create index if not exists players_session_id_idx on public.players(session_id);
create index if not exists matches_session_id_idx on public.matches(session_id);
create index if not exists matches_session_date_idx on public.matches(session_id, date desc);

alter table public.sessions enable row level security;
alter table public.players enable row level security;
alter table public.matches enable row level security;

drop policy if exists "public sessions access" on public.sessions;
create policy "public sessions access"
	on public.sessions
	for all
	using (true)
	with check (true);

drop policy if exists "public players access" on public.players;
create policy "public players access"
	on public.players
	for all
	using (true)
	with check (true);

drop policy if exists "public matches access" on public.matches;
create policy "public matches access"
	on public.matches
	for all
	using (true)
	with check (true);

alter publication supabase_realtime add table public.players;
alter publication supabase_realtime add table public.matches;
