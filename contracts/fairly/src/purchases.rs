use crate::errors::*;
use crate::events;
use crate::models::*;
use crate::validation::validate_category;
use crate::{Fairly, FairlyExt, Role};
use near_contract_standards::non_fungible_token::TokenId;
use near_sdk::json_types::U128;
use near_sdk::serde_json::json;
use near_sdk::{env, near, require};

pub fn cashback_for(amount_cents: u64, bps: u16) -> u128 {
    u128::from(amount_cents) * u128::from(bps)
}

#[near]
impl Fairly {
    pub fn record_purchase(
        &mut self,
        token_id: TokenId,
        amount_cents: u64,
        location_id: String,
        category: Option<String>,
    ) -> PurchaseResult {
        let initial_usage = env::storage_usage();
        let mut pass = self.pass(&token_id);
        let slug = pass.program_slug.clone();
        let mut program = self.program(&slug);
        require!(!program.paused, PAUSED);
        let caller = env::predecessor_account_id();
        if Self::assert_staff(&program) == Role::Cashier {
            let assigned = program.cashier_location(&caller).unwrap_or_default();
            require!(assigned == location_id, LOCATION_MISMATCH);
        }
        require!(
            (1..=MAX_PURCHASE_CENTS).contains(&amount_cents),
            INVALID_AMOUNT
        );
        validate_category(category.as_deref());

        let now = env::block_timestamp();
        let bps = program.effective_cashback_bps(now);
        let cashback = cashback_for(amount_cents, bps);
        let daily_cap = program.daily_cap.0;
        let today = program.local_day(now);
        let location = program.location_mut(&location_id);
        if location.cashback_day != today {
            location.cashback_day = today;
            location.cashback_today = U128(0);
        }
        let issued_today = location.cashback_today.0 + cashback;
        require!(issued_today <= daily_cap, DAILY_CAP);
        location.cashback_today = U128(issued_today);

        let credited = cashback.min(program.pool_balance.0);
        let pending = cashback - credited;
        program.pool_balance = U128(program.pool_balance.0 - credited);
        program.pending_total = U128(program.pending_total.0 + pending);
        program.total_cashback = U128(program.total_cashback.0 + cashback);

        if pending > 0 && pass.pending.0 == 0 {
            let mut queue = self.pending_queues.get(&slug).cloned().unwrap_or_default();
            queue.push(token_id.clone());
            self.pending_queues.insert(slug.clone(), queue);
        }
        pass.balance = U128(pass.balance.0 + credited);
        pass.pending = U128(pass.pending.0 + pending);
        pass.purchase_count += 1;
        pass.total_spent_cents += amount_cents;
        pass.last_activity_ns = now;

        let previous_tier = pass.tier_index;
        pass.tier_index = program.tier_for(pass.purchase_count).max(previous_tier);
        let tier_up = pass.tier_index > previous_tier;

        let result = PurchaseResult {
            token_id: token_id.clone(),
            cashback: U128(cashback),
            credited: U128(credited),
            pending: U128(pending),
            balance: pass.balance,
            tier_index: pass.tier_index,
            tier_up,
        };
        let tier_name = program.tiers[usize::from(pass.tier_index)].name.clone();
        self.save_pass(pass.clone());
        self.save_program(program);
        self.charge_program_storage(&slug, initial_usage);

        events::emit(
            "purchase",
            json!({
                "slug": slug,
                "token_id": token_id,
                "amount_cents": amount_cents,
                "cashback_bps": bps,
                "cashback": U128(cashback),
                "credited": U128(credited),
                "pending": U128(pending),
                "balance": pass.balance,
                "location_id": location_id,
                "category": category,
                "cashier": caller,
            }),
        );
        if tier_up {
            events::emit(
                "tier_up",
                json!({
                    "slug": slug,
                    "token_id": token_id,
                    "tier_index": pass.tier_index,
                    "tier_name": tier_name,
                }),
            );
        }
        result
    }

    pub fn settle_pending(&mut self, slug: String, limit: Option<u32>) -> U128 {
        U128(self.settle_pending_internal(&slug, limit.unwrap_or(20).min(50)))
    }
}

impl Fairly {
    pub(crate) fn settle_pending_internal(&mut self, slug: &str, limit: u32) -> u128 {
        let mut program = self.program(slug);
        let mut queue = self.pending_queues.get(slug).cloned().unwrap_or_default();
        let mut settled_total = 0u128;
        let mut processed = 0u32;

        while processed < limit && program.pool_balance.0 > 0 && !queue.is_empty() {
            let token_id = queue[0].clone();
            processed += 1;
            let Some(mut pass) = self.passes.get(&token_id).cloned() else {
                queue.remove(0);
                continue;
            };
            let settled = pass.pending.0.min(program.pool_balance.0);
            pass.pending = U128(pass.pending.0 - settled);
            pass.balance = U128(pass.balance.0 + settled);
            program.pool_balance = U128(program.pool_balance.0 - settled);
            program.pending_total = U128(program.pending_total.0.saturating_sub(settled));
            settled_total += settled;
            if pass.pending.0 == 0 {
                queue.remove(0);
            }
            events::emit(
                "pending_settled",
                json!({
                    "slug": slug,
                    "token_id": token_id,
                    "amount": U128(settled),
                    "balance": pass.balance,
                    "pending": pass.pending,
                }),
            );
            self.save_pass(pass);
        }

        if queue.is_empty() {
            self.pending_queues.remove(slug);
        } else {
            self.pending_queues.insert(slug.to_string(), queue);
        }
        self.save_program(program);
        settled_total
    }
}
