# Deskyrin

Updated: **2026-09-08T09:27:35.710Z**

Update status: **complete**

All values are generated deterministically from the cited public sources; this report contains no AI-generated analysis.

## Data Coverage

Coverage incidents describe missing observations; they are not network incidents and are never filled with synthetic values.

### collection-gap-2026-08-26

State: **resolved** · 2026-08-26T17:57:44.334Z → 2026-08-29T15:10:55.812Z

Affected observations: TPS, Non-vote TPS, Slot time, Validator snapshots and commission tracking, Sampled median transaction fee.

Reason: Scheduled collection did not publish during part of this interval, and the first subsequent publication was rejected by canonical commission-history ordering validation.

Disclosure: **No values were interpolated. Provider-dated histories may be retrieved after recovery.**


## Network Performance

| Metric | Value | Observation | Status |
|---|---:|---|---|
| TPS (all transactions) | 3,307.95 | 2026-09-08T09:26:54.223Z | Fresh |
| Non-vote TPS | 1,175.2 | 2026-09-08T09:26:54.223Z | Fresh |
| Slot time | 315.13 ms | 2026-09-08T09:26:54.223Z | Fresh |
| Block height | 423,348,034 | 2026-09-08T09:26:54.223Z | Fresh |
| Epoch progress | 79.61% (epoch 1030) | 2026-09-08T09:26:54.223Z | Fresh |

## Validator Status

Status: **Fresh**. Active and delinquent counts include only vote accounts with positive activated stake; delinquency uses the RPC 128-slot window.

| Metric | Value |
|---|---:|
| Active validators | 673 |
| Delinquent validators | 13 |
| Delinquent activated stake | 0.12% |
| Top 10 stake share | 24.19% |

### Top validators by activated stake

| Rank | Vote account | Status | Stake (SOL) | Share | Commission |
|---:|---|---|---:|---:|---:|
| 1 | `CcaHc2L43ZWjwCHART3oZoJvHLAe9hzT2DJNUpBzoTN1` | active | 17,438,540.52 | 3.97% | 7% |
| 2 | `he1iusunGwqrNtafDtLdhsUQDFvo13z9sUa36PauBtk` | active | 16,336,963.68 | 3.72% | 0% |
| 3 | `3N7s9zXMZ4QqvHQR15t5GNHyqc89KduzMP7423eWiD5g` | active | 12,517,399.06 | 2.85% | 0% |
| 4 | `CatzoSMUkTRidT5DwBxAC2pEtnwMBTpkCepHkFgZDiqb` | active | 11,397,824.23 | 2.59% | 5% |
| 5 | `8GbwASqdpw4dVcwbWUxbHXMrjyQx2aKkoBR5H1GJF8iD` | active | 9,564,411.53 | 2.18% | 0% |
| 6 | `26pV97Ce83ZQ6Kz9XT4td8tdoUFPTng8Fb8gPyc53dJx` | active | 9,181,909.19 | 2.09% | 7% |
| 7 | `51JBzSTU5rAM8gLAVQKgp4WoZerQcSqWC7BitBzgUNAm` | active | 9,038,443.43 | 2.06% | 10% |
| 8 | `9QU2QSxhb24FUX3Tu2FpczXjpK3VYrvRudywSZaM29mF` | active | 7,384,460.72 | 1.68% | 7% |
| 9 | `CvSb7wdQAFpHuSpTYTJnX5SYH4hCfQ9VuGnqrKaKwycB` | active | 6,858,928.88 | 1.56% | 5% |
| 10 | `DumiCKHVqoCQKD8roLApzR5Fit8qGV5fVQsJV9sTZk4a` | active | 6,595,420.72 | 1.5% | 0% |

### Commission tracking

A row means the commission differed between two successful validator snapshots. The interval is evidence of when the change could have occurred, not an exact change timestamp.

