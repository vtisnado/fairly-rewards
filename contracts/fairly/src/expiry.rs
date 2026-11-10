use crate::errors::*;
use crate::events;
use crate::models::*;
use crate::{Fairly, FairlyExt};
use near_contract_standards::non_fungible_token::TokenId;
use near_sdk::json_types::U128;
use near_sdk::serde_json::json;
use near_sdk::{env, near, require};

impl Fairly {
    pub(crate) fn expires_at_ns(pass: &Pass, program: &Program) -> Option<u64> {
        program
            .expiry_period_ns()
            .map(|period| pass.last_activity_ns.saturating_add(period))
    }
}

#[near]
impl Fairly {
    pub fn sweep_expired(&mut self, token_id: TokenId) -> U128 {
        let mut pass = self.pass(&token_id);
        let mut program = self.program(&pass.program_slug);
        let expires_at =
            Self::expires_at_ns(&pass, &program).unwrap_or_else(|| env::panic_str(NOT_EXPIRED));
        require!(env::block_timestamp() > expires_at, NOT_EXPIRED);

        let returned = pass.balance.0;
        let forfeited_pending = pass.pending.0;
        program.pool_balance = U128(program.pool_balance.0 + returned);
        program.pending_total = U128(program.pending_total.0.saturating_sub(forfeited_pending));
        pass.balance = U128(0);
        pass.pending = U128(0);

        if forfeited_pending > 0 {
            if let Some(queue) = self.pending_queues.get_mut(&program.slug) {
                queue.retain(|queued| queued != &token_id);
            }
        }
        let slug = program.slug.clone();
        self.save_pass(pass);
        self.save_program(program);

        events::emit(
            "expired",
            json!({
                "slug": slug,
                "token_id": token_id,
                "returned": U128(returned),
                "forfeited_pending": U128(forfeited_pending),
            }),
        );
        U128(returned)
    }

    #[cfg(feature = "demo")]
    pub fn set_expiry_seconds(&mut self, slug: String, seconds: Option<u64>) {
        let mut program = self.program(&slug);
        Self::assert_program_owner(&program);
        program.expiry_seconds = seconds;
        self.save_program(program);
    }
}
