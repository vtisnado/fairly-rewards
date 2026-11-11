export type U128 = string;

export interface Tier {
  name: string;
  min_purchases: number;
  perk: string | null;
}

export interface Location {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  cashback_day: number;
  cashback_today: U128;
}

export interface Cashier {
  account_id: string;
  location_id: string;
}

export type BoostSchedule =
  | { kind: 'range'; starts_ns: number; ends_ns: number }
  | { kind: 'weekly'; weekday: number };

export interface Boost {
  id: number;
  name: string;
  extra_bps: number;
  schedule: BoostSchedule;
  enabled: boolean;
}

export interface ProgramView {
  slug: string;
  owner: string;
  name: string;
  brand_color: string;
  logo_url: string | null;
  cashback_bps: number;
  royalty_bps: number;
  expiry_days: number | null;
  expiry_seconds: number | null;
  daily_cap: U128;
  tiers: Tier[];
  locations: Location[];
  cashiers: Cashier[];
  boosts: Boost[];
  pool_balance: U128;
  pending_total: U128;
  total_cashback: U128;
  storage_balance: U128;
  paused: boolean;
  pass_count: number;
  created_ns: number;
  active_boost_ids: number[];
  effective_cashback_bps: number;
}

export interface PassView {
  token_id: string;
  program_slug: string;
  balance: U128;
  pending: U128;
  purchase_count: number;
  total_spent_cents: number;
  tier_index: number;
  claimed_perks: number;
  redemption_count: number;
  last_activity_ns: number;
  created_ns: number;
  owner: string;
  program_name: string;
  brand_color: string;
  tier_name: string;
  next_tier: string | null;
  purchases_to_next_tier: number | null;
  expires_at_ns: number | null;
  listing_price: U128 | null;
}

export interface ListingView {
  token_id: string;
  program_slug: string;
  program_name: string;
  seller: string;
  price: U128;
  balance: U128;
  tier_index: number;
  tier_name: string;
  purchase_count: number;
}
