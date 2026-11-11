use crate::errors::*;
use crate::events;
use crate::models::*;
use crate::validation::*;
use crate::{Fairly, FairlyExt};
use near_sdk::json_types::U128;
use near_sdk::serde_json::json;
use near_sdk::{assert_one_yocto, env, near, require, AccountId, Promise};

impl Program {
    pub fn is_boost_active(boost: &Boost, now_ns: u64) -> bool {
        if !boost.enabled {
            return false;
        }
        match boost.schedule {
            BoostSchedule::Range { starts_ns, ends_ns } => (starts_ns..ends_ns).contains(&now_ns),
            BoostSchedule::Weekly { weekday } => weekday_of(now_ns) == weekday,
        }
    }

    pub fn active_boost_ids(&self, now_ns: u64) -> Vec<u32> {
        self.boosts
            .iter()
            .filter(|boost| Self::is_boost_active(boost, now_ns))
            .map(|boost| boost.id)
            .collect()
    }

    pub fn effective_cashback_bps(&self, now_ns: u64) -> u16 {
        let boosted: u32 = self
            .boosts
            .iter()
            .filter(|boost| Self::is_boost_active(boost, now_ns))
            .map(|boost| u32::from(boost.extra_bps))
            .sum::<u32>()
            + u32::from(self.cashback_bps);
        boosted.min(u32::from(MAX_BPS)) as u16
    }

    pub fn location_mut(&mut self, location_id: &str) -> &mut Location {
        self.locations
            .iter_mut()
            .find(|location| location.id == location_id)
            .unwrap_or_else(|| env::panic_str(LOCATION_NOT_FOUND))
    }

    pub fn cashier_location(&self, account_id: &AccountId) -> Option<&str> {
        self.cashiers
            .iter()
            .find(|cashier| &cashier.account_id == account_id)
            .map(|cashier| cashier.location_id.as_str())
    }
}

pub fn weekday_of(timestamp_ns: u64) -> u8 {
    let days_since_epoch = timestamp_ns / NANOS_PER_DAY;
    ((days_since_epoch + 4) % 7) as u8
}

fn new_location(input: LocationInput) -> Location {
    validate_location(&input);
    Location {
        id: input.id,
        name: input.name,
        address: input.address,
        lat: input.lat,
        lng: input.lng,
        cashback_day: 0,
        cashback_today: U128(0),
    }
}

#[near]
impl Fairly {
    #[payable]
    pub fn create_program(&mut self, input: ProgramInput) -> Program {
        validate_slug(&input.slug);
        require!(!self.programs.contains_key(&input.slug), SLUG_TAKEN);
        validate_name(&input.name, 64);
        validate_mcc(input.mcc);
        validate_color(&input.brand_color);
        validate_cashback_bps(input.cashback_bps);
        validate_royalty_bps(input.royalty_bps);
        validate_expiry_days(input.expiry_days);
        validate_tiers(&input.tiers);
        require!(input.daily_cap.0 > 0, INVALID_AMOUNT);
        require!(input.locations.len() <= MAX_LOCATIONS, TOO_MANY_LOCATIONS);

        let initial_usage = env::storage_usage();
        let owner = env::predecessor_account_id();
        let locations: Vec<Location> = input.locations.into_iter().map(new_location).collect();
        let mut location_ids: Vec<&str> = locations.iter().map(|l| l.id.as_str()).collect();
        location_ids.sort_unstable();
        location_ids.dedup();
        require!(location_ids.len() == locations.len(), INVALID_LOCATION);

        let program = Program {
            slug: input.slug.clone(),
            owner: owner.clone(),
            name: input.name,
            mcc: input.mcc,
            brand_color: input.brand_color,
            logo_url: input.logo_url,
            cashback_bps: input.cashback_bps,
            royalty_bps: input.royalty_bps,
            expiry_days: input.expiry_days,
            expiry_seconds: None,
            daily_cap: input.daily_cap,
            tiers: input.tiers,
            locations,
            cashiers: Vec::new(),
            boosts: Vec::new(),
            next_boost_id: 1,
            pool_balance: U128(0),
            pending_total: U128(0),
            total_cashback: U128(0),
            storage_balance: near_sdk::NearToken::from_yoctonear(0),
            paused: false,
            pass_count: 0,
            created_ns: env::block_timestamp(),
        };
        self.save_program(program);
        let mut owned = self
            .programs_by_owner
            .get(&owner)
            .cloned()
            .unwrap_or_default();
        owned.push(input.slug.clone());
        self.programs_by_owner.insert(owner.clone(), owned);

        let cost = self.storage_cost_since(initial_usage);
        let attached = env::attached_deposit();
        require!(attached >= cost, INSUFFICIENT_DEPOSIT);
        let mut program = self.program(&input.slug);
        program.storage_balance = attached.saturating_sub(cost);
        self.save_program(program.clone());

        events::emit(
            "program_created",
            json!({ "slug": program.slug, "owner": owner, "name": program.name }),
        );
        program
    }

