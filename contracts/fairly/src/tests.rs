use super::*;
use crate::purchases::cashback_for;
use near_contract_standards::fungible_token::receiver::FungibleTokenReceiver;
use near_contract_standards::non_fungible_token::core::NonFungibleTokenCore;
use near_contract_standards::non_fungible_token::enumeration::NonFungibleTokenEnumeration;
use near_sdk::test_utils::{get_logs, VMContextBuilder};
use near_sdk::{testing_env, PromiseOrValue};

const SLUG: &str = "cafe-esquina";
const DAY_NS: u64 = NANOS_PER_DAY;
const START_NS: u64 = 1_763_000_000 * NANOS_PER_SECOND;

fn account(name: &str) -> AccountId {
    format!("{name}.testnet").parse().unwrap()
}

fn merchant() -> AccountId {
    account("merchant")
}

fn cashier() -> AccountId {
    account("cashier")
}

fn maria() -> AccountId {
    account("maria")
}

fn juan() -> AccountId {
    account("juan")
}

fn tusdc() -> AccountId {
    account("tusdc")
}

fn call_as(predecessor: &AccountId, deposit: NearToken, timestamp_ns: u64) {
    testing_env!(VMContextBuilder::new()
        .current_account_id(account("fairly"))
        .predecessor_account_id(predecessor.clone())
        .attached_deposit(deposit)
        .block_timestamp(timestamp_ns)
        .build());
}

fn as_user(predecessor: &AccountId) {
    call_as(predecessor, NearToken::from_yoctonear(0), START_NS);
}

fn as_user_with_yocto(predecessor: &AccountId) {
    call_as(predecessor, NearToken::from_yoctonear(1), START_NS);
}

fn tiers() -> Vec<Tier> {
    vec![
        Tier {
            name: "Bronze".into(),
            min_purchases: 0,
            perk: None,
        },
        Tier {
            name: "Silver".into(),
            min_purchases: 3,
            perk: Some("Free coffee".into()),
        },
        Tier {
            name: "Gold".into(),
            min_purchases: 10,
            perk: Some("Free pastry".into()),
        },
    ]
}

fn program_input() -> ProgramInput {
    ProgramInput {
        slug: SLUG.into(),
        name: "Cafe Esquina".into(),
        mcc: 5814,
        utc_offset_minutes: 0,
        brand_color: "#F2654F".into(),
        logo_url: None,
        cashback_bps: 500,
        royalty_bps: 500,
        expiry_days: Some(90),
        daily_cap: U128(100 * ONE_TUSDC),
        tiers: tiers(),
        locations: vec![LocationInput {
            id: "downtown".into(),
            name: "Downtown".into(),
            address: "Main St 1".into(),
            lat: 40.4,
            lng: -3.7,
        }],
    }
}

const ONE_TUSDC: u128 = 1_000_000;

fn setup() -> Fairly {
    call_as(&merchant(), NearToken::from_near(5), START_NS);
    let mut contract = Fairly::new(tusdc(), "https://fairly.example".into());
    contract.create_program(program_input());
    as_user(&merchant());
    contract.add_cashier(SLUG.into(), cashier(), "downtown".into());
    contract
}

fn fund(contract: &mut Fairly, amount: u128) {
    as_user(&tusdc());
    let result =
        contract.ft_on_transfer(merchant(), U128(amount), format!("{{\"fund\":\"{SLUG}\"}}"));
    assert!(matches!(result, PromiseOrValue::Value(U128(0))));
}

fn issue_to(contract: &mut Fairly, owner: &AccountId) -> TokenId {
    as_user(&cashier());
    contract.issue_pass(SLUG.into(), owner.clone())
}

fn purchase(contract: &mut Fairly, token_id: &TokenId, cents: u64) -> PurchaseResult {
    as_user(&cashier());
    contract.record_purchase(
        token_id.clone(),
        cents,
        "downtown".into(),
        Some("Coffee".into()),
    )
}

fn refunded(result: PromiseOrValue<U128>) -> u128 {
    match result {
        PromiseOrValue::Value(amount) => amount.0,
        PromiseOrValue::Promise(_) => panic!("unexpected promise"),
    }
}

