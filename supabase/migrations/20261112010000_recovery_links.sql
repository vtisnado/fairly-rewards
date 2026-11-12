create table public.recovery_links (
  public_key text not null,
  kind text not null check (kind in ('customer', 'merchant')),
  account_id text not null,
  created_at timestamptz not null default now(),
  primary key (public_key, kind)
);

alter table public.recovery_links enable row level security;
