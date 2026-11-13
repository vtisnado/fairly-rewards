create table public.customer_codes (
  token_hash text primary key,
  code text not null,
  account_id text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index customer_codes_active_code_idx on public.customer_codes (code) where used_at is null;
create index customer_codes_account_idx on public.customer_codes (account_id);
create index customer_codes_expires_idx on public.customer_codes (expires_at);

alter table public.customer_codes enable row level security;
