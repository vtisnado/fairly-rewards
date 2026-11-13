alter table public.pairing_requests drop constraint pairing_requests_kind_check;
alter table public.pairing_requests
  add constraint pairing_requests_kind_check check (kind in ('device', 'manager', 'shortcut'));
alter table public.pairing_requests add column connected_account_id text;
