# ONB: Customer accounts and sponsor (draft)

## Requirements
- **ONB-001** A first-time customer opening `/join/<slug>` MUST get an account without installing a wallet: the browser generates an ed25519 key pair and derives the implicit account id (D-011).
- **ONB-002** The key pair MUST be stored in browser storage and exportable as a recovery phrase/file from the customer screen.
- **ONB-003** `POST /api/sponsor` MUST fund a new implicit account with a small amount of testnet NEAR (default 0.05) and register it on `tusdc`. It MUST rate-limit by IP and refuse accounts that already exist.
- **ONB-004** The sponsor private key MUST come from environment variables only.
- **ONB-005** After onboarding, the screen MUST show a QR code with the customer's account id for the cashier to issue a pass.
- **ONB-006** Merchants and cashiers MUST sign in with NEAR Wallet Selector (testnet), e.g. MyNearWallet or Meteor.
- **ONB-007** (stretch) Email or social login MAY replace ONB-001 if a provider is verified to work on testnet.