#[test]
fn test_prog_001_create_program() {
    let contract = setup();
    let program = contract.get_program(SLUG.into()).unwrap().program;
    assert_eq!(program.owner, merchant());
    assert!(program.storage_balance > NearToken::from_near(4));
}

#[test]
#[should_panic(expected = "SLUG_TAKEN")]
fn test_prog_001_slug_taken() {
    let mut contract = setup();
    call_as(&juan(), NearToken::from_near(1), START_NS);
    contract.create_program(program_input());
}

#[test]
#[should_panic(expected = "INVALID_SLUG")]
fn test_prog_001_invalid_slug() {
    call_as(&merchant(), NearToken::from_near(1), START_NS);
    let mut contract = Fairly::new(tusdc(), "https://fairly.example".into());
    contract.create_program(ProgramInput {
        slug: "Bad Slug".into(),
        ..program_input()
    });
}

#[test]
#[should_panic(expected = "INVALID_BPS")]
fn test_prog_002_cashback_over_limit() {
    call_as(&merchant(), NearToken::from_near(1), START_NS);
    let mut contract = Fairly::new(tusdc(), "https://fairly.example".into());
    contract.create_program(ProgramInput {
        cashback_bps: 2_501,
        ..program_input()
    });
}

#[test]
#[should_panic(expected = "INVALID_TIERS")]
fn test_prog_003_tiers_must_increase() {
    call_as(&merchant(), NearToken::from_near(1), START_NS);
    let mut contract = Fairly::new(tusdc(), "https://fairly.example".into());
    let mut bad = tiers();
    bad[2].min_purchases = 3;
    contract.create_program(ProgramInput {
        tiers: bad,
        ..program_input()
    });
}

#[test]
fn test_prog_004_fund_pool() {
    let mut contract = setup();
    fund(&mut contract, 50 * ONE_TUSDC);
    assert_eq!(
        contract
            .get_program(SLUG.into())
            .unwrap()
            .program
            .pool_balance
            .0,
        50 * ONE_TUSDC
    );
}

#[test]
fn test_prog_005_other_token_refunded() {
    let mut contract = setup();
    as_user(&account("fake-usdc"));
    let result = contract.ft_on_transfer(merchant(), U128(7), format!("{{\"fund\":\"{SLUG}\"}}"));
    assert_eq!(refunded(result), 7);
    assert_eq!(
        contract
            .get_program(SLUG.into())
            .unwrap()
            .program
            .pool_balance
            .0,
        0
    );
}

#[test]
fn test_prog_005_unknown_program_refunded() {
    let mut contract = setup();
    as_user(&tusdc());
    let result = contract.ft_on_transfer(merchant(), U128(9), "{\"fund\":\"missing\"}".into());
    assert_eq!(refunded(result), 9);
}

#[test]
#[should_panic(expected = "NOT_OWNER")]
fn test_prog_006_withdraw_not_owner() {
    let mut contract = setup();
    fund(&mut contract, ONE_TUSDC);
    as_user_with_yocto(&juan());
    let _ = contract.withdraw_pool(SLUG.into(), U128(1));
}

#[test]
fn test_prog_006_withdraw_by_owner() {
    let mut contract = setup();
    fund(&mut contract, 5 * ONE_TUSDC);
    as_user_with_yocto(&merchant());
    let _ = contract.withdraw_pool(SLUG.into(), U128(2 * ONE_TUSDC));
    assert_eq!(
        contract
            .get_program(SLUG.into())
            .unwrap()
            .program
            .pool_balance
            .0,
        3 * ONE_TUSDC
    );
}

#[test]
#[should_panic(expected = "NOT_CASHIER")]
fn test_prog_007_removed_cashier_cannot_issue() {
    let mut contract = setup();
    as_user(&merchant());
    contract.remove_cashier(SLUG.into(), cashier());
    issue_to(&mut contract, &maria());
}

#[test]
#[should_panic(expected = "PAUSED")]
fn test_prog_008_paused_blocks_purchases() {
    let mut contract = setup();
    let token_id = issue_to(&mut contract, &maria());
    as_user(&merchant());
    contract.set_paused(SLUG.into(), true);
    purchase(&mut contract, &token_id, 500);
}

