# TOK: tUSDC test stablecoin (implemented)

## Requirements
- **TOK-001** `tusdc` MUST implement NEP-141 and NEP-148 metadata with symbol `tUSDC`, name `Test USDC (Fairly demo)`, 6 decimals.
- **TOK-002** `faucet(amount)` MUST mint up to 1,000 tUSDC per call to the caller, registering storage if needed.
- **TOK-003** The token MUST be deployed only on testnet and labeled as test money in every UI where it appears.
- **TOK-005** `ft_transfer` and `ft_transfer_call` MUST register the receiver automatically (test token only), so payouts never fail for unregistered accounts.
- **TOK-004** `fairly` MUST be registered for storage on `tusdc` at deploy time.
