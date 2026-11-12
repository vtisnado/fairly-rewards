# NFR: Non-functional requirements (draft)

- **NFR-001 Security:** every privileged method checks the caller explicitly; errors use stable codes (`NOT_OWNER`, `NOT_CASHIER`, ...).
- **NFR-002 Security:** cross-contract calls (ft_transfer) MUST use callbacks that roll back state on failure.
- **NFR-011 Security:** if a tUSDC payout fails, the amount MUST be restored (redeem, withdraw) or credited to the receiver's refund balance, claimable with `withdraw_refund()`.
- **NFR-003 Security:** no secret ever in the repository; `.env.example` lists names only.
- **NFR-004 Events:** all state changes emit NEP-297 events, standard `fairly`, version `1.0.0`.
- **NFR-005 Storage:** callers attach storage deposits for data they create; unused deposit is refunded.
- **NFR-006 Tests:** each MUST requirement in contract specs has at least one unit or sandbox test named with its id.
- **NFR-007 Reproducibility:** a clean machine with Docker can build, test and run the app with commands from `DEVELOPMENT.md`.
- **NFR-008 Performance:** pass screen updates within 3 s of a purchase (polling or event refresh).
- **NFR-009 Accessibility:** WCAG AA contrast; works on a 375 px wide screen.
- **NFR-010 Availability:** hosted demo stays up until at least 2026-11-25.
- **NFR-012 Key storage:** browser keys (customer, business, manager, device) are WebCrypto Ed25519 keys created with `extractable: false` and kept in IndexedDB, so page scripts can sign but cannot read or copy them. Older keys in local storage move there on first load. Browsers without WebCrypto Ed25519 fall back to a stored key.
- **NFR-013 Backups:** a backup is a separate full-access recovery key added to the account on chain (`AddKey` through the relay) and downloaded once with the account id. It can be revoked without touching the device key. Restoring imports it as a non-extractable key.
- **NFR-014 Content security policy:** production pages send a CSP with `default-src 'self'`, hashed scripts only (no `unsafe-inline` scripts), `object-src 'none'` and an explicit list of network origins (RPC, Supabase, map tiles and search).