#[test]
fn test_prog_008_paused_allows_redeem() {
    let mut contract = setup();
    fund(&mut contract, 10 * ONE_TUSDC);
    let token_id = issue_to(&mut contract, &maria());
    purchase(&mut contract, &token_id, 1_000);
    as_user(&merchant());
    contract.set_paused(SLUG.into(), true);
    as_user_with_yocto(&maria());
    contract.redeem(token_id.clone(), U128(100_000));
    assert_eq!(contract.get_pass(token_id).unwrap().pass.balance.0, 400_000);
}

#[test]
fn test_prog_009_update_keeps_balances() {
    let mut contract = setup();
    fund(&mut contract, 10 * ONE_TUSDC);
    let token_id = issue_to(&mut contract, &maria());
    purchase(&mut contract, &token_id, 500);
    as_user(&merchant());
    contract.update_program(
        SLUG.into(),
        ProgramUpdate {
            cashback_bps: Some(1_000),
            name: Some("Cafe Plaza".into()),
            ..Default::default()
        },
    );
    let pass = contract.get_pass(token_id).unwrap();
    assert_eq!(pass.pass.balance.0, 250_000);
    assert_eq!(pass.program_name, "Cafe Plaza");
}

#[test]
fn test_prog_010_programs_by_owner() {
    let contract = setup();
    let programs = contract.get_programs_by_owner(merchant());
    assert_eq!(programs.len(), 1);
    assert_eq!(programs[0].program.slug, SLUG);
}

#[test]
#[should_panic(expected = "NO_STORAGE")]
fn test_prog_013_cashier_calls_fail_without_storage() {
    let mut contract = setup();
    let mut program = contract.program(SLUG);
    program.storage_balance = NearToken::from_yoctonear(0);
    contract.save_program(program);
    issue_to(&mut contract, &maria());
}

#[test]
fn test_pass_002_cashier_issues_bronze_pass() {
    let mut contract = setup();
    let token_id = issue_to(&mut contract, &maria());
    let tokens = contract.nft_tokens_for_owner(maria(), None, None);
    assert_eq!(tokens.len(), 1);
    assert_eq!(tokens[0].token_id, token_id);
    assert_eq!(contract.get_pass(token_id).unwrap().tier_name, "Bronze");
}

#[test]
#[should_panic(expected = "NOT_CASHIER")]
fn test_pass_002_stranger_cannot_issue() {
    let mut contract = setup();
    as_user(&juan());
    contract.issue_pass(SLUG.into(), maria());
}

#[test]
#[should_panic(expected = "ALREADY_HAS_PASS")]
fn test_pass_003_one_pass_per_program() {
    let mut contract = setup();
    issue_to(&mut contract, &maria());
    issue_to(&mut contract, &maria());
}

#[test]
fn test_pass_004_token_id_is_random_crockford_code() {
    let mut contract = setup();
    let first = issue_to(&mut contract, &maria());
    let second = issue_to(&mut contract, &juan());
    for token_id in [&first, &second] {
        let code = token_id.strip_prefix("cafe-esquina:").unwrap();
        assert_eq!(code.len(), crate::passes::CODE_LENGTH);
        assert!(code
            .bytes()
            .all(|b| crate::passes::CODE_ALPHABET.contains(&b)));
    }
    assert_ne!(first, second);
}

#[test]
#[should_panic(expected = "INVALID_MCC")]
fn test_prog_014_mcc_must_be_four_digits() {
    call_as(&merchant(), NearToken::from_near(1), START_NS);
    let mut contract = Fairly::new(tusdc(), "https://fairly.example".into());
    contract.create_program(ProgramInput {
        mcc: 10_000,
        ..program_input()
    });
}

#[test]
fn test_pass_005_metadata() {
    let mut contract = setup();
    let token_id = issue_to(&mut contract, &maria());
    let metadata = contract.nft_token(token_id).unwrap().metadata.unwrap();
    assert_eq!(metadata.title.unwrap(), "Cafe Esquina: Bronze");
    assert_eq!(
        metadata.media.unwrap(),
        "https://fairly.example/api/art/cafe-esquina/0.svg"
    );
    let extra: near_sdk::serde_json::Value =
        near_sdk::serde_json::from_str(&metadata.extra.unwrap()).unwrap();
    assert_eq!(extra["tier"], "Bronze");
    assert_eq!(extra["purchase_count"], 0);
}

