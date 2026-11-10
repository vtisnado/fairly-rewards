use crate::{Fairly, FairlyExt};
use near_contract_standards::non_fungible_token::core::{
    NonFungibleTokenCore, NonFungibleTokenResolver,
};
use near_contract_standards::non_fungible_token::enumeration::NonFungibleTokenEnumeration;
use near_contract_standards::non_fungible_token::metadata::{
    NFTContractMetadata, NonFungibleTokenMetadataProvider, NFT_METADATA_SPEC,
};
use near_contract_standards::non_fungible_token::{Token, TokenId};
use near_sdk::json_types::U128;
use near_sdk::{assert_one_yocto, env, near, require, AccountId, PromiseOrValue};
use std::collections::HashMap;

#[near(serializers = [json])]
pub struct Payout {
    pub payout: HashMap<AccountId, U128>,
}

impl Fairly {
    fn before_transfer(&mut self, token_id: &TokenId, receiver_id: &AccountId) -> u64 {
        let slug = self.pass(token_id).program_slug;
        self.assert_no_pass_in_program(&slug, receiver_id);
        self.listings.remove(token_id);
        env::storage_usage()
    }

    fn after_transfer(&mut self, token_id: &TokenId, initial_usage: u64) {
        let slug = self.pass(token_id).program_slug;
        self.charge_program_storage(&slug, initial_usage);
    }

    fn payout_for(&self, token_id: &TokenId, owner: AccountId, balance: u128) -> Payout {
        let pass = self.pass(token_id);
        let program = self.program(&pass.program_slug);
        let royalty = crate::sales::royalty_for(balance, program.royalty_bps);
        let mut payout = HashMap::new();
        if royalty > 0 {
            payout.insert(program.owner.clone(), U128(royalty));
        }
        let owner_share = payout.get(&owner).map(|a| a.0).unwrap_or_default() + balance - royalty;
        payout.insert(owner, U128(owner_share));
        Payout { payout }
    }

    fn tokens_page(
        &self,
        ids: impl Iterator<Item = TokenId>,
        from_index: Option<U128>,
        limit: Option<u64>,
    ) -> Vec<Token> {
        let start = from_index.map(|i| i.0 as usize).unwrap_or(0);
        let limit = limit.map(|l| l as usize).unwrap_or(50).min(100);
        ids.skip(start)
            .take(limit)
            .filter_map(|token_id| self.token_view(&token_id))
            .collect()
    }
}

#[near]
impl NonFungibleTokenCore for Fairly {
    #[payable]
    fn nft_transfer(
        &mut self,
        receiver_id: AccountId,
        token_id: TokenId,
        approval_id: Option<u64>,
        memo: Option<String>,
    ) {
        let initial_usage = self.before_transfer(&token_id, &receiver_id);
        self.tokens
            .nft_transfer(receiver_id, token_id.clone(), approval_id, memo);
        self.after_transfer(&token_id, initial_usage);
    }

    #[payable]
    fn nft_transfer_call(
        &mut self,
        receiver_id: AccountId,
        token_id: TokenId,
        approval_id: Option<u64>,
        memo: Option<String>,
        msg: String,
    ) -> PromiseOrValue<bool> {
        let initial_usage = self.before_transfer(&token_id, &receiver_id);
        let result =
            self.tokens
                .nft_transfer_call(receiver_id, token_id.clone(), approval_id, memo, msg);
        self.after_transfer(&token_id, initial_usage);
        result
    }

    fn nft_token(&self, token_id: TokenId) -> Option<Token> {
        self.token_view(&token_id)
    }
}

#[near]
impl NonFungibleTokenResolver for Fairly {
    #[private]
    fn nft_resolve_transfer(
        &mut self,
        previous_owner_id: AccountId,
        receiver_id: AccountId,
        token_id: TokenId,
        approved_account_ids: Option<HashMap<AccountId, u64>>,
    ) -> bool {
        self.tokens.nft_resolve_transfer(
            previous_owner_id,
            receiver_id,
            token_id,
            approved_account_ids,
        )
    }
}

#[near]
impl NonFungibleTokenEnumeration for Fairly {
    fn nft_total_supply(&self) -> U128 {
        U128(u128::from(self.tokens.owner_by_id.len()))
    }

    fn nft_tokens(&self, from_index: Option<U128>, limit: Option<u64>) -> Vec<Token> {
        self.tokens_page(
            self.tokens.owner_by_id.iter().map(|(token_id, _)| token_id),
            from_index,
            limit,
        )
    }

    fn nft_supply_for_owner(&self, account_id: AccountId) -> U128 {
        let count = self
            .tokens
            .tokens_per_owner
            .as_ref()
            .and_then(|by_owner| by_owner.get(&account_id))
            .map(|tokens| tokens.len())
            .unwrap_or(0);
        U128(u128::from(count))
    }

    fn nft_tokens_for_owner(
        &self,
        account_id: AccountId,
        from_index: Option<U128>,
        limit: Option<u64>,
    ) -> Vec<Token> {
        let ids: Vec<TokenId> = self
            .tokens
            .tokens_per_owner
            .as_ref()
            .and_then(|by_owner| by_owner.get(&account_id))
            .map(|tokens| tokens.to_vec())
            .unwrap_or_default();
        self.tokens_page(ids.into_iter(), from_index, limit)
    }
}

#[near]
impl NonFungibleTokenMetadataProvider for Fairly {
    fn nft_metadata(&self) -> NFTContractMetadata {
        NFTContractMetadata {
            spec: NFT_METADATA_SPEC.to_string(),
            name: "Fairly Rewards Cards".to_string(),
            symbol: "FAIRLY".to_string(),
            icon: None,
            base_uri: None,
            reference: None,
            reference_hash: None,
        }
    }
}

#[near]
impl Fairly {
    pub fn nft_payout(
        &self,
        token_id: TokenId,
        balance: U128,
        max_len_payout: Option<u32>,
    ) -> Payout {
        let owner = self.token_owner(&token_id);
        let payout = self.payout_for(&token_id, owner, balance.0);
        if let Some(max) = max_len_payout {
            require!(payout.payout.len() <= max as usize, "PAYOUT_TOO_LONG");
        }
        payout
    }

    #[payable]
    pub fn nft_transfer_payout(
        &mut self,
        receiver_id: AccountId,
        token_id: TokenId,
        approval_id: Option<u64>,
        memo: Option<String>,
        balance: U128,
        max_len_payout: Option<u32>,
    ) -> Payout {
        assert_one_yocto();
        let payout = self.nft_payout(token_id.clone(), balance, max_len_payout);
        self.nft_transfer(receiver_id, token_id, approval_id, memo);
        payout
    }
}
