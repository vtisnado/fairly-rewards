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
