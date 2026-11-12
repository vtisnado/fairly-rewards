create table public.pairing_requests (
  code text primary key,
  program_slug text not null,
  account_id text not null,
  kind text not null check (kind in ('device', 'manager')),
  created_at timestamptz not null default now()
);

create index pairing_requests_created_at_idx on public.pairing_requests (created_at);

alter table public.pairing_requests enable row level security;
