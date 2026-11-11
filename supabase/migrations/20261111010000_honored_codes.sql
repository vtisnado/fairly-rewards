create table public.honored_codes (
  code text primary key,
  program_slug text not null,
  token_id text not null,
  kind text not null check (kind in ('redeem', 'perk')),
  amount text,
  perk text,
  honored_by text not null,
  honored_at timestamptz not null default now()
);

create index honored_codes_program_slug_idx on public.honored_codes (program_slug, honored_at desc);

alter table public.honored_codes enable row level security;

create policy "Honored codes are public"
  on public.honored_codes
  for select
  to anon, authenticated
  using (true);

alter publication supabase_realtime add table public.honored_codes;
