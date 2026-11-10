use crate::errors::*;
use crate::events;
use crate::models::*;
use crate::{Fairly, FairlyExt};
use near_contract_standards::fungible_token::core::ext_ft_core;
use near_sdk::json_types::U128;
use near_sdk::serde_json::json;
use near_sdk::{
    assert_one_yocto, env, near, require, AccountId, Gas, NearToken, Promise, PromiseError,
};

const GAS_FOR_FT_TRANSFER: Gas = Gas::from_tgas(10);
const GAS_FOR_RESOLVE_PAYOUT: Gas = Gas::from_tgas(10);

#[near]
impl Fairly {
    #[private]
    pub fn resolve_payout(
        &mut self,
        receiver_id: AccountId,
        amount: U128,
        source: PayoutSource,
        #[callback_result] result: Result<(), PromiseError>,
    ) -> bool {
        if result.is_ok() {
            return true;
        }
        match &source {
            PayoutSource::PassBalance { token_id } => {
                if let Some(mut pass) = self.passes.get(token_id).cloned() {
                    pass.balance = U128(pass.balance.0 + amount.0);
                    self.save_pass(pass);
                } else {
                    self.credit_refund(&receiver_id, amount.0);
                }
            }
            PayoutSource::Pool { slug } => {
                if let Some(mut program) = self.programs.get(slug).cloned() {
                    program.pool_balance = U128(program.pool_balance.0 + amount.0);
                    self.save_program(program);
                } else {
                    self.credit_refund(&receiver_id, amount.0);
                }
            }
            PayoutSource::Refund => self.credit_refund(&receiver_id, amount.0),
        }
        events::emit(
            "payout_failed",
            json!({ "receiver_id": receiver_id, "amount": amount, "source": source }),
        );
        false
    }

    #[payable]
    pub fn withdraw_refund(&mut self) -> Promise {
        assert_one_yocto();
        let account_id = env::predecessor_account_id();
        let amount = self
            .refunds
            .remove(&account_id)
            .map(|amount| amount.0)
            .unwrap_or_default();
        require!(amount > 0, NO_REFUND);
        self.pay_tusdc(account_id, amount, PayoutSource::Refund)
    }

    pub fn get_refund(&self, account_id: AccountId) -> U128 {
        self.refunds.get(&account_id).copied().unwrap_or(U128(0))
    }
}

impl Fairly {
    pub(crate) fn pay_tusdc(
        &self,
        receiver_id: AccountId,
        amount: u128,
        source: PayoutSource,
    ) -> Promise {
        ext_ft_core::ext(self.tusdc.clone())
            .with_attached_deposit(NearToken::from_yoctonear(1))
            .with_static_gas(GAS_FOR_FT_TRANSFER)
            .ft_transfer(receiver_id.clone(), U128(amount), None)
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(GAS_FOR_RESOLVE_PAYOUT)
                    .resolve_payout(receiver_id, U128(amount), source),
            )
    }

    fn credit_refund(&mut self, account_id: &AccountId, amount: u128) {
        let current = self
            .refunds
            .get(account_id)
            .map(|a| a.0)
            .unwrap_or_default();
        self.refunds
            .insert(account_id.clone(), U128(current + amount));
    }
}