| Possible change window | Vote account | Previous | New |
|---|---|---:|---:|
| 2026-09-07T21:24:58.901Z → 2026-09-07T22:24:32.096Z | `QodirbUG8AZQBWpHhPJPfjj1xg4AaQUZCVVtwT8YfPi` | 0% | 100% |
| 2026-09-07T21:24:58.901Z → 2026-09-07T22:24:32.096Z | `5AC692spnjbegP7ttCXJEzUe8S81sLYsqJd8Ae6Zv1xU` | 0% | 100% |
| 2026-09-07T12:32:38.106Z → 2026-09-07T13:28:15.755Z | `sfo5vA1fFdPRsvqd8qdePtTnK97Qj6Jj3GupEzmNPjJ` | 3% | 4% |
| 2026-09-07T11:26:33.267Z → 2026-09-07T12:32:38.106Z | `5XGMWvqZSBk1fktPtxbwaMF5dhkbrtchpwd4xiXG9q8u` | 0% | 5% |
| 2026-09-07T02:25:54.972Z → 2026-09-07T03:26:37.895Z | `QodirbUG8AZQBWpHhPJPfjj1xg4AaQUZCVVtwT8YfPi` | 100% | 0% |
| 2026-09-07T02:25:54.972Z → 2026-09-07T03:26:37.895Z | `5AC692spnjbegP7ttCXJEzUe8S81sLYsqJd8Ae6Zv1xU` | 100% | 0% |
| 2026-09-06T06:29:18.136Z → 2026-09-06T08:25:53.928Z | `QodirbUG8AZQBWpHhPJPfjj1xg4AaQUZCVVtwT8YfPi` | 0% | 100% |
| 2026-09-06T06:29:18.136Z → 2026-09-06T08:25:53.928Z | `5AC692spnjbegP7ttCXJEzUe8S81sLYsqJd8Ae6Zv1xU` | 0% | 100% |
| 2026-09-05T12:28:16.071Z → 2026-09-05T14:22:37.096Z | `QodirbUG8AZQBWpHhPJPfjj1xg4AaQUZCVVtwT8YfPi` | 100% | 0% |
| 2026-09-05T12:28:16.071Z → 2026-09-05T14:22:37.096Z | `5AC692spnjbegP7ttCXJEzUe8S81sLYsqJd8Ae6Zv1xU` | 100% | 0% |
| 2026-09-05T09:23:05.026Z → 2026-09-05T10:22:49.177Z | `spuraUaJeFZfdbgXpJhgqEHFAXatfrMArARXhXioxKd` | 6% | 100% |
| 2026-09-05T06:28:27.929Z → 2026-09-05T08:24:42.928Z | `SWDV7HwnwKq2QtJtGzCUPDeswekexTYL9cRPYmjWqjY` | 5% | 100% |
| 2026-09-04T17:22:52.139Z → 2026-09-04T20:24:29.666Z | `QodirbUG8AZQBWpHhPJPfjj1xg4AaQUZCVVtwT8YfPi` | 0% | 100% |
| 2026-09-04T17:22:52.139Z → 2026-09-04T20:24:29.666Z | `5AC692spnjbegP7ttCXJEzUe8S81sLYsqJd8Ae6Zv1xU` | 0% | 100% |
| 2026-09-03T22:28:51.345Z → 2026-09-04T00:33:58.394Z | `QodirbUG8AZQBWpHhPJPfjj1xg4AaQUZCVVtwT8YfPi` | 100% | 0% |
| 2026-09-03T22:28:51.345Z → 2026-09-04T00:33:58.394Z | `5AC692spnjbegP7ttCXJEzUe8S81sLYsqJd8Ae6Zv1xU` | 100% | 0% |
| 2026-09-03T00:35:26.919Z → 2026-09-03T05:07:26.260Z | `QodirbUG8AZQBWpHhPJPfjj1xg4AaQUZCVVtwT8YfPi` | 0% | 100% |
| 2026-09-02T09:26:05.648Z → 2026-09-02T10:26:53.856Z | `QodirbUG8AZQBWpHhPJPfjj1xg4AaQUZCVVtwT8YfPi` | 100% | 0% |
| 2026-09-01T14:26:43.835Z → 2026-09-01T15:44:28.918Z | `QodirbUG8AZQBWpHhPJPfjj1xg4AaQUZCVVtwT8YfPi` | 0% | 100% |
| 2026-09-01T12:31:14.922Z → 2026-09-01T14:26:43.835Z | `5AC692spnjbegP7ttCXJEzUe8S81sLYsqJd8Ae6Zv1xU` | 0% | 100% |

## Economic Indicators