#[test]
fn test_pass_005_art_base_url_update_changes_media() {
    let mut contract = setup();
    let token_id = issue_to(&mut contract, &maria());
    call_as(&account("fairly"), NearToken::from_yoctonear(0), START_NS);
    contract.set_art_base_url("https://fairly.pages.dev/".into());
    assert_eq!(contract.get_config().1, "https://fairly.pages.dev/");
    assert!(get_logs()
        .iter()
        .any(|log| log.contains("\"event\":\"art_base_url_updated\"")));
    let metadata = contract.nft_token(token_id).unwrap().metadata.unwrap();
    assert_eq!(
        metadata.media.unwrap(),
        "https://fairly.pages.dev/api/art/cafe-esquina/0.svg"
    );
}

#[test]
fn test_pass_005_art_base_url_accepts_localhost() {
    let mut contract = setup();
    call_as(&account("fairly"), NearToken::from_yoctonear(0), START_NS);
    contract.set_art_base_url("http://localhost:3000".into());
    assert_eq!(contract.get_config().1, "http://localhost:3000");
}

#[test]
#[should_panic(expected = "NOT_OWNER")]
fn test_pass_005_art_base_url_owner_only() {
    let mut contract = setup();
    as_user(&merchant());
    contract.set_art_base_url("https://fairly.pages.dev".into());
}

#[test]
#[should_panic(expected = "INVALID_URL")]
fn test_pass_005_art_base_url_rejects_plain_http() {
    let mut contract = setup();
    call_as(&account("fairly"), NearToken::from_yoctonear(0), START_NS);
    contract.set_art_base_url("http://fairly.example".into());
}

#[test]
#[should_panic(expected = "INVALID_URL")]
fn test_pass_005_art_base_url_rejects_localhost_lookalike() {
    let mut contract = setup();
    call_as(&account("fairly"), NearToken::from_yoctonear(0), START_NS);
    contract.set_art_base_url("http://localhost.evil.com".into());
}

#[test]
#[should_panic(expected = "INVALID_URL")]
fn test_pass_005_art_base_url_rejects_too_long() {
    let mut contract = setup();
    call_as(&account("fairly"), NearToken::from_yoctonear(0), START_NS);
    contract.set_art_base_url(format!("https://{}.example", "a".repeat(200)));
}

#[test]
fn test_pass_006_007_tier_up_on_third_purchase() {
    let mut contract = setup();
    fund(&mut contract, 10 * ONE_TUSDC);
    let token_id = issue_to(&mut contract, &maria());
    purchase(&mut contract, &token_id, 100);
    purchase(&mut contract, &token_id, 100);
    let result = purchase(&mut contract, &token_id, 100);
    assert!(result.tier_up);
    assert_eq!(result.tier_index, 1);
    assert!(get_logs()
        .iter()
        .any(|log| log.contains("\"event\":\"tier_up\"")));
}

#[test]
fn test_pass_008_transfer_moves_balance() {
    let mut contract = setup();
    fund(&mut contract, 10 * ONE_TUSDC);
    let token_id = issue_to(&mut contract, &maria());
    purchase(&mut contract, &token_id, 2_400);
    as_user_with_yocto(&maria());
    contract.nft_transfer(juan(), token_id.clone(), None, None);
    let pass = contract.get_pass(token_id).unwrap();
    assert_eq!(pass.owner, juan());
    assert_eq!(pass.pass.balance.0, 1_200_000);
}

#[test]
#[should_panic(expected = "ALREADY_HAS_PASS")]
fn test_pass_003_transfer_to_holder_rejected() {
    let mut contract = setup();
    let token_id = issue_to(&mut contract, &maria());
    issue_to(&mut contract, &juan());
    as_user_with_yocto(&maria());
    contract.nft_transfer(juan(), token_id, None, None);
}

#[test]
fn test_pass_009_payout_split() {
    let mut contract = setup();
    let token_id = issue_to(&mut contract, &maria());
    let payout = contract
        .nft_payout(token_id, U128(10 * ONE_TUSDC), None)
        .payout;
    assert_eq!(payout[&merchant()].0, 500_000);
    assert_eq!(payout[&maria()].0, 9_500_000);
}

