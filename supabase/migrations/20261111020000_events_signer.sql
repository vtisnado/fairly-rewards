alter table public.events add column signer_id text;

create index events_signer_id_created_at_idx on public.events (signer_id, created_at desc);
