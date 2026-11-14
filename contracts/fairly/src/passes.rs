use crate::errors::*;
use crate::events;
use crate::models::*;
use crate::validation::validate_art_base_url;
use crate::{Fairly, FairlyExt};
use near_contract_standards::non_fungible_token::events::NftMint;
use near_contract_standards::non_fungible_token::metadata::TokenMetadata;
use near_contract_standards::non_fungible_token::{Token, TokenId};
use near_sdk::json_types::U128;
use near_sdk::serde_json::json;
use near_sdk::{env, near, require, AccountId};

impl Program {
    pub fn tier_for(&self, purchase_count: u32) -> u8 {
        self.tiers
            .iter()
            .rposition(|tier| tier.min_purchases <= purchase_count)
            .unwrap_or(0) as u8
    }

    pub fn expiry_period_ns(&self) -> Option<u64> {
        #[cfg(feature = "demo")]
        if let Some(seconds) = self.expiry_seconds {
            return Some(seconds.saturating_mul(NANOS_PER_SECOND));
        }
        self.expiry_days
            .map(|days| u64::from(days).saturating_mul(NANOS_PER_DAY))
    }
}

impl Pass {
    pub fn is_perk_claimed(&self, tier_index: u8) -> bool {
        self.claimed_perks & (1 << tier_index) != 0
    }
}

#[near]
impl Fairly {
    pub fn set_art_base_url(&mut self, art_base_url: String) {
        require!(
            env::predecessor_account_id() == env::current_account_id(),
            NOT_OWNER
        );
        validate_art_base_url(&art_base_url);
        let previous = std::mem::replace(&mut self.art_base_url, art_base_url.clone());
        events::emit(
            "art_base_url_updated",
            json!({ "previous": previous, "art_base_url": art_base_url }),
        );
    }

    pub fn issue_pass(&mut self, slug: String, owner: AccountId) -> TokenId {
        let initial_usage = env::storage_usage();
        let mut program = self.program(&slug);
        require!(!program.paused, PAUSED);
        Self::assert_staff(&program);
        self.assert_no_pass_in_program(&slug, &owner);

        program.pass_count += 1;
        let token_id = self.unused_token_id(&slug, program.pass_count);
        self.tokens
            .internal_mint_with_refund(token_id.clone(), owner.clone(), None, None);
        NftMint {
            owner_id: &owner,
            token_ids: &[&token_id],
            memo: None,
        }
        .emit();

        let now = env::block_timestamp();
        self.save_pass(Pass {
            token_id: token_id.clone(),
            program_slug: slug.clone(),
            balance: U128(0),
            pending: U128(0),
            purchase_count: 0,
            total_spent_cents: 0,
            tier_index: 0,
            claimed_perks: 0,
            redemption_count: 0,
            last_activity_ns: now,
            created_ns: now,
        });
        self.save_program(program);
        self.charge_program_storage(&slug, initial_usage);

        events::emit(
            "pass_issued",
            json!({
                "slug": slug,
                "token_id": token_id,
                "owner": owner,
                "issued_by": env::predecessor_account_id(),
            }),
        );
        token_id
    }

    pub fn claim_perk(&mut self, token_id: TokenId, tier_index: u8) -> String {
        let owner = self.assert_pass_owner(&token_id);
        let mut pass = self.pass(&token_id);
        let program = self.program(&pass.program_slug);
        require!(tier_index <= pass.tier_index, TIER_NOT_REACHED);
        let perk = program
            .tiers
            .get(usize::from(tier_index))
            .and_then(|tier| tier.perk.clone())
            .unwrap_or_else(|| env::panic_str(NO_PERK));
        require!(!pass.is_perk_claimed(tier_index), PERK_CLAIMED);

        pass.claimed_perks |= 1 << tier_index;
        pass.redemption_count += 1;
        pass.last_activity_ns = env::block_timestamp();
        let code = format!("{token_id}#{}", pass.redemption_count);
        self.save_pass(pass);

        events::emit(
            "perk_claimed",
            json!({
                "token_id": token_id,
                "owner": owner,
                "tier_index": tier_index,
                "perk": perk,
                "code": code,
            }),
        );
        code
    }
}

pub const CODE_ALPHABET: &[u8; 32] = b"0123456789ABCDEFGHJKMNPQRSTVWXYZ";
pub const CODE_LENGTH: usize = 6;
const MAX_CODE_ATTEMPTS: u8 = 8;

pub fn card_code(entropy: &[u8]) -> String {
    let bits = entropy
        .iter()
        .take(4)
        .fold(0u32, |acc, byte| (acc << 8) | u32::from(*byte));
    (0..CODE_LENGTH)
        .map(|index| CODE_ALPHABET[((bits >> (index * 5)) & 0x1f) as usize] as char)
        .collect()
}

impl Fairly {
    fn unused_token_id(&self, slug: &str, sequence: u64) -> TokenId {
        let seed = env::random_seed();
        (0..MAX_CODE_ATTEMPTS)
            .map(|attempt| {
                let mut input = seed.clone();
                input.extend_from_slice(&sequence.to_le_bytes());
                input.push(attempt);
                format!("{slug}:{}", card_code(&env::sha256(&input)))
            })
            .find(|token_id| self.tokens.owner_by_id.get(token_id).is_none())
            .unwrap_or_else(|| env::panic_str(CODE_COLLISION))
    }

    pub(crate) fn token_metadata(&self, pass: &Pass, program: &Program) -> TokenMetadata {
        let tier = &program.tiers[usize::from(pass.tier_index)];
        let extra = json!({
            "tier": tier.name,
            "tier_index": pass.tier_index,
            "balance": pass.balance,
            "pending": pass.pending,
            "purchase_count": pass.purchase_count,
        });
        TokenMetadata {
            title: Some(format!("{}: {}", program.name, tier.name)),
            description: Some(format!("{} loyalty card with rewards inside", program.name)),
            media: Some(format!(
                "{}/api/art/{}/{}.svg",
                self.art_base_url.trim_end_matches('/'),
                program.slug,
                pass.tier_index
            )),
            media_hash: None,
            copies: Some(1),
            issued_at: Some(pass.created_ns.to_string()),
            expires_at: None,
            starts_at: None,
            updated_at: Some(pass.last_activity_ns.to_string()),
            extra: Some(extra.to_string()),
            reference: None,
            reference_hash: None,
        }
    }

    pub(crate) fn token_view(&self, token_id: &TokenId) -> Option<Token> {
        let owner_id = self.tokens.owner_by_id.get(token_id)?;
        let pass = self.passes.get(token_id)?;
        let program = self.programs.get(&pass.program_slug)?;
        Some(Token {
            token_id: token_id.clone(),
            owner_id,
            metadata: Some(self.token_metadata(pass, program)),
            approved_account_ids: None,
        })
    }
}