#[test]
fn test_pass_010_view_progress() {
    let mut contract = setup();
    let token_id = issue_to(&mut contract, &maria());
    let view = contract.get_pass(token_id).unwrap();
    assert_eq!(view.next_tier.as_deref(), Some("Silver"));
    assert_eq!(view.purchases_to_next_tier, Some(3));
    assert_eq!(view.expires_at_ns, Some(START_NS + 90 * DAY_NS));
}

#[test]
#[should_panic(expected = "NOT_CASHIER")]
fn test_buy_001_only_staff() {
    let mut contract = setup();
    let token_id = issue_to(&mut contract, &maria());
    as_user(&juan());
    contract.record_purchase(token_id, 500, "downtown".into(), None);
}

#[test]
#[should_panic(expected = "INVALID_AMOUNT")]
fn test_buy_002_amount_limit() {
    let mut contract = setup();
    let token_id = issue_to(&mut contract, &maria());
    purchase(&mut contract, &token_id, 100_001);
}

#[test]
fn test_buy_003_cashback_amount() {
    assert_eq!(cashback_for(500, 500), 250_000);
    let mut contract = setup();
    fund(&mut contract, 10 * ONE_TUSDC);
    let token_id = issue_to(&mut contract, &maria());
    let result = purchase(&mut contract, &token_id, 500);
    assert_eq!(result.cashback.0, 250_000);
    assert_eq!(result.balance.0, 250_000);
}

#[test]
fn test_buy_004_pending_when_pool_short() {
    let mut contract = setup();
    fund(&mut contract, 100_000);
    let token_id = issue_to(&mut contract, &maria());
    let result = purchase(&mut contract, &token_id, 500);
    assert_eq!(result.credited.0, 100_000);
    assert_eq!(result.pending.0, 150_000);
    let pass = contract.get_pass(token_id).unwrap().pass;
    assert_eq!(pass.purchase_count, 1);
    assert_eq!(pass.pending.0, 150_000);
}

#[test]
fn test_run_002_funding_settles_pending() {
    let mut contract = setup();
    let token_id = issue_to(&mut contract, &maria());
    purchase(&mut contract, &token_id, 500);
    assert_eq!(contract.get_pending_count(SLUG.into()), 1);
    fund(&mut contract, ONE_TUSDC);
    let pass = contract.get_pass(token_id).unwrap().pass;
    assert_eq!(pass.balance.0, 250_000);
    assert_eq!(pass.pending.0, 0);
    assert_eq!(contract.get_pending_count(SLUG.into()), 0);
    assert_eq!(
        contract
            .get_program(SLUG.into())
            .unwrap()
            .program
            .pool_balance
            .0,
        750_000
    );
}

#[test]
#[should_panic(expected = "DAILY_CAP")]
fn test_buy_005_daily_cap() {
    let mut contract = setup();
    fund(&mut contract, 100 * ONE_TUSDC);
    let token_id = issue_to(&mut contract, &maria());
    purchase(&mut contract, &token_id, 100_000);
    purchase(&mut contract, &token_id, 100_000);
    purchase(&mut contract, &token_id, 100);
}

#[test]
fn test_buy_005_daily_cap_resets_next_day() {
    let mut contract = setup();
    fund(&mut contract, 100 * ONE_TUSDC);
    let token_id = issue_to(&mut contract, &maria());
    purchase(&mut contract, &token_id, 100_000);
    purchase(&mut contract, &token_id, 100_000);
    call_as(&cashier(), NearToken::from_yoctonear(0), START_NS + DAY_NS);
    contract.record_purchase(token_id, 100, "downtown".into(), None);
}

#[test]
fn test_buy_007_009_purchase_event_has_category() {
    let mut contract = setup();
    let token_id = issue_to(&mut contract, &maria());
    purchase(&mut contract, &token_id, 500);
    let logs = get_logs();
    let event = logs
        .iter()
        .find(|log| log.contains("\"event\":\"purchase\""))
        .unwrap();
    assert!(event.contains("\"category\":\"Coffee\""));
    assert!(event.contains("\"standard\":\"fairly\""));
}

