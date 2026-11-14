use near_contract_standards::non_fungible_token::TokenId;
use near_sdk::json_types::U128;
use near_sdk::{near, AccountId, NearToken};

pub const MAX_BPS: u16 = 2_500;
pub const MAX_BOOST_BPS: u16 = 1_500;
pub const MAX_BOOSTS: usize = 10;
pub const MAX_CASHIERS: usize = 20;
pub const MAX_LOCATIONS: usize = 20;
pub const MAX_MANAGERS: usize = 10;
pub const MIN_UTC_OFFSET_MINUTES: i16 = -720;
pub const MAX_UTC_OFFSET_MINUTES: i16 = 840;
pub const MAX_TIERS: usize = 5;
pub const MAX_ART_BASE_URL_LEN: usize = 200;
pub const MAX_PURCHASE_CENTS: u64 = 100_000;
pub const MAX_EXPIRY_DAYS: u32 = 365;
pub const NANOS_PER_SECOND: u64 = 1_000_000_000;
pub const NANOS_PER_DAY: u64 = 86_400 * NANOS_PER_SECOND;

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq)]
pub struct Tier {
    pub name: String,
    pub min_purchases: u32,
    pub perk: Option<String>,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq)]
pub struct Location {
    pub id: String,
    pub name: String,
    pub address: String,
    pub lat: f64,
    pub lng: f64,
    pub cashback_day: u64,
    pub cashback_today: U128,
}

#[near(serializers = [json])]
#[derive(Clone, Debug)]
pub struct LocationInput {
    pub id: String,
    pub name: String,
    pub address: String,
    pub lat: f64,
    pub lng: f64,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq)]
pub struct Cashier {
    pub account_id: AccountId,
    pub location_id: String,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq)]
pub struct Manager {
    pub account_id: AccountId,
    pub location_id: Option<String>,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum BoostSchedule {
    Range { starts_ns: u64, ends_ns: u64 },
    Weekly { weekday: u8 },
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq)]
pub struct Boost {
    pub id: u32,
    pub name: String,
    pub extra_bps: u16,
    pub schedule: BoostSchedule,
    pub enabled: bool,
}

#[near(serializers = [json])]
#[derive(Clone, Debug)]
pub struct BoostInput {
    pub name: String,
    pub extra_bps: u16,
    pub schedule: BoostSchedule,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Program {
    pub slug: String,
    pub owner: AccountId,
    pub name: String,
    pub mcc: u16,
    pub brand_color: String,
    pub logo_url: Option<String>,
    pub cashback_bps: u16,
    pub royalty_bps: u16,
    pub expiry_days: Option<u32>,
    pub expiry_seconds: Option<u64>,
    pub daily_cap: U128,
    pub tiers: Vec<Tier>,
    pub locations: Vec<Location>,
    pub cashiers: Vec<Cashier>,
    pub managers: Vec<Manager>,
    pub boosts: Vec<Boost>,
    pub next_boost_id: u32,
    pub utc_offset_minutes: i16,
    pub pool_balance: U128,
    pub pending_total: U128,
    pub total_cashback: U128,
    pub storage_balance: NearToken,
    pub paused: bool,
    pub pass_count: u64,
    pub created_ns: u64,
}

#[near(serializers = [json])]
#[derive(Clone, Debug)]
pub struct ProgramInput {
    pub slug: String,
    pub name: String,
    pub mcc: u16,
    pub utc_offset_minutes: i16,
    pub brand_color: String,
    pub logo_url: Option<String>,
    pub cashback_bps: u16,
    pub royalty_bps: u16,
    pub expiry_days: Option<u32>,
    pub daily_cap: U128,
    pub tiers: Vec<Tier>,
    pub locations: Vec<LocationInput>,
}

#[near(serializers = [json])]
#[derive(Clone, Debug, Default)]
pub struct ProgramUpdate {
    pub name: Option<String>,
    pub brand_color: Option<String>,
    pub logo_url: Option<String>,
    pub cashback_bps: Option<u16>,
    pub perks: Option<Vec<Option<String>>>,
    pub utc_offset_minutes: Option<i16>,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Pass {
    pub token_id: TokenId,
    pub program_slug: String,
    pub balance: U128,
    pub pending: U128,
    pub purchase_count: u32,
    pub total_spent_cents: u64,
    pub tier_index: u8,
    pub claimed_perks: u8,
    pub redemption_count: u32,
    pub last_activity_ns: u64,
    pub created_ns: u64,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Listing {
    pub seller: AccountId,
    pub price: U128,
    pub listed_ns: u64,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub enum PayoutSource {
    Refund,
    PassBalance { token_id: TokenId },
    Pool { slug: String },
}

#[near(serializers = [json])]
#[derive(Clone, Debug)]
pub struct ProgramView {
    #[serde(flatten)]
    pub program: Program,
    pub active_boost_ids: Vec<u32>,
    pub effective_cashback_bps: u16,
}

#[near(serializers = [json])]
#[derive(Clone, Debug)]
pub struct PassView {
    #[serde(flatten)]
    pub pass: Pass,
    pub owner: AccountId,
    pub program_name: String,
    pub brand_color: String,
    pub tier_name: String,
    pub next_tier: Option<String>,
    pub purchases_to_next_tier: Option<u32>,
    pub expires_at_ns: Option<u64>,
    pub listing_price: Option<U128>,
}

#[near(serializers = [json])]
#[derive(Clone, Debug)]
pub struct ListingView {
    pub token_id: TokenId,
    pub program_slug: String,
    pub program_name: String,
    pub seller: AccountId,
    pub price: U128,
    pub balance: U128,
    pub tier_index: u8,
    pub tier_name: String,
    pub purchase_count: u32,
}

#[near(serializers = [json])]
#[derive(Clone, Debug)]
pub struct PurchaseResult {
    pub token_id: TokenId,
    pub cashback: U128,
    pub credited: U128,
    pub pending: U128,
    pub balance: U128,
    pub tier_index: u8,
    pub tier_up: bool,
}
