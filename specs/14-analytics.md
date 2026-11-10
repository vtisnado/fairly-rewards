# ANA: Business analytics (draft)

Computed off-chain by an indexer over contract events (no personal data stored beyond account ids).

- **ANA-001** Headline metric: sales from members (sum of purchase amounts) for the selected range.
- **ANA-002** Secondary metrics: rewards paid, return on rewards (sales / rewards), repeat rate (members with 2+ visits within 14 days), active cards, average ticket.
- **ANA-003** Filters: date presets (7, 30, 90 days), custom date range, location, compare with previous period.
- **ANA-004** Breakdowns: by location, by purchase category (BUY-009), recent activity table.
- **ANA-005** Export the filtered report as CSV or PDF from a dropdown.
- **ANA-006** Members vs non-members comparisons need POS data and are out of scope. The dashboard shows new vs returning member visits instead.
- **ANA-007** New purchases MUST appear live: a toast with location, card, item and amount, and the row added to recent activity (polling or websocket from the indexer).
- **ANA-008** The chart MUST show a $ axis and a time axis: weekdays for 7 days, dates for up to 31 days, months for longer ranges.
- **ANA-009** "What members buy" MUST include an Other category.
- **ANA-011** Chart: straight segments, faint horizontal guides, value tooltip on hover, previous period drawn as a dashed line from its own data (not a scaled copy of the current line), round-number $ axis.
- **ANA-012** Recent activity and customer lists MUST paginate. Rows open a right-side detail panel with history (customers and devices).
- **ANA-010** Return on rewards MUST show the exact value (member sales per $1.00 of rewards) with a rounded multiple as a reference chip.