#[test]
#[should_panic(expected = "LOCATION_MISMATCH")]
fn test_loc_002_cashier_bound_to_location() {
    let mut contract = setup();
    as_user(&merchant());
    contract.add_location(
        SLUG.into(),
        LocationInput {
            id: "airport".into(),
            name: "Airport".into(),
            address: "T4".into(),
            lat: 40.5,
            lng: -3.6,
        },
    );
    let token_id = issue_to(&mut contract, &maria());
    as_user(&cashier());
    contract.record_purchase(token_id, 500, "airport".into(), None);
}

#[test]
fn test_buy_011_bst_boost_capped() {
    let mut contract = setup();
    fund(&mut contract, 100 * ONE_TUSDC);
    as_user(&merchant());
    contract.update_program(
        SLUG.into(),
        ProgramUpdate {
            cashback_bps: Some(2_200),
            ..Default::default()
        },
    );
    contract.add_boost(
        SLUG.into(),
        BoostInput {
            name: "Black Friday".into(),
            extra_bps: 500,
            schedule: BoostSchedule::Range {
                starts_ns: START_NS - DAY_NS,
                ends_ns: START_NS + DAY_NS,
            },
        },
    );
    assert_eq!(
        contract
            .get_program(SLUG.into())
            .unwrap()
            .effective_cashback_bps,
        2_500
    );
    let token_id = issue_to(&mut contract, &maria());
    let result = purchase(&mut contract, &token_id, 1_000);
    assert_eq!(result.cashback.0, 2_500_000);
}

#[test]
fn test_bst_003_weekly_boost() {
    let mut contract = setup();
    let weekday = crate::programs::weekday_of(START_NS);
    as_user(&merchant());
    let id = contract.add_boost(
        SLUG.into(),
        BoostInput {
            name: "Coffee day".into(),
            extra_bps: 500,
            schedule: BoostSchedule::Weekly { weekday },
        },
    );
    assert_eq!(
        contract.get_program(SLUG.into()).unwrap().active_boost_ids,
        vec![id]
    );
    contract.set_boost_enabled(SLUG.into(), id, false);
    assert!(contract
        .get_program(SLUG.into())
        .unwrap()
        .active_boost_ids
        .is_empty());
}

#[test]
fn test_rdm_001_003_redeem() {
    let mut contract = setup();
    fund(&mut contract, 10 * ONE_TUSDC);
    let token_id = issue_to(&mut contract, &maria());
    purchase(&mut contract, &token_id, 2_000);
    as_user_with_yocto(&maria());
    let code = contract.redeem(token_id.clone(), U128(600_000));
    assert_eq!(code, format!("{token_id}#1"));
    assert_eq!(contract.get_pass(token_id).unwrap().pass.balance.0, 400_000);
}

#[test]
#[should_panic(expected = "INSUFFICIENT_BALANCE")]
fn test_rdm_001_insufficient_balance() {
    let mut contract = setup();
    let token_id = issue_to(&mut contract, &maria());
    as_user_with_yocto(&maria());
    contract.redeem(token_id, U128(1));
}

#[test]
#[should_panic(expected = "NOT_PASS_OWNER")]
fn test_rdm_001_only_owner_redeems() {
    let mut contract = setup();
    let token_id = issue_to(&mut contract, &maria());
    as_user_with_yocto(&juan());
    contract.redeem(token_id, U128(1));
}

#[test]
#[should_panic(expected = "PERK_CLAIMED")]
fn test_rdm_004_perk_claimed_once_per_pass() {
    let mut contract = setup();
    fund(&mut contract, 10 * ONE_TUSDC);
    let token_id = issue_to(&mut contract, &maria());
    for _ in 0..3 {
        purchase(&mut contract, &token_id, 100);
    }
    as_user(&maria());
    contract.claim_perk(token_id.clone(), 1);
    as_user_with_yocto(&maria());
    contract.nft_transfer(juan(), token_id.clone(), None, None);
    as_user(&juan());
    contract.claim_perk(token_id, 1);
}

