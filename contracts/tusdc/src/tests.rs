use super::*;
use near_sdk::test_utils::{accounts, VMContextBuilder};
use near_sdk::testing_env;

fn context(predecessor: AccountId, deposit: NearToken) {
    testing_env!(VMContextBuilder::new()
        .predecessor_account_id(predecessor)
        .attached_deposit(deposit)
        .build());
}

#[test]
fn test_tok_001_metadata() {
    let contract = TestUsdc::new();
    let metadata = contract.ft_metadata();
    assert_eq!(metadata.symbol, "tUSDC");
    assert_eq!(metadata.name, "Test USDC (Fairly demo)");
    assert_eq!(metadata.decimals, 6);
}

#[test]
fn test_tok_002_faucet_mints_and_registers() {
    context(accounts(1), NearToken::from_yoctonear(0));
    let mut contract = TestUsdc::new();
    contract.faucet(U128(50 * ONE_TUSDC));
    assert_eq!(contract.ft_balance_of(accounts(1)).0, 50 * ONE_TUSDC);
    assert_eq!(contract.ft_total_supply().0, 50 * ONE_TUSDC);
}

#[test]
#[should_panic(expected = "FAUCET_LIMIT")]
fn test_tok_002_faucet_rejects_over_limit() {
    context(accounts(1), NearToken::from_yoctonear(0));
    let mut contract = TestUsdc::new();
    contract.faucet(U128(MAX_FAUCET_AMOUNT + 1));
}

#[test]
fn test_transfer_registers_new_receiver() {
    context(accounts(1), NearToken::from_yoctonear(0));
    let mut contract = TestUsdc::new();
    contract.faucet(U128(10 * ONE_TUSDC));
    context(accounts(1), NearToken::from_yoctonear(1));
    contract.ft_transfer(accounts(2), U128(4 * ONE_TUSDC), None);
    assert_eq!(contract.ft_balance_of(accounts(2)).0, 4 * ONE_TUSDC);
    assert_eq!(contract.ft_balance_of(accounts(1)).0, 6 * ONE_TUSDC);
}