    pub fn update_program(&mut self, slug: String, update: ProgramUpdate) -> Program {
        let mut program = self.program(&slug);
        Self::assert_program_owner(&program);
        if let Some(name) = update.name {
            validate_name(&name, 64);
            program.name = name;
        }
        if let Some(color) = update.brand_color {
            validate_color(&color);
            program.brand_color = color;
        }
        if let Some(logo_url) = update.logo_url {
            program.logo_url = (!logo_url.is_empty()).then_some(logo_url);
        }
        if let Some(bps) = update.cashback_bps {
            validate_cashback_bps(bps);
            program.cashback_bps = bps;
        }
        if let Some(perks) = update.perks {
            require!(perks.len() == program.tiers.len(), INVALID_TIERS);
            for (tier, perk) in program.tiers.iter_mut().zip(perks) {
                validate_perk(perk.as_deref());
                tier.perk = perk;
            }
        }
        self.save_program(program.clone());
        events::emit("program_updated", json!({ "slug": slug }));
        program
    }

    pub fn set_paused(&mut self, slug: String, paused: bool) {
        let mut program = self.program(&slug);
        Self::assert_program_owner(&program);
        program.paused = paused;
        self.save_program(program);
        events::emit("program_paused", json!({ "slug": slug, "paused": paused }));
    }

    #[payable]
    pub fn deposit_storage(&mut self, slug: String) -> near_sdk::NearToken {
        let mut program = self.program(&slug);
        program.storage_balance = program
            .storage_balance
            .saturating_add(env::attached_deposit());
        let balance = program.storage_balance;
        self.save_program(program);
        balance
    }

    pub fn add_location(&mut self, slug: String, location: LocationInput) {
        let initial_usage = env::storage_usage();
        let mut program = self.program(&slug);
        Self::assert_program_owner(&program);
        require!(program.locations.len() < MAX_LOCATIONS, TOO_MANY_LOCATIONS);
        require!(
            program
                .locations
                .iter()
                .all(|existing| existing.id != location.id),
            INVALID_LOCATION
        );
        program.locations.push(new_location(location));
        self.save_program(program);
        self.charge_program_storage(&slug, initial_usage);
    }

    pub fn update_location(&mut self, slug: String, location: LocationInput) {
        validate_location(&location);
        let initial_usage = env::storage_usage();
        let mut program = self.program(&slug);
        Self::assert_program_owner(&program);
        let existing = program.location_mut(&location.id);
        existing.name = location.name;
        existing.address = location.address;
        existing.lat = location.lat;
        existing.lng = location.lng;
        self.save_program(program);
        self.charge_program_storage(&slug, initial_usage);
    }

    pub fn remove_location(&mut self, slug: String, location_id: String) {
        let mut program = self.program(&slug);
        Self::assert_program_owner(&program);
        require!(
            program
                .cashiers
                .iter()
                .all(|cashier| cashier.location_id != location_id),
            LOCATION_IN_USE
        );
        let before = program.locations.len();
        program
            .locations
            .retain(|location| location.id != location_id);
        require!(program.locations.len() < before, LOCATION_NOT_FOUND);
        self.save_program(program);
    }