#[test]
#[should_panic(expected = "LISTED")]
fn test_rdm_006_listed_pass_not_redeemable() {
    let mut contract = setup();
    fund(&mut contract, 10 * ONE_TUSDC);
    let token_id = issue_to(&mut contract, &maria());
    purchase(&mut contract, &token_id, 1_000);
    as_user(&maria());
    contract.list_pass(token_id.clone(), U128(ONE_TUSDC));
    as_user_with_yocto(&maria());
    contract.redeem(token_id, U128(1));
}

fn listed_gold_pass(contract: &mut Fairly) -> TokenId {
    fund(contract, 100 * ONE_TUSDC);
    let token_id = issue_to(contract, &maria());
    purchase(contract, &token_id, 24_000);
    as_user(&maria());
    contract.list_pass(token_id.clone(), U128(10 * ONE_TUSDC));
    token_id
}

#[test]
fn test_sale_003_purchase_transfers_pass_with_balance() {
    let mut contract = setup();
    let token_id = listed_gold_pass(&mut contract);
    as_user(&tusdc());
    let result = contract.ft_on_transfer(
        juan(),
        U128(10 * ONE_TUSDC),
        format!("{{\"buy\":\"{token_id}\"}}"),
    );
    assert_eq!(refunded(result), 0);
    let pass = contract.get_pass(token_id).unwrap();
    assert_eq!(pass.owner, juan());
    assert_eq!(pass.pass.balance.0, 12 * ONE_TUSDC);
    assert!(pass.listing_price.is_none());
    let logs = get_logs();
    let sale = logs
        .iter()
        .find(|log| log.contains("\"event\":\"sale\""))
        .unwrap();
    assert!(sale.contains("\"royalty\":\"500000\""));
}

#[test]
fn test_sale_002_wrong_amount_refunded() {
    let mut contract = setup();
    let token_id = listed_gold_pass(&mut contract);
    as_user(&tusdc());
    let result = contract.ft_on_transfer(
        juan(),
        U128(9 * ONE_TUSDC),
        format!("{{\"buy\":\"{token_id}\"}}"),
    );
    assert_eq!(refunded(result), 9 * ONE_TUSDC);
    assert_eq!(
        contract.get_listings(Some(SLUG.into()), None, None).len(),
        1
    );
}

#[test]
fn test_sale_004_buyer_with_pass_refunded() {
    let mut contract = setup();
    let token_id = listed_gold_pass(&mut contract);
    issue_to(&mut contract, &juan());
    as_user(&tusdc());
    let result = contract.ft_on_transfer(
        juan(),
        U128(10 * ONE_TUSDC),
        format!("{{\"buy\":\"{token_id}\"}}"),
    );
    assert_eq!(refunded(result), 10 * ONE_TUSDC);
}

#[test]
fn test_sale_005_transfer_invalidates_listing() {
    let mut contract = setup();
    let token_id = listed_gold_pass(&mut contract);
    as_user_with_yocto(&maria());
    contract.nft_transfer(juan(), token_id, None, None);
    assert!(contract.get_listings(None, None, None).is_empty());
}

#[test]
fn test_sale_006_listing_view_shows_value_inside() {
    let mut contract = setup();
    listed_gold_pass(&mut contract);
    let listings = contract.get_listings(None, None, None);
    assert_eq!(listings[0].price.0, 10 * ONE_TUSDC);
    assert_eq!(listings[0].balance.0, 12 * ONE_TUSDC);
    assert_eq!(listings[0].seller, maria());
}

#[test]
fn test_exp_002_sweep_returns_balance_to_pool() {
    let mut contract = setup();
    fund(&mut contract, 10 * ONE_TUSDC);
    let token_id = issue_to(&mut contract, &maria());
    purchase(&mut contract, &token_id, 2_000);
    call_as(
        &juan(),
        NearToken::from_yoctonear(0),
        START_NS + 91 * DAY_NS,
    );
    assert_eq!(contract.sweep_expired(token_id.clone()).0, ONE_TUSDC);
    assert_eq!(contract.get_pass(token_id).unwrap().pass.balance.0, 0);
    assert_eq!(
        contract
            .get_program(SLUG.into())
            .unwrap()
            .program
            .pool_balance
            .0,
        10 * ONE_TUSDC
    );
}