| Indicator | Value | Data through | Status |
|---|---:|---|---|
| SOL price | $103.06 (-1.8% / 24h) | 2026-09-08T09:23:50.000Z | Fresh |
| Stablecoin supply (USD-equivalent circulating) | $16.74B | 2026-09-07 | Fresh |
| DEX volume (completed UTC day) | $1.88B | 2026-09-07 | Fresh |
| Real Economic Value (REV) | 7,252.68 SOL | 2026-09-06 | Fresh |
| Median transaction fee | 5,000 lamports | 2026-09-08T09:26:54.223Z | Fresh |
| TVL alert input | $5.99B (+1.46% day/day) | 2026-09-07 | Fresh |

REV components for 2026-09-06: transaction fees 6,159.88 SOL (median of Allium and Dune) + gross Jito tips 1,092.81 SOL.

### Independent market-price evidence

These comparison observations are retained separately and are not averaged into the headline SOL price or its 24-hour alert.

| Series | Value | Data through | Status |
|---|---:|---|---|
| CoinGecko keyless comparison | $103.12 | 2026-09-08T09:25:20.000Z | Fresh |
| Coinbase Exchange SOL-USD daily close | $103.79 | 2026-09-07 | Fresh |

## Provider Comparison Evidence

Status: **Fresh**. These contributor-labelled series are delivered through the Solana Foundation Data endpoint; they are not separate Deskyrin HTTP collectors or source-health records.

Provider definitions can differ materially. The values are shown side by side, never averaged into the canonical headline metrics unless an existing methodology explicitly says otherwise.

| Metric | Provider | Data through | Retained points |
|---|---|---|---:|
| SOL Price (USD) | Allium | 2026-09-07 | 90 |
| SOL Price (USD) | Dune | 2026-09-07 | 90 |
| SOL Price (USD) | DeFiLlama | 2026-09-07 | 90 |
| SOL Price (USD) | Artemis | 2026-09-07 | 90 |
| SOL Price (USD) | Birdeye | 2026-09-07 | 90 |
| SOL Price (USD) | Blockworks | 2026-09-06 | 89 |
| SOL Price (USD) | DexPaprika | 2026-09-07 | 74 |
| SOL Price (USD) | Token Terminal | 2026-09-06 | 89 |
| SOL Price (USD) | Top Ledger | 2026-09-07 | 90 |
| SOL Price (USD) | Uniblock | 2026-09-07 | 90 |
| Fees (SOL) | Allium | 2026-09-06 | 89 |
| Fees (SOL) | Dune | 2026-09-07 | 90 |
| Fees (SOL) | Artemis | 2026-09-06 | 89 |
| Fees (SOL) | Blockworks | 2026-09-06 | 89 |
| Fees (SOL) | Solscan | 2026-09-07 | 90 |
| Fee Payers (Count) | Allium | 2026-09-06 | 89 |
| Fee Payers (Count) | Dune | 2026-09-07 | 90 |
| Fee Payers (Count) | Artemis | 2026-09-06 | 89 |
| Fee Payers (Count) | Blockworks | 2026-09-06 | 89 |
| Fee Payers (Count) | Token Terminal | 2026-09-06 | 89 |
| Fee Payers (Count) | Top Ledger | 2026-09-06 | 89 |
| DEX Volume (USD) | Allium | 2026-09-06 | 89 |
| DEX Volume (USD) | Dune | 2026-09-07 | 90 |
| DEX Volume (USD) | DeFiLlama | 2026-09-07 | 90 |
| DEX Volume (USD) | Artemis | 2026-09-06 | 89 |
| DEX Volume (USD) | Birdeye | 2026-09-07 | 90 |
| DEX Volume (USD) | Blockworks | 2026-09-06 | 89 |
| DEX Volume (USD) | DexPaprika | 2026-09-07 | 74 |
| DEX Volume (USD) | Solscan | 2026-09-07 | 90 |
| DEX Volume (USD) | Token Terminal | 2026-09-06 | 89 |
| DEX Volume (USD) | Top Ledger | 2026-09-06 | 89 |

## Ecosystem Growth

| Metric | Value | Observation | Status |
|---|---:|---|---|
| Tokenized-market spot volume (trailing 30d) | $1.4B | 2026-09-08T08:28:20.369Z | Fresh |
| Tokenized-equity spot volume (trailing 30d) | $1.05B | 2026-09-08T08:28:20.369Z | Fresh |
| Daily active addresses (initiating signers/fee payers) | 2,102,201.5 | 2026-09-06 | Fresh |

