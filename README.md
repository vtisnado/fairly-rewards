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
- **Keys stay on the device.** Customers, businesses, managers and counter devices each get their own NEAR key, created in their browser and kept in local storage. The server never receives a private key. A device or manager is connected by typing a short code that only carries its public account id.
- **Email for account recovery.** Customers and businesses can link an email with NEAR Auth so they can get back into their account on a new device. The email is handled by the NEAR Auth login (Auth0) and is used only to recover access. Fairly does not show it on cards, in the dashboard or on chain.
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
