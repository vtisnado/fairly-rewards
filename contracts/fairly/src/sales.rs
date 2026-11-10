use crate::errors::*;
use crate::events;
use crate::models::*;
use crate::{Fairly, FairlyExt};
use near_contract_standards::fungible_token::receiver::FungibleTokenReceiver;
use near_contract_standards::non_fungible_token::events::NftTransfer;
use near_contract_standards::non_fungible_token::TokenId;
use near_sdk::json_types::U128;
use near_sdk::serde::Deserialize;
use near_sdk::serde_json::{self, json};
use near_sdk::{env, near, require, AccountId, PromiseOrValue};

#[derive(Deserialize)]
#[serde(crate = "near_sdk::serde", rename_all = "snake_case")]
enum TransferMessage {
    Fund(String),
    Buy(TokenId),
}

pub fn royalty_for(price: u128, royalty_bps: u16) -> u128 {
    price * u128::from(royalty_bps) / 10_000
}

#[near]
impl Fairly {
    pub fn list_pass(&mut self, token_id: TokenId, price: U128) {
        let seller = self.assert_pass_owner(&token_id);
        require!(price.0 > 0, INVALID_PRICE);
        let initial_usage = env::storage_usage();
        let slug = self.pass(&token_id).program_slug;
        self.listings.insert(
            token_id.clone(),
            Listing {
                seller: seller.clone(),
                price,
                listed_ns: env::block_timestamp(),
            },
        );
        self.charge_program_storage(&slug, initial_usage);
        events::emit(
            "listed",
            json!({ "slug": slug, "token_id": token_id, "seller": seller, "price": price }),
        );
    }

    pub fn cancel_listing(&mut self, token_id: TokenId) {
        let listing = self
            .listings
            .get(&token_id)
            .cloned()
            .unwrap_or_else(|| env::panic_str(NOT_LISTED));
        let caller = env::predecessor_account_id();
        let is_stale = self.active_listing(&token_id).is_none();
        require!(caller == listing.seller || is_stale, NOT_PASS_OWNER);
        self.listings.remove(&token_id);
        events::emit("listing_cancelled", json!({ "token_id": token_id }));
    }
}

#[near]
impl FungibleTokenReceiver for Fairly {
    fn ft_on_transfer(
        &mut self,
        sender_id: AccountId,
        amount: U128,
        msg: String,
    ) -> PromiseOrValue<U128> {
        if env::predecessor_account_id() != self.tusdc {
            return PromiseOrValue::Value(amount);
        }
        let accepted = match serde_json::from_str::<TransferMessage>(&msg) {
            Ok(TransferMessage::Fund(slug)) => self.fund_pool(&slug, &sender_id, amount.0),
            Ok(TransferMessage::Buy(token_id)) => self.buy_pass(&token_id, &sender_id, amount.0),
            Err(_) => false,
        };
        PromiseOrValue::Value(if accepted { U128(0) } else { amount })
    }
}

impl Fairly {
    fn buy_pass(&mut self, token_id: &TokenId, buyer: &AccountId, amount: u128) -> bool {
        let Some(listing) = self.active_listing(token_id) else {
            return false;
        };
        let Some(pass) = self.passes.get(token_id).cloned() else {
            return false;
        };
        let Some(program) = self.programs.get(&pass.program_slug).cloned() else {
            return false;
        };
        if amount != listing.price.0
            || buyer == &listing.seller
            || self.pass_of_owner(&program.slug, buyer).is_some()
        {
            return false;
        }

        let initial_usage = env::storage_usage();
        let seller = listing.seller.clone();
        self.listings.remove(token_id);
        self.tokens
            .internal_transfer_unguarded(token_id, &seller, buyer);
        NftTransfer {
            old_owner_id: &seller,
            new_owner_id: buyer,
            token_ids: &[token_id],
            authorized_id: None,
            memo: Some("fairly sale"),
        }
        .emit();
        let storage_cost = self.storage_cost_since(initial_usage);
        if program.storage_balance < storage_cost {
            env::panic_str(NO_STORAGE);
        }
        let mut program = program;
        program.storage_balance = program.storage_balance.saturating_sub(storage_cost);
        self.save_program(program.clone());

        let royalty = royalty_for(amount, program.royalty_bps);
        let seller_amount = amount - royalty;
        if royalty > 0 {
            let _ = self.pay_tusdc(program.owner.clone(), royalty, PayoutSource::Refund);
        }
        if seller_amount > 0 {
            let _ = self.pay_tusdc(seller.clone(), seller_amount, PayoutSource::Refund);
        }

        events::emit(
            "sale",
            json!({
                "slug": program.slug,
                "token_id": token_id,
                "seller": seller,
                "buyer": buyer,
                "price": U128(amount),
                "royalty": U128(royalty),
                "merchant": program.owner,
                "balance": pass.balance,
            }),
        );
        true
    }
}
