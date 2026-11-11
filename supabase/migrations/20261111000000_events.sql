create table public.events (
  id bigint generated always as identity primary key,
  tx_hash text not null,
  block_height bigint,
  log_index integer not null,
  event text not null,
  program_slug text,
  token_id text,
  account_id text,
  data jsonb not null,
  created_at timestamptz not null default now(),
  unique (tx_hash, log_index)
);

create index events_token_id_created_at_idx on public.events (token_id, created_at desc);
create index events_program_slug_created_at_idx on public.events (program_slug, created_at desc);
create index events_event_idx on public.events (event);

alter table public.events enable row level security;

create policy "Events are public on-chain data"
  on public.events
  for select
  to anon, authenticated
  using (true);

alter publication supabase_realtime add table public.events;
