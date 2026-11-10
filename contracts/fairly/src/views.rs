use crate::models::*;
use crate::{Fairly, FairlyExt};
use near_contract_standards::non_fungible_token::TokenId;
use near_sdk::{env, near, AccountId};

#[near]
impl Fairly {
    pub fn get_config(&self) -> (AccountId, String) {
        (self.tusdc.clone(), self.art_base_url.clone())
    }

    pub fn get_program(&self, slug: String) -> Option<ProgramView> {
        let program = self.programs.get(&slug)?.clone();
        let now = env::block_timestamp();
        Some(ProgramView {
            active_boost_ids: program.active_boost_ids(now),
            effective_cashback_bps: program.effective_cashback_bps(now),
            program,
        })
    }

    pub fn get_programs_by_owner(&self, account_id: AccountId) -> Vec<ProgramView> {
        self.programs_by_owner
            .get(&account_id)
            .cloned()
            .unwrap_or_default()
            .into_iter()
            .filter_map(|slug| self.get_program(slug))
            .collect()
    }

    pub fn get_pass(&self, token_id: TokenId) -> Option<PassView> {
        let pass = self.passes.get(&token_id)?.clone();
        let program = self.programs.get(&pass.program_slug)?;
        let owner = self.tokens.owner_by_id.get(&token_id)?;
        let tier_index = usize::from(pass.tier_index);
        let next = program.tiers.get(tier_index + 1);
        Some(PassView {
            owner,
            program_name: program.name.clone(),
            brand_color: program.brand_color.clone(),
            tier_name: program.tiers[tier_index].name.clone(),
            next_tier: next.map(|tier| tier.name.clone()),
            purchases_to_next_tier: next
                .map(|tier| tier.min_purchases.saturating_sub(pass.purchase_count)),
            expires_at_ns: Self::expires_at_ns(&pass, program),
            listing_price: self.active_listing(&token_id).map(|listing| listing.price),
            pass,
        })
    }

    pub fn get_passes_by_owner(&self, account_id: AccountId) -> Vec<PassView> {
        self.tokens
            .tokens_per_owner
            .as_ref()
            .and_then(|by_owner| by_owner.get(&account_id))
            .map(|tokens| tokens.to_vec())
            .unwrap_or_default()
            .into_iter()
            .filter_map(|token_id| self.get_pass(token_id))
            .collect()
    }

    pub fn get_listings(
        &self,
        slug: Option<String>,
        from_index: Option<u32>,
        limit: Option<u32>,
    ) -> Vec<ListingView> {
        let start = from_index.unwrap_or(0) as usize;
        let limit = limit.unwrap_or(50).min(100) as usize;
        self.listings
            .keys()
            .filter_map(|token_id| self.listing_view(token_id))
            .filter(|view| slug.as_ref().is_none_or(|slug| &view.program_slug == slug))
            .skip(start)
            .take(limit)
            .collect()
    }

    pub fn get_pending_count(&self, slug: String) -> u32 {
        self.pending_queues
            .get(&slug)
            .map(|queue| queue.len() as u32)
            .unwrap_or(0)
    }
}

impl Fairly {
    fn listing_view(&self, token_id: &TokenId) -> Option<ListingView> {
        let listing = self.active_listing(token_id)?;
        let pass = self.passes.get(token_id)?;
        let program = self.programs.get(&pass.program_slug)?;
        Some(ListingView {
            token_id: token_id.clone(),
            program_slug: program.slug.clone(),
            program_name: program.name.clone(),
            seller: listing.seller,
            price: listing.price,
            balance: pass.balance,
            tier_index: pass.tier_index,
            tier_name: program.tiers[usize::from(pass.tier_index)].name.clone(),
            purchase_count: pass.purchase_count,
        })
    }
}
