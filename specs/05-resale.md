# SALE: Listing, buying, royalties (implemented)

## Requirements
- **SALE-001** The pass owner MUST be able to `list_pass(token_id, price)` with price > 0 in tUSDC base units, and `cancel_listing(token_id)`.
- **SALE-002** A buyer MUST purchase by calling `tusdc.ft_transfer_call(fairly, price, msg={"buy":"<token_id>"})`. Amount different from the price MUST be refunded in full.
- **SALE-003** On purchase, the contract MUST pay `price * royalty_bps / 10_000` to the program owner and the rest to the seller, then transfer the pass (with balance, tier and history) to the buyer and remove the listing.
- **SALE-004** A buyer who already holds a pass of the same program MUST be rejected with `ALREADY_HAS_PASS` and refunded.
- **SALE-005** A transfer of the pass by other means MUST invalidate any listing: `nft_transfer` removes it, and a listing whose seller is no longer the owner is ignored by views and cannot be bought.
- **SALE-006** `get_listings(slug?)` MUST be a public view returning token id, price, balance, tier and seller.
- **SALE-007** Each sale MUST emit a `sale` event with price, royalty and parties.
- **SALE-008** The UI MUST show "value inside" (balance) next to the price so buyers see what they get.
- **SALE-009** The market at `/market` lists every active listing with card art, balance, price and savings, filters by business type and sorts by savings, value, price or level. The buy dialog shows what the buyer pays, what the seller gets and the shop's royalty. Buying creates a browser account if needed, takes test dollars from the faucet and pays with `ft_transfer_call` through the relay. The list updates live from `listed`, `listing_cancelled` and `sale` events.
- **SALE-010** When a listed card is sold, the seller's card screen says so and shows what they received after the royalty.
- **SALE-011** The sell action lives on the card detail inside the wallet (UI-070). It lists exactly one card (one NFT) and leaves every other card in the wallet untouched. The royalty goes to the program owner of that card, as in SALE-003. A wallet with several cards can have several active listings, one per card.

## Acceptance
- Given royalty 5% and a Gold pass with 12 tUSDC listed at 10 tUSDC, when Juan buys it, then the merchant gets 0.50, Maria gets 9.50, and Juan owns the pass with 12 tUSDC balance.
- Given Juan sends 9 tUSDC, then all 9 are refunded and the listing remains.
