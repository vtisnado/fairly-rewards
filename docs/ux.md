# UX and visual language

The product wins or loses on how easy it feels at a busy counter. Every screen has one job and one obvious next step.

## Principles
1. **One primary action per screen.** Secondary actions are text links or live in a sheet.
2. **No crypto words for customers.** Customers see "card", "balance", "level", "sell". Words like wallet, NFT, gas, token or sign do not appear in customer screens. The explorer link is labeled "See it on NEAR".
3. **Money is always in dollars.** Show `$1.25`, never base units. Test money is labeled once per screen with a small "Test money" note, not a banner on every element.
4. **Show progress, not rules.** "2 more visits to Silver" instead of tier tables.
5. **Feedback within one second.** Every tap shows a state change (pressed, loading, done). Purchases animate the balance counting up.
6. **Guide the first time only.** First-run tips appear as a 3-step guide the user can skip. They never come back after being dismissed (stored locally).
7. **Counter speed.** The cashier flow is two taps after the scan: amount, confirm.
8. **Forgiving.** Every destructive or money-moving action has a confirmation sheet that states the result in one sentence ("Your card goes to the buyer with its $12.40 balance").

## Built-in guidance
| Where | Guide |
|---|---|
| Customer, first open | 3 tips: "This is your card", "Show this code when you pay", "Your balance is real, use it or sell the card" |
| Merchant, create program | 3-step wizard with live card preview and a one-line explanation per field |
| Merchant dashboard, empty state | Checklist: fund rewards, add a cashier device, print the join poster |
| Cashier, first open | Overlay showing the scan area and the keypad |
| Every screen | "?" link opens a short help sheet for that screen |

## Visual language (v2, 2026-11-10)
References: playful fintech loyalty apps (bold color blocks, big numbers, rounded shapes, illustrated rewards).

| Token | Value | Use |
|---|---|---|
| Ink | `#17161A` | Text, dark surfaces, primary buttons |
| Ink 2 | `#232127` | Dark panels (counter tablet) |
| Cream | `#FFF6EC` | App background |
| Coral | `#FF6B57` | Brand, main call to action, key moments |
| Sun | `#FFE24A` | Money: balances, cashback chips |
| Lilac | `#C9C1FF` | Secondary blocks (sell, stats) |
| Mint | `#8FE0BF` | Success, confirmations |
| Bronze / Silver / Gold | `#E8894F` / `#AEB9C6` / `#FFC23D` | Card levels |

- **Type:** Outfit 400 to 900. Big, tight headlines (`tracking-tight`, weight 800 to 900). Balances in extra bold, tabular figures.
- **Shape (v3):** 14 to 18 px radius on blocks, 20 px on loyalty cards, 10 to 12 px on buttons. Pills only for short value chips. Every interactive element has a hover state.
- **Backoffice:** neutral data-first palette, see D-022.
- **Controls:** custom dropdowns and calendars only (D-027). Demo notes in parentheses with the `.demo` monospace style.
- **Coins:** diagonal shine, staggered per coin.
- **Color blocks over text:** each action or stat is a colored tile with an icon and 2 to 4 words.
- **Illustration:** inline SVG coins, stamps, level icons; floating loyalty cards. No stock 3D.
- **Motion:** floating cards and coins (5 s loop), count-up balances, "+$0.25" rising chip, confetti on level up and sales, reveal on scroll, marquee on the landing.
- **Icons:** filled, rounded, custom inline set in `design/assets/setup.js`. No emoji.

## Things we do not do
- No em dash or en dash characters in copy. Use a colon, comma or period.
- No gradient backgrounds, glassmorphism or neon accents.
- No rows of pills or tags as decoration; pills are for buttons and value chips only.
- No "sparkle" icons, rocket emoji or hype words (revolutionary, seamless, unleash, supercharge, next-gen).
- No superlatives in copy. State what happens: "Earn 5% back on every visit."
- No stock 3D blobs or abstract hero art.
- No walls of text: if a block needs more than two lines, it becomes a visual.

## Judge README requirements
- Screenshots of: customer card, cashier keypad, level-up moment, sell flow, merchant dashboard. Captured at 390 px wide (mobile) and placed in `docs/screenshots/`.
- Each step in "Try it" is one line: do X, see Y, with a screenshot where it helps.
- Short sections, no paragraph longer than three lines.