#[test]
#[should_panic(expected = "NOT_EXPIRED")]
fn test_exp_003_not_expired() {
    let mut contract = setup();
    let token_id = issue_to(&mut contract, &maria());
    call_as(
        &juan(),
        NearToken::from_yoctonear(0),
        START_NS + 10 * DAY_NS,
    );
    contract.sweep_expired(token_id);
}

#[test]
fn test_nep_181_enumeration() {
    let mut contract = setup();
    issue_to(&mut contract, &maria());
    issue_to(&mut contract, &juan());
    assert_eq!(contract.nft_total_supply().0, 2);
    assert_eq!(contract.nft_tokens(None, None).len(), 2);
    assert_eq!(contract.nft_supply_for_owner(maria()).0, 1);
}

#[test]
#[should_panic(expected = "ALREADY_HAS_PROGRAM")]
fn test_prog_015_one_program_per_owner() {
    let mut contract = setup();
    call_as(&merchant(), NearToken::from_near(1), START_NS);
    contract.create_program(ProgramInput {
        slug: "second-shop".into(),
        ..program_input()
    });
}

#[test]
#[should_panic(expected = "INVALID_TIMEZONE")]
fn test_prog_016_invalid_timezone() {
    call_as(&merchant(), NearToken::from_near(1), START_NS);
    let mut contract = Fairly::new(tusdc(), "https://fairly.example".into());
    contract.create_program(ProgramInput {
        utc_offset_minutes: 7,
        ..program_input()
    });
}

#[test]
fn test_prog_016_weekly_boost_uses_local_day() {
    let mut contract = setup();
    as_user(&merchant());
    contract.update_program(
        SLUG.into(),
        ProgramUpdate {
            utc_offset_minutes: Some(-720),
            ..Default::default()
        },
    );
    let local_weekday = crate::programs::weekday_of(START_NS - 12 * 3_600 * 1_000_000_000);
    let id = contract.add_boost(
        SLUG.into(),
        BoostInput {
            name: "Local day".into(),
            extra_bps: 300,
            schedule: BoostSchedule::Weekly {
                weekday: local_weekday,
            },
        },
    );
    assert_eq!(
        contract.get_program(SLUG.into()).unwrap().active_boost_ids,
        vec![id]
    );
}

fn with_uptown(contract: &mut Fairly) {
    as_user(&merchant());
    contract.add_location(
        SLUG.into(),
        LocationInput {
            id: "uptown".into(),
            name: "Uptown".into(),
            address: "High St 2".into(),
            lat: 40.5,
            lng: -3.6,
        },
    );
    contract.add_manager(SLUG.into(), juan(), Some("uptown".into()));
}

#[test]
fn test_role_001_manager_adds_and_removes_cashier_at_own_location() {
    let mut contract = setup();
    with_uptown(&mut contract);
    as_user(&juan());
    contract.add_cashier(SLUG.into(), maria(), "uptown".into());
    assert_eq!(
        contract
            .get_program(SLUG.into())
            .unwrap()
            .program
            .cashier_location(&maria()),
        Some("uptown")
    );
    contract.remove_cashier(SLUG.into(), maria());
    assert!(contract
        .get_program(SLUG.into())
        .unwrap()
        .program
        .cashier_location(&maria())
        .is_none());
}

#[test]
#[should_panic(expected = "NOT_MANAGER")]
fn test_role_002_manager_cannot_touch_other_location() {
    let mut contract = setup();
    with_uptown(&mut contract);
    as_user(&juan());
    contract.remove_cashier(SLUG.into(), cashier());
}

#[test]
#[should_panic(expected = "NOT_OWNER")]
fn test_role_003_manager_cannot_withdraw() {
    let mut contract = setup();
    fund(&mut contract, 10 * ONE_TUSDC);
    with_uptown(&mut contract);
    as_user_with_yocto(&juan());
    contract.withdraw_pool(SLUG.into(), U128(ONE_TUSDC));
}

#[test]
#[should_panic(expected = "NOT_OWNER")]
fn test_role_004_only_owner_adds_managers() {
    let mut contract = setup();
    with_uptown(&mut contract);
    as_user(&juan());
    contract.add_manager(SLUG.into(), maria(), None);
}