Tokens.xyz coverage: 360 of 439 indexed tokenized-market assets and 334 of 394 equities have accepted 30-day volume provenance. Excluded assets: 10 RWA.xyz-derived, 11 unrecognized provenance, and 58 without a 30-day value.

### Tokenized market category breakdown

This is a current cross-sectional breakdown of the same provenance-filtered trailing-30-day spot-volume total.

| Category | Indexed assets | Covered assets | Trailing 30d spot volume |
|---|---:|---:|---:|
| Equities | 394 | 334 | $1.05B |
| ETFs | 25 | 17 | $233.28M |
| Commodities | 5 | 4 | $120.24M |
| Other RWA | 15 | 5 | $3.08K |

### Leading covered tokenized assets

Ranked by accepted trailing-30-day spot volume; excluded provenance never enters this table.

| Rank | Asset | Category | Volume source | Trailing 30d spot volume |
|---:|---|---|---|---:|
| 1 | SPY — SP500 | ETFs | birdeye | $186.35M |
| 2 | CRCL — Circle | Equities | birdeye | $167.81M |
| 3 | SPCX — SpaceX | Equities | birdeye | $166.34M |
| 4 | SKHY — SK Hynix | Equities | clickhouse_trades | $112.99M |
| 5 | MU — Micron Technology | Equities | clickhouse_trades | $94.13M |
| 6 | GLD — Gold | Commodities | birdeye | $91.26M |
| 7 | ANTHROPIC — Anthropic | Equities | birdeye | $77.6M |
| 8 | OPENAI — OpenAI | Equities | birdeye | $66.57M |
| 9 | NVDA — NVIDIA | Equities | birdeye | $44.02M |
| 10 | MSTR — MicroStrategy | Equities | birdeye | $41.48M |

### Retired RWA.xyz transfer-volume evidence

The legacy trailing-30-day transfer-volume series ended at 2026-08-26T06:02:39.551Z. It remains available as historical evidence and is not joined to Tokens.xyz spot-volume history.

Final retained values: $3.21B across tokenized assets and $2.14B across tokenized equities.

### Upcoming upgrades and developments

