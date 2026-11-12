# Fairly: loyalty cards that hold real value

> Built at NEAR HACKATHON 2026. Tracks: **NFTs That Do Something** (`nfts`), **Real-World Money** (`realworld`).
> Status: in development. This README is completed before submission (see `TASKS.md` T4.1).

## The problem
Paper stamp cards and closed loyalty apps give customers points that are rarely redeemed, expire, and are worth nothing outside the store. Small merchants cannot afford loyalty platforms.

## What Fairly is
Every loyalty card is an NFT on NEAR that holds its own balance:
- The merchant funds a cashback pool in a stablecoin.
- Each purchase moves cashback into the customer's card.
- The card levels up (Bronze → Silver → Gold) and its artwork changes.
- The customer can spend the balance at the merchant or sell the card. Balance and tier move with it, and the merchant earns a royalty on every resale.

## How NEAR is used
- **NFT with a balance (NEP-171/177/199):** the card, not the wallet, owns the cashback.
- **Function-call access keys:** the cashier's device can only record purchases, capped per day. It cannot touch the pool.
- **Sponsored accounts:** customers get a card without installing a wallet or paying gas.
- **Testnet only:** "tUSDC" is a test stablecoin for this demo.

## Data and keys
- **Keys stay on the device and cannot be copied.** Customers, businesses, managers and counter devices each get their own NEAR key, created in their browser as a non-extractable WebCrypto key: the page can sign with it, but no script can read it. The server never receives a private key. A device or manager is connected by typing a short code that only carries its public account id, the same pattern TVs use to sign in.
- **Losing a phone or clearing the browser.** Balances and history live on chain and in the event log, not on the device. A backup file holds a separate recovery key added to the account; restoring it on a new browser brings the card or business back. A lost counter device is paused from the dashboard and a new one is paired.
- **Content security policy.** Production pages only run scripts from Fairly itself (hashed), and only talk to the NEAR RPC, Supabase and the map services.
- **Email for account recovery.** Customers and businesses can link an email or Google login with NEAR Auth (FastAuth) so they can get back into their account on a new device. NEAR Auth's MPC network holds a second key for the account; Fairly stores only that public key and the account id, never the email. In this testnet build it works on `http://localhost:3000`; the hosted demo is waiting for the NEAR Auth team to allow its domain.
- **What Fairly stores off chain.** Supabase keeps a copy of public contract events (for live screens and history), used balance codes, and short-lived pairing codes. All of it is testnet data.

## Try it
_To be completed (hosted demo link + "do X → see Y" steps)._

## Run locally
Requires only Docker. See `DEVELOPMENT.md`.

## Project documents
- Product: `docs/product.md`
- Architecture: `docs/architecture.md`
- Decisions: `docs/decisions.md`
- Specifications: `specs/`

## Built with
_To be completed: libraries and templates used._

## License
MIT: see `LICENSE`.
