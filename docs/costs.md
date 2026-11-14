# Measured costs on testnet

Facts only. No pricing or business conclusions.

## Method
- Date: 2026-11-13. Network: NEAR testnet. Contracts: `fairly-ayxv4.testnet`, `tusdc-ayxv4.testnet`.
- Transactions were read, not recreated. Candidates came from the NearBlocks testnet API (`api-testnet.nearblocks.io`) for `fairly`, `demo-cafe`, and `sponsor`. Each transaction was then read with the RPC method `EXPERIMENTAL_tx_status` (`wait_until: FINAL`).
- Tgas and NEAR burnt are the sums of `gas_burnt` and `tokens_burnt` over the transaction outcome and every receipt outcome, including cross-contract calls such as the tUSDC `ft_transfer` payout.
- Ranges are min to max over the sampled transactions (`n`). Where only one value is shown, all samples matched to the shown precision.
- Samples: 213 distinct transactions of the demo program, E2E runs and relay, between block heights about 277470000 and 277516423 (about 9 hours).
- Storage: `storage_usage` delta of the `fairly` account across the block that executed the call (`view_account` at the block and at its previous block). Locked NEAR = bytes x 1e19 yocto.
- Gas price: RPC `gas_price` returned `100000000` yocto per gas (1 Tgas = 0.0001 NEAR) on 2026-11-13. The block header gas price was `100000000` at the block of a sample from the same day. Storage price: `storage_amount_per_byte` = `10000000000000000000` yocto (1e19).
- The protocol config returned by `EXPERIMENTAL_protocol_config` reports `min_gas_price` = 5000 and `max_gas_price` = 1e22 yocto, with adjustment rate 1/100. The price observed on every sampled block was 100000000.
- "Direct" means the account signed the transaction itself and pays its gas. "Relayed" means a delegate action (meta-transaction) signed by the user and submitted by the sponsor account `sponsor-ayxv4.testnet` through `/api/relay`. The sponsor is the transaction signer and pays all gas for relayed calls. Attached deposits come from the account that signed the delegate action.

## Gas price note
NEAR gas price is denominated in NEAR (yocto per gas). The protocol sets a minimum, adjusts the price with block congestion, and has no USD oracle. Any USD figure for a cost needs an external NEAR/USD rate.

## Operations
Totals per operation. "Storage locked" is NEAR locked on the contract account by the new state. "Pays today" lists who pays the gas and who funds the storage or deposit in the current implementation.

