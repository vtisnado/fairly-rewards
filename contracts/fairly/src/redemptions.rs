use crate::errors::*;
use crate::events;
use crate::models::*;
use crate::{Fairly, FairlyExt};
use near_contract_standards::non_fungible_token::TokenId;
use near_sdk::json_types::U128;
use near_sdk::serde_json::json;
use near_sdk::{assert_one_yocto, env, near, require};

#[near]
impl Fairly {
    #[payable]
    pub fn redeem(&mut self, token_id: TokenId, amount: U128) -> String {
        assert_one_yocto();
        let owner = self.assert_pass_owner(&token_id);
        require!(self.active_listing(&token_id).is_none(), LISTED);
        let mut pass = self.pass(&token_id);
        require!(amount.0 > 0, INVALID_AMOUNT);
        require!(amount.0 <= pass.balance.0, INSUFFICIENT_BALANCE);
        let program = self.program(&pass.program_slug);

        pass.balance = U128(pass.balance.0 - amount.0);
        pass.redemption_count += 1;
        pass.last_activity_ns = env::block_timestamp();
        let code = format!("{token_id}#{}", pass.redemption_count);
        let balance = pass.balance;
        self.save_pass(pass);

        events::emit(
            "redeem",
            json!({
                "slug": program.slug,
                "token_id": token_id,
                "owner": owner,
                "amount": amount,
                "balance": balance,
                "code": code,
            }),
        );
        let _ = self.pay_tusdc(
            program.owner,
            amount.0,
            PayoutSource::PassBalance { token_id },
        );
        code
    }
}
