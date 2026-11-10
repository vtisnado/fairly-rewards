# Who uses what

Three people touch Fairly, plus a buyer for resales. Each gets only the screens they need.

![Who uses what](../design/assets/roles.svg)

Text version:

```mermaid
flowchart LR
    subgraph Merchant["Merchant (owner) · laptop or phone"]
        M1[Create program]
        M2[Add rewards money]
        M3[Add cashier device]
        M4[Print join poster]
        M5[Dashboard]
    end

    subgraph Cashier["Cashier · counter tablet"]
        C1[Scan customer]
        C2[Enter amount]
        C3[Confirm redeem]
    end

    subgraph Customer["Customer · own phone, no app"]
        U1[Scan poster: get card]
        U2[Show card code]
        U3[See balance and level]
        U4[Use balance or perk]
        U5[Sell card]
    end

    Buyer["Buyer · market page"]

    M4 -- QR on counter --> U1
    U2 -- scanned by --> C1
    C1 --> C2
    C2 -- cashback lands on card --> U3
    U4 -- code shown to --> C3
    U5 -- listed --> Buyer
    Buyer -- royalty --> M5
```

| | Merchant | Cashier | Customer | Buyer |
|---|---|---|---|---|
| Device | Laptop or phone | Shared counter tablet | Own phone browser | Any browser |
| Sign-in | NEAR wallet (testnet) | Device key set up by merchant | None (card created in browser) | None for browsing |
| Sees | Program settings, rewards money, stats, devices | Scanner, keypad, today's total | Card, balance, level, perks, sell | Cards for sale, value inside, price |
| Cannot | n/a | Withdraw money, change settings, exceed daily limit | See other cards | n/a |
