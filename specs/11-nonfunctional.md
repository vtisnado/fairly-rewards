# NFR: Non-functional requirements (draft)

- **NFR-001 Security:** every privileged method checks the caller explicitly; errors use stable codes (`NOT_OWNER`, `NOT_CASHIER`, ...).
- **NFR-002 Security:** cross-contract calls (ft_transfer) MUST use callbacks that roll back state on failure.
- **NFR-003 Security:** no secret ever in the repository; `.env.example` lists names only.
- **NFR-004 Events:** all state changes emit NEP-297 events, standard `fairly`, version `1.0.0`.
- **NFR-005 Storage:** callers attach storage deposits for data they create; unused deposit is refunded.
- **NFR-006 Tests:** each MUST requirement in contract specs has at least one unit or sandbox test named with its id.
- **NFR-007 Reproducibility:** a clean machine with Docker can build, test and run the app with commands from `DEVELOPMENT.md`.
- **NFR-008 Performance:** pass screen updates within 3 s of a purchase (polling or event refresh).
- **NFR-009 Accessibility:** WCAG AA contrast; works on a 375 px wide screen.
- **NFR-010 Availability:** hosted demo stays up until at least 2026-11-25.