- [Alpenglow](https://solana.com/upgrades/alpenglow) — In Development, Agave 4.3. Faster finality with Solana's next consensus protocol ([SIMD-0326](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0326-alpenglow.md), [SIMD-0337](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0337-parent-ready-update-marker.md), [SIMD-0357](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0357-alpenglow_validator_admission_ticket.md), [SIMD-0384](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0384-alpenglow-migration.md), [SIMD-0387](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0387-bls-pubkey-management-in-vote-account.md))
- [New Cryptography Schemes](https://solana.com/upgrades/new-cryptography) — In Development, Agave 4.3. Native syscalls for BN254 G2 and BLS12-381 curve operations ([SIMD-0302](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0302-bn254-g2-syscalls.md), [SIMD-0388](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0388-bls12-381-syscalls.md))
- [Reduced Slot Times](https://solana.com/upgrades/reduced-slot-times) — Pending Feature Activation, Agave 4.2. Cutting slot times from 400ms to 200ms ([SIMD-0525](https://github.com/solana-foundation/solana-improvement-documents/pull/525), [SIMD-0498](https://github.com/solana-foundation/solana-improvement-documents/pull/498))
- [Reduced Rent](https://solana.com/upgrades/reduced-rent) — Partially Activated, Agave 4.2. Cutting the cost of on-chain storage by 90% ([SIMD-0437](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0437-incremental-rent-reduction.md), [SIMD-0392](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0392-rent-increase-adaptations.md))
- [Larger Transaction Sizes](https://solana.com/upgrades/larger-transaction-sizes) — Pending Feature Activation, Agave 4.2. Raising the maximum transaction size from 1232 to 4096 bytes ([SIMD-0296](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0296-larger-transactions.md), [SIMD-0385](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0385-transaction-v1.md))

### Ecosystem and Community News

- 2026-09-07 — [# How BitRobot Crowdsources Real-World Data for Embodied AI, with Jonathan Victor](https://solana.com/news/bits-to-bricks-bitrobot-jonathan-victor)
- 2026-09-04 — [Solana Ecosystem Roundup: August 2026](https://solana.com/news/solana-ecosystem-roundup-august-2026)
- 2026-09-03 — [Payment Channels: 1 Million Payments Per Second](https://solana.com/news/payment-channels-1-million-payments-per-second)
- 2026-09-03 — [How to Reclaim Excess SOL After Rent Reduction](https://solana.com/news/how-to-reclaim-excess-sol-after-rent-reduction)
- 2026-09-02 — [The Token Supercycle: Everything of Value is Becoming Programmable](https://solana.com/news/the-token-supercycle-oped)
- 2026-09-01 — [Webinar Recap: Cross-Border Payments in Latin America](https://solana.com/news/webinar-recap-cross-border-payments-in-latin-america)
- 2026-08-28 — [Solana Changelog: August 27, 2026](https://solana.com/news/solana-changelog-august-27-2026)
- 2026-08-27 — [The Token Supercycle Is Here: Solana Brings Breakpoint 2026 to London](https://solana.com/news/breakpoint-2026-london-speakers)

### Recent Agave releases

Status: **Fresh**. Published releases and prereleases are kept separate from upcoming Solana upgrade cards.

- 2026-09-04 — [Release v4.3.0-rc.0](https://github.com/anza-xyz/agave/releases/tag/v4.3.0-rc.0) — `v4.3.0-rc.0` (prerelease)
- 2026-09-03 — [Release v4.4.0-alpha.3](https://github.com/anza-xyz/agave/releases/tag/v4.4.0-alpha.3) — `v4.4.0-alpha.3` (prerelease)
- 2026-08-28 — [Release v4.3.0-beta.3](https://github.com/anza-xyz/agave/releases/tag/v4.3.0-beta.3) — `v4.3.0-beta.3` (prerelease)
- 2026-08-28 — [Release v4.2.2](https://github.com/anza-xyz/agave/releases/tag/v4.2.2) — `v4.2.2`
- 2026-08-28 — [Release v4.4.0-alpha.2](https://github.com/anza-xyz/agave/releases/tag/v4.4.0-alpha.2) — `v4.4.0-alpha.2` (prerelease)
- 2026-08-21 — [Release v4.3.0-beta.2](https://github.com/anza-xyz/agave/releases/tag/v4.3.0-beta.2) — `v4.3.0-beta.2` (prerelease)
- 2026-08-21 — [Release v4.3.0-beta.1](https://github.com/anza-xyz/agave/releases/tag/v4.3.0-beta.1) — `v4.3.0-beta.1` (prerelease)
- 2026-08-14 — [Release v4.3.0-beta.0](https://github.com/anza-xyz/agave/releases/tag/v4.3.0-beta.0) — `v4.3.0-beta.0` (prerelease)
- 2026-08-13 — [Release v4.2.1](https://github.com/anza-xyz/agave/releases/tag/v4.2.1) — `v4.2.1`
- 2026-08-07 — [Release v4.2.0](https://github.com/anza-xyz/agave/releases/tag/v4.2.0) — `v4.2.0`

## Network Observability

Official Solana Status: **All Systems Operational** (none). Observed 2026-09-08T09:26:54.223Z; provider page updated 2026-09-08T08:59:01.683Z.

8 of 8 retained components report operational.

Solana Status incidents and Deskyrin collection gaps are independent records: the absence of an official network incident does not imply that every Deskyrin observation was collected.

### Recent official incidents

| Incident | Impact | State | Started | Resolved |
|---|---|---|---|---|
| [mb-020624](https://stspg.io/g277l7fp0gw3) | critical | resolved | 2024-02-06T10:22:42.049Z | 2024-02-06T15:09:24.842Z |
| [Cluster Instability](https://stspg.io/p06pkrtw4dnm) | critical | resolved | 2023-02-25T06:00:38.000Z | 2023-02-26T02:09:04.115Z |
| [Public Endpoints and Explorer offline](https://stspg.io/qvn8bctr9vvn) | maintenance | resolved | 2023-01-08T04:53:04.681Z | 2023-01-08T07:01:17.674Z |
| [Degraded Performance](https://stspg.io/kvvt5cs3g0zx) | critical | resolved | 2022-09-30T23:00:59.985Z | 2022-10-01T07:06:06.661Z |
| [Mainnet Beta Outage](https://stspg.io/rgwjg1x04yyx) | critical | resolved | 2022-06-01T19:32:32.000Z | 2022-06-01T21:06:03.000Z |
| [Degraded performance](https://stspg.io/z5yhvkl6lk2d) | minor | resolved | 2022-05-31T13:52:38.313Z | 2022-05-31T18:01:56.379Z |
| [Degraded performance](https://stspg.io/p2ld0cg4h546) | minor | resolved | 2022-05-29T18:38:54.936Z | 2022-05-29T21:05:48.215Z |
| [Degraded performance](https://stspg.io/sglw67c9b3pd) | minor | resolved | 2022-05-28T15:54:28.799Z | 2022-05-28T18:50:21.623Z |
| [Degraded performance](https://stspg.io/c3wln44nrdbb) | minor | resolved | 2022-05-26T22:34:59.255Z | 2022-05-26T23:11:36.189Z |
| [Mainnet Beta Clock Drift](https://stspg.io/x01f1npqvwgv) | none | resolved | 2022-05-26T03:34:35.000Z | 2022-06-06T16:32:07.877Z |

## Alerts / notable changes

No active warning met its full threshold and freshness requirements.


| Check | State | Current / reason |
|---|---|---|
| tps-change | normal | -5.2% |
| slow-slot-time | normal | -0.21% |
| high-validator-delinquency | normal | 0.12% |
| large-tvl-change | normal | +1.46% |
| large-sol-price-move | normal | -1.8% |

## Data Sources and Freshness

| Source | State | Last success | Data through |
|---|---|---|---|
| [Solana JSON-RPC](https://api.mainnet-beta.solana.com) | fresh | 2026-09-08T09:26:54.223Z | 2026-09-08T09:26:54.223Z |
| [DefiLlama Coins API](https://coins.llama.fi/prices/current/coingecko:solana) | fresh | 2026-09-08T09:26:54.223Z | 2026-09-08T09:23:50.000Z |
| [CoinGecko Keyless API](https://api.coingecko.com/api/v3/simple/price) | fresh | 2026-09-08T09:26:54.223Z | 2026-09-08T09:25:20.000Z |
| [Coinbase Exchange SOL-USD](https://api.exchange.coinbase.com/products/SOL-USD/candles) | fresh | 2026-09-08T08:28:20.369Z | 2026-09-07 |
| [DefiLlama Chain TVL](https://api.llama.fi/v2/historicalChainTvl/Solana) | fresh | 2026-09-08T08:28:20.369Z | 2026-09-07 |
| [DefiLlama Stablecoins](https://stablecoins.llama.fi/stablecoincharts/Solana) | fresh | 2026-09-08T08:28:20.369Z | 2026-09-07 |
| [DefiLlama DEX Dimensions](https://api.llama.fi/overview/dexs/Solana?excludeTotalDataChart=false&excludeTotalDataChartBreakdown=true) | fresh | 2026-09-08T08:28:20.369Z | 2026-09-07 |
| [Solana Foundation Data](https://solana.com/api/databricks/data?days=120) | fresh | 2026-09-08T08:28:20.369Z | 2026-09-08T07:50:17.284Z |
| [Jito Daily MEV Rewards](https://kobe.mainnet.jito.network/api/v1/daily_mev_rewards) | fresh | 2026-09-08T08:28:20.369Z | 2026-09-07 |
| [Tokens.xyz Curated Markets](https://www.tokens.xyz/api/v1/assets/curated?groupBy=asset&limit=500&primaryVariantStrategy=liquidity) | fresh | 2026-09-08T08:28:20.369Z | 2026-09-08T08:28:20.369Z |
| [Solana News RSS](https://solana.com/news/rss.xml) | fresh | 2026-09-08T08:28:20.369Z | 2026-09-07T07:00:00.000Z |
| [Solana Upgrades Hub](https://solana.com/upgrades) | fresh | 2026-09-08T09:26:54.223Z | 2026-09-08T09:26:54.223Z |
| [Solana Status](https://status.solana.com/api/v2/summary.json) | fresh | 2026-09-08T09:26:54.223Z | 2026-09-08T09:26:54.223Z |
| [Agave Releases](https://api.github.com/repos/anza-xyz/agave/releases) | fresh | 2026-09-08T08:28:20.369Z | 2026-09-04T15:46:13.000Z |

Detailed definitions, windows, aggregation rules, and limitations are documented in [`methodology.md`](./methodology.md).
