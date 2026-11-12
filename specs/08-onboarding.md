# ONB: Customer accounts and sponsor (draft)

## Requirements
- **ONB-001** A first-time customer opening `/join/<slug>` MUST get an account without installing a wallet: the browser generates an ed25519 key pair and derives the implicit account id (D-011).
- **ONB-002** The key pair MUST be stored in browser storage and exportable as a recovery phrase/file from the customer screen.
- **ONB-003** `POST /api/sponsor` MUST fund a new implicit account with a small amount of testnet NEAR (default 0.05) and register it on `tusdc`. It MUST rate-limit by IP and refuse accounts that already exist.
- **ONB-004** The sponsor private key MUST come from environment variables only.
- **ONB-005** After onboarding, the screen MUST show a QR code with the customer's account id for the cashier to issue a pass.
- **ONB-006** Merchants and cashiers MUST sign in with NEAR Wallet Selector (testnet), e.g. MyNearWallet or Meteor.
- **ONB-008** `POST /api/join` MUST create and fund the customer account (ONB-003) and, only for the demo program, issue the pass with the demo cashier key so judges can try the flow alone. For other programs the cashier issues the pass (PASS-002).
- **ONB-009** The customer screen MUST update within 3 seconds of a change to the pass (NFR-008) through real-time events (EVT-004) and animate balance changes.
- **ONB-010** Customer actions (redeem, claim perk, list, cancel listing, transfer) MUST be signed in the browser as NEP-366 meta transactions and relayed by the sponsor through `POST /api/relay`, so customers never need NEAR for gas. The relay MUST only accept delegates whose receiver is the `fairly` contract, whose actions are function calls to those methods with at most 1 yoctoNEAR attached, and MUST rate-limit by IP.
- **ONB-007** (stretch) Email or social login MAY replace ONB-001 if a provider is verified to work on testnet.
- **ONB-011** A merchant without a wallet gets an implicit account created in the browser. The sponsor funds it with `MERCHANT_START_NEAR` (0.5 test NEAR by default, limited per client) so it can attach the program storage deposit. Every merchant action is a meta transaction relayed by the sponsor. The key can be downloaded and restored at `/business`.
- **ONB-012** The relay accepts only listed methods per receiver: customer and merchant methods on `fairly`, `faucet` and `ft_transfer_call` on `tusdc`, and a single transfer of at most 0.02 NEAR to an implicit account to create a device account. Each method has a maximum attached deposit.