| Operation | Mode | n | Tgas | NEAR burnt | Attached deposit | Storage locked | Pays today |
|---|---|---|---|---|---|---|---|
| Fund new implicit account (Transfer 0.05 NEAR to a non-existing account; sampled before D-045, the current amount is 0.01 NEAR and the burn is the same) | direct (sponsor) | 24 | 8.57 | 0.0071150 | 0.05 NEAR at the time (stays on the new account) | none on the contract (new account state is paid by the deposit) | Sponsor relay: gas plus the deposit |
| Transfer to an existing account, for comparison | direct (demo-cafe) | 1 | 0.67 | 0.0000446 | 3 NEAR (amount sent) | none | Signer |
| Merchant NEAR transfer via relay (merchant-actions.ts), recipient state not checked | relayed | 2 | 10.02 | 0.0072375 | 0.1 NEAR (amount sent, from merchant) | none | Sponsor: gas; merchant: amount |
| AddKey full access on own account | relayed | 3 | 1.48 | 0.0001029 | 0 | not measured (key record is on the user's account) | Sponsor relay |
| `issue_pass` (customer join, includes mint) | direct (demo cashier) | 68 | 7.16 to 9.36 | 0.0006940 to 0.0009134 | 0 | 820 bytes = 0.00820 NEAR per card (6 of 6 sampled identical) | Gas: cashier account (server signer). Storage: program storage balance (merchant deposit) |
| `record_purchase` (cashback) | direct (demo cashier) | 41 | 2.97 to 3.10 | 0.0002744 to 0.0002872 | 0 | 0 bytes (2 sampled) | Gas: cashier account. Cashback value: program pool in tUSDC |
| `claim_perk` | relayed | 6 | 3.70 | 0.0003256 to 0.0003259 | 0 | 0 bytes (1 sampled) | Sponsor relay |
| `redeem` (honor, includes tUSDC payout to merchant) | relayed | 4 | 8.52 | 0.0007624 to 0.0007628 | 1 yoctoNEAR | 0 bytes (1 sampled) | Sponsor relay |
| `ft_transfer_call` pool funding (tUSDC to `fairly`, `fund`) | direct (merchant) | 5 | 7.01 to 7.48 | 0.0006343 to 0.0006813 | 1 yoctoNEAR | not measured | Merchant account (gas); merchant tUSDC (funds) |
| `ft_transfer_call` pool funding | relayed | 4 | 8.05 | 0.0007152 to 0.0007157 | 1 yoctoNEAR | not measured | Sponsor relay (gas); merchant tUSDC (funds) |
| `create_program` | direct (merchant) | 3 | 2.92 to 3.01 | 0.0002694 to 0.0002785 | 1 NEAR | not measured for the demo program | Merchant: 1 NEAR deposit, credited to program storage balance minus storage cost |
| `create_program` | relayed | 4 | 4.00 | 0.0003543 to 0.0003550 | 0.4 NEAR | 646 bytes = 0.00646 NEAR (E2E program, 1 sampled) | Sponsor relay (gas); merchant: 0.4 NEAR deposit |
| `add_location` | direct (merchant) | 1 | 2.59 | 0.0002367 | 0 | not measured | Merchant account (gas); program storage balance |
| `add_cashier` | direct (merchant) | 3 | 2.67 to 2.73 | 0.0002449 to 0.0002504 | 0 | 76 bytes = 0.00076 NEAR (1 sampled, relayed) | Merchant account (gas); program storage balance |
| `add_cashier` | relayed | 4 | 3.70 | 0.0003251 to 0.0003253 | 0 | 76 bytes = 0.00076 NEAR | Sponsor relay (gas); program storage balance |
| `add_manager` | relayed | 4 | 3.70 | 0.0003252 to 0.0003254 | 0 | 77 bytes = 0.00077 NEAR | Sponsor relay (gas); program storage balance |
| `remove_cashier` | relayed | 4 | 3.54 | 0.0003094 to 0.0003096 | 0 | not measured | Sponsor relay |
| `add_boost` | direct (merchant) | 1 | 2.73 | 0.0002507 | 0 | 25 bytes = 0.00025 NEAR (1 sampled, relayed) | Merchant account (gas); program storage balance |
| `add_boost` | relayed | 4 | 3.64 to 3.65 | 0.0003199 to 0.0003201 | 0 | 25 bytes = 0.00025 NEAR | Sponsor relay (gas); program storage balance |
| `deposit_storage` | direct (merchant) | 1 | 2.47 | 0.0002246 | 3 NEAR | 0 bytes | Merchant: 3 NEAR deposit credited to program storage balance |
| Market `list_pass` | relayed | 8 | 4.03 | 0.0003585 to 0.0003588 | 0 | 237 bytes = 0.00237 NEAR (1 sampled) | Sponsor relay (gas); program storage balance |
| Market buy (`ft_transfer_call` with `buy` msg, includes NFT transfer, royalty payout to merchant and seller payout in tUSDC) | relayed | 9 | 19.42 to 19.44 | 0.0017638 to 0.0017654 | 1 yoctoNEAR | 0 bytes (NFT changes owner) | Sponsor relay (gas); buyer pays the tUSDC price |
| tUSDC `faucet` (test token) | direct (merchant) | 5 | 2.22 to 2.28 | 0.0002001 to 0.0002060 | 0 | not measured | Merchant account |
| tUSDC `faucet` | relayed | 2 | 3.26 to 3.27 | 0.0002818 to 0.0002819 | 0 | not measured | Sponsor relay |
| Delete account with beneficiary (cleanup of the temporary account) | direct | 1 | 0.96 | 0.0000511 | 0 | none | Deleted account |

### Market buy receipt breakdown (one sample)
Outer delegate transaction 0.513 Tgas. Then, in order: tUSDC `ft_transfer_call` 2.66 Tgas, `fairly` `ft_on_transfer` 5.73 Tgas, tUSDC payout `ft_transfer` to merchant 1.84 Tgas, `fairly` resolve 1.65 Tgas, tUSDC payout to seller 1.85 Tgas, `fairly` resolve 1.62 Tgas, tUSDC call 1.26 Tgas, plus 0.223 Tgas gas refund receipts to the sponsor. Total 19.43 Tgas.

### NFT card storage
- One `issue_pass` adds 820 bytes of `fairly` state. At 1e19 yocto per byte this is 8.2e21 yocto = 0.00820 NEAR per card.
- The contract deducts this amount from the program storage balance of the merchant (`charge_program_storage`), so the NEAR is locked on the `fairly` account and funded by the merchant deposit.

### Why creating an account burns 0.0071 NEAR
- The measured burn (0.0071150 NEAR) is about ten times the gas price of the 8.57 Tgas shown (8.57 Tgas x 1e8 yocto = 0.000857 NEAR).
- NEAR docs state that creating an account (including an implicit account by transfer) costs a fixed 0.007 NEAR that is burned, charged by making the gas refund smaller, and that it is not gas: https://docs.near.org/protocol/transactions/gas . Nearcore documents that a transfer to an implicit account costs the transfer fee plus the create-account and add-full-access-key fees: https://nomicon.io/GenesisConfig/RuntimeFeeConfig/ActionCreationConfig .
- The measured value is 0.007 NEAR plus about 0.000115 NEAR of ordinary gas on the other receipts, which is consistent with that rule. The exact split was not decomposed receipt by receipt.
- The charge does not depend on the deposit, so lowering the funding amount does not change it.

### Customer account funding after D-045
- Measured on 8 accounts funded with 0.005 NEAR: a new account with one full-access key uses 182 bytes of storage (100 bytes account record plus 82 bytes for the key). An account that also added a recovery key used 264 bytes. Balance stayed 0.005 NEAR because every customer action is relayed.
- Each additional full-access key adds 82 bytes = 0.00082 NEAR. Locked NEAR for 4 keys (browser, recovery, NEAR Auth, shortcut) = 428 bytes = 0.00428 NEAR.

## Sponsor account top-up (temporary account via the faucet)
- Account created through the near-cli faucet sponsor service: `fairly-topup-20261113.testnet`. Creation transaction `FkHTG4rc6sTEiXPEfBXAmPQ2MRWduC8exbsdvUKTVS5N`.
- The account was deleted with `sponsor-ayxv4.testnet` as beneficiary. Delete transaction `FLvGzpQFhwLFvghA349cuhgNbksJ7gQRDVLxLdbjNWwF` (0.958 Tgas, 0.0000511097 NEAR burnt, paid by the temporary account). The temporary account no longer exists (`UNKNOWN_ACCOUNT`).
- Sponsor balance before: 3.2786503843 NEAR (`3278650384296303899999932` yocto).
- Sponsor balance after: 13.2783692809 NEAR (`13278369280946303899999932` yocto). Net change: +9.9997188967 NEAR.

## Not measured
No recent transaction existed, and none was created because each would move funds or require a new flow:
- `cancel_listing`, `update_location`, `remove_location`, `remove_manager`, `set_boost_enabled`, `remove_boost`, `set_paused`, `update_program`, `withdraw_pool`, `withdraw_refund`, `sweep_expired`, `settle_pending`.
- Storage delta for `add_location`, `remove_cashier`, and the demo-program `create_program`.
- Funding a merchant account with `MERCHANT_START_NEAR` (default 0.5 NEAR): no transaction with that amount was found. The measured transfer to a non-existing account (above) is the closest sample.