    pub fn add_cashier(&mut self, slug: String, account_id: AccountId, location_id: String) {
        let initial_usage = env::storage_usage();
        let mut program = self.program(&slug);
        Self::assert_program_owner(&program);
        program.location_mut(&location_id);
        program
            .cashiers
            .retain(|cashier| cashier.account_id != account_id);
        require!(program.cashiers.len() < MAX_CASHIERS, TOO_MANY_CASHIERS);
        program.cashiers.push(Cashier {
            account_id: account_id.clone(),
            location_id: location_id.clone(),
        });
        self.save_program(program);
        self.charge_program_storage(&slug, initial_usage);
        events::emit(
            "cashier_added",
            json!({ "slug": slug, "account_id": account_id, "location_id": location_id }),
        );
    }

    pub fn remove_cashier(&mut self, slug: String, account_id: AccountId) {
        let mut program = self.program(&slug);
        Self::assert_program_owner(&program);
        program
            .cashiers
            .retain(|cashier| cashier.account_id != account_id);
        self.save_program(program);
        events::emit(
            "cashier_removed",
            json!({ "slug": slug, "account_id": account_id }),
        );
    }

    pub fn add_boost(&mut self, slug: String, boost: BoostInput) -> u32 {
        validate_boost(&boost);
        let initial_usage = env::storage_usage();
        let mut program = self.program(&slug);
        Self::assert_program_owner(&program);
        require!(program.boosts.len() < MAX_BOOSTS, TOO_MANY_BOOSTS);
        let id = program.next_boost_id;
        program.next_boost_id += 1;
        program.boosts.push(Boost {
            id,
            name: boost.name,
            extra_bps: boost.extra_bps,
            schedule: boost.schedule,
            enabled: true,
        });
        self.save_program(program);
        self.charge_program_storage(&slug, initial_usage);
        events::emit("boost_added", json!({ "slug": slug, "boost_id": id }));
        id
    }

    pub fn set_boost_enabled(&mut self, slug: String, boost_id: u32, enabled: bool) {
        let mut program = self.program(&slug);
        Self::assert_program_owner(&program);
        let boost = program
            .boosts
            .iter_mut()
            .find(|boost| boost.id == boost_id)
            .unwrap_or_else(|| env::panic_str(INVALID_BOOST));
        boost.enabled = enabled;
        self.save_program(program);
    }

    pub fn remove_boost(&mut self, slug: String, boost_id: u32) {
        let mut program = self.program(&slug);
        Self::assert_program_owner(&program);
        let before = program.boosts.len();
        program.boosts.retain(|boost| boost.id != boost_id);
        require!(program.boosts.len() < before, INVALID_BOOST);
        self.save_program(program);
    }

    #[payable]
    pub fn withdraw_pool(&mut self, slug: String, amount: U128) -> Promise {
        assert_one_yocto();
        let mut program = self.program(&slug);
        Self::assert_program_owner(&program);
        require!(amount.0 > 0, INVALID_AMOUNT);
        require!(amount.0 <= program.pool_balance.0, INSUFFICIENT_POOL);
        program.pool_balance = U128(program.pool_balance.0 - amount.0);
        let owner = program.owner.clone();
        self.save_program(program);
        events::emit("pool_withdrawn", json!({ "slug": slug, "amount": amount }));
        self.pay_tusdc(owner, amount.0, PayoutSource::Pool { slug })
    }
}

impl Fairly {
    pub(crate) fn fund_pool(&mut self, slug: &str, sender: &AccountId, amount: u128) -> bool {
        let Some(program) = self.programs.get(slug).cloned() else {
            return false;
        };
        let mut program = program;
        program.pool_balance = U128(program.pool_balance.0 + amount);
        self.save_program(program);
        events::emit(
            "pool_funded",
            json!({ "slug": slug, "from": sender, "amount": U128(amount) }),
        );
        self.settle_pending_internal(slug, 20);
        true
    }
}
