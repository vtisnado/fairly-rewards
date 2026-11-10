use near_contract_standards::non_fungible_token::{NonFungibleToken, TokenId};
use near_sdk::json_types::U128;
use near_sdk::store::{IterableMap, LookupMap};
use near_sdk::{env, near, require, AccountId, BorshStorageKey, NearToken, PanicOnDefault};

pub mod errors;
pub mod events;
pub mod models;

mod expiry;
mod nft;
mod passes;
mod payouts;
mod programs;
mod purchases;
mod redemptions;
mod sales;
mod validation;
mod views;

use errors::*;
use models::*;

#[derive(BorshStorageKey)]
#[near]
enum StorageKey {
    NftOwners,
    NftEnumeration,
    Programs,
    ProgramsByOwner,
    Passes,
    Listings,
    PendingQueues,
    Refunds,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Role {
    Owner,
    Cashier,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Fairly {
    tokens: NonFungibleToken,
    tusdc: AccountId,
    art_base_url: String,
    programs: LookupMap<String, Program>,
    programs_by_owner: LookupMap<AccountId, Vec<String>>,
    passes: LookupMap<TokenId, Pass>,
    listings: IterableMap<TokenId, Listing>,
    pending_queues: LookupMap<String, Vec<TokenId>>,
    refunds: LookupMap<AccountId, U128>,
}

#[near]
impl Fairly {
    #[init]
    pub fn new(tusdc: AccountId, art_base_url: String) -> Self {
        Self {
            tokens: NonFungibleToken::new(
                StorageKey::NftOwners,
                env::current_account_id(),
                None::<StorageKey>,
                Some(StorageKey::NftEnumeration),
                None::<StorageKey>,
            ),
            tusdc,
            art_base_url,
            programs: LookupMap::new(StorageKey::Programs),
            programs_by_owner: LookupMap::new(StorageKey::ProgramsByOwner),
            passes: LookupMap::new(StorageKey::Passes),
            listings: IterableMap::new(StorageKey::Listings),
            pending_queues: LookupMap::new(StorageKey::PendingQueues),
            refunds: LookupMap::new(StorageKey::Refunds),
        }
    }
}

impl Fairly {
    pub(crate) fn program(&self, slug: &str) -> Program {
        self.programs
            .get(slug)
            .cloned()
            .unwrap_or_else(|| env::panic_str(PROGRAM_NOT_FOUND))
    }

    pub(crate) fn save_program(&mut self, program: Program) {
        self.programs.insert(program.slug.clone(), program);
    }

    pub(crate) fn pass(&self, token_id: &TokenId) -> Pass {
        self.passes
            .get(token_id)
            .cloned()
            .unwrap_or_else(|| env::panic_str(PASS_NOT_FOUND))
    }

    pub(crate) fn save_pass(&mut self, pass: Pass) {
        self.passes.insert(pass.token_id.clone(), pass);
    }

    pub(crate) fn token_owner(&self, token_id: &TokenId) -> AccountId {
        self.tokens
            .owner_by_id
            .get(token_id)
            .unwrap_or_else(|| env::panic_str(PASS_NOT_FOUND))
    }

    pub(crate) fn assert_program_owner(program: &Program) {
        require!(env::predecessor_account_id() == program.owner, NOT_OWNER);
    }

    pub(crate) fn assert_pass_owner(&self, token_id: &TokenId) -> AccountId {
        let owner = self.token_owner(token_id);
        require!(env::predecessor_account_id() == owner, NOT_PASS_OWNER);
        owner
    }

    pub(crate) fn role_of(program: &Program, account_id: &AccountId) -> Option<Role> {
        if &program.owner == account_id {
            Some(Role::Owner)
        } else if program.cashiers.iter().any(|c| &c.account_id == account_id) {
            Some(Role::Cashier)
        } else {
            None
        }
    }

    pub(crate) fn assert_staff(program: &Program) -> Role {
        Self::role_of(program, &env::predecessor_account_id())
            .unwrap_or_else(|| env::panic_str(NOT_CASHIER))
    }

    pub(crate) fn pass_of_owner(&self, slug: &str, owner: &AccountId) -> Option<TokenId> {
        let prefix = format!("{slug}:");
        self.tokens
            .tokens_per_owner
            .as_ref()
            .and_then(|by_owner| by_owner.get(owner))
            .and_then(|tokens| tokens.iter().find(|token_id| token_id.starts_with(&prefix)))
    }

    pub(crate) fn assert_no_pass_in_program(&self, slug: &str, owner: &AccountId) {
        require!(self.pass_of_owner(slug, owner).is_none(), ALREADY_HAS_PASS);
    }

    pub(crate) fn active_listing(&self, token_id: &TokenId) -> Option<Listing> {
        let listing = self.listings.get(token_id)?;
        let owner = self.tokens.owner_by_id.get(token_id)?;
        (listing.seller == owner).then(|| listing.clone())
    }

    fn flush_collections(&mut self) {
        self.programs.flush();
        self.programs_by_owner.flush();
        self.passes.flush();
        self.listings.flush();
        self.pending_queues.flush();
        self.refunds.flush();
    }

    pub(crate) fn storage_cost_since(&mut self, initial_usage: u64) -> NearToken {
        self.flush_collections();
        let used = env::storage_usage().saturating_sub(initial_usage);
        env::storage_byte_cost().saturating_mul(u128::from(used))
    }

    pub(crate) fn charge_program_storage(&mut self, slug: &str, initial_usage: u64) {
        let cost = self.storage_cost_since(initial_usage);
        if cost.is_zero() {
            return;
        }
        let mut program = self.program(slug);
        require!(program.storage_balance >= cost, NO_STORAGE);
        program.storage_balance = program.storage_balance.saturating_sub(cost);
        self.save_program(program);
    }
}

#[cfg(test)]
mod tests;
