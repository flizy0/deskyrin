# Deskyrin

Updated: **2026-09-03T00:35:58.308Z**

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
| TPS (all transactions) | 3,679.64 | 2026-09-03T00:35:26.919Z | Fresh |
| Non-vote TPS | 1,525.25 | 2026-09-03T00:35:26.919Z | Fresh |
| Slot time | 313.15 ms | 2026-09-03T00:35:26.919Z | Fresh |
| Block height | 421,882,447 | 2026-09-03T00:35:26.919Z | Fresh |
| Epoch progress | 39.63% (epoch 1027) | 2026-09-03T00:35:26.919Z | Fresh |

## Validator Status

Status: **Fresh**. Active and delinquent counts include only vote accounts with positive activated stake; delinquency uses the RPC 128-slot window.

| Metric | Value |
|---|---:|
| Active validators | 675 |
| Delinquent validators | 18 |
| Delinquent activated stake | 0.05% |
| Top 10 stake share | 24.24% |

### Top validators by activated stake

| Rank | Vote account | Status | Stake (SOL) | Share | Commission |
|---:|---|---|---:|---:|---:|
| 1 | `CcaHc2L43ZWjwCHART3oZoJvHLAe9hzT2DJNUpBzoTN1` | active | 17,348,904.21 | 3.96% | 7% |
| 2 | `he1iusunGwqrNtafDtLdhsUQDFvo13z9sUa36PauBtk` | active | 16,325,736.95 | 3.72% | 0% |
| 3 | `3N7s9zXMZ4QqvHQR15t5GNHyqc89KduzMP7423eWiD5g` | active | 12,462,274.18 | 2.84% | 0% |
| 4 | `CatzoSMUkTRidT5DwBxAC2pEtnwMBTpkCepHkFgZDiqb` | active | 11,304,498.28 | 2.58% | 5% |
| 5 | `8GbwASqdpw4dVcwbWUxbHXMrjyQx2aKkoBR5H1GJF8iD` | active | 9,565,272.65 | 2.18% | 0% |
| 6 | `26pV97Ce83ZQ6Kz9XT4td8tdoUFPTng8Fb8gPyc53dJx` | active | 9,285,486.48 | 2.12% | 7% |
| 7 | `51JBzSTU5rAM8gLAVQKgp4WoZerQcSqWC7BitBzgUNAm` | active | 9,040,434.63 | 2.06% | 10% |
| 8 | `9QU2QSxhb24FUX3Tu2FpczXjpK3VYrvRudywSZaM29mF` | active | 7,220,140.25 | 1.65% | 7% |
| 9 | `CvSb7wdQAFpHuSpTYTJnX5SYH4hCfQ9VuGnqrKaKwycB` | active | 7,125,474.95 | 1.63% | 5% |
| 10 | `DumiCKHVqoCQKD8roLApzR5Fit8qGV5fVQsJV9sTZk4a` | active | 6,590,652.71 | 1.5% | 0% |

### Commission tracking

A row means the commission differed between two successful validator snapshots. The interval is evidence of when the change could have occurred, not an exact change timestamp.

| Possible change window | Vote account | Previous | New |
|---|---|---:|---:|
| 2026-09-02T09:26:05.648Z → 2026-09-02T10:26:53.856Z | `QodirbUG8AZQBWpHhPJPfjj1xg4AaQUZCVVtwT8YfPi` | 100% | 0% |
| 2026-09-01T14:26:43.835Z → 2026-09-01T15:44:28.918Z | `QodirbUG8AZQBWpHhPJPfjj1xg4AaQUZCVVtwT8YfPi` | 0% | 100% |
| 2026-09-01T12:31:14.922Z → 2026-09-01T14:26:43.835Z | `5AC692spnjbegP7ttCXJEzUe8S81sLYsqJd8Ae6Zv1xU` | 0% | 100% |
| 2026-09-01T06:31:50.497Z → 2026-09-01T08:28:15.514Z | `B48pw5uXH7gkCibuCBPE6nezKsCmYfFFwveCeMHpq4iv` | 0% | 5% |
| 2026-09-01T06:31:50.497Z → 2026-09-01T08:28:15.514Z | `5HScvYkTWL9iojhPv26xK7GqB7oBsj9A2qHCeNRFmdyG` | 0% | 5% |
| 2026-08-31T19:19:20.813Z → 2026-08-31T20:19:20.910Z | `QodirbUG8AZQBWpHhPJPfjj1xg4AaQUZCVVtwT8YfPi` | 100% | 0% |
| 2026-08-31T19:19:20.813Z → 2026-08-31T20:19:20.910Z | `5AC692spnjbegP7ttCXJEzUe8S81sLYsqJd8Ae6Zv1xU` | 100% | 0% |
| 2026-08-31T10:19:20.021Z → 2026-08-31T11:19:53.751Z | `H4QVPxS7napq3NEYxqLhxbKi9nJ8s56dD2EQZGsyZ3sb` | 4% | 5% |
| 2026-08-31T00:19:25.890Z → 2026-08-31T01:19:27.490Z | `QodirbUG8AZQBWpHhPJPfjj1xg4AaQUZCVVtwT8YfPi` | 0% | 100% |
| 2026-08-30T23:19:27.023Z → 2026-08-31T00:19:25.890Z | `5AC692spnjbegP7ttCXJEzUe8S81sLYsqJd8Ae6Zv1xU` | 0% | 100% |
| 2026-08-30T05:19:28.269Z → 2026-08-30T06:19:22.850Z | `QodirbUG8AZQBWpHhPJPfjj1xg4AaQUZCVVtwT8YfPi` | 100% | 0% |
| 2026-08-30T05:19:28.269Z → 2026-08-30T06:19:22.850Z | `5AC692spnjbegP7ttCXJEzUe8S81sLYsqJd8Ae6Zv1xU` | 100% | 0% |
| 2026-08-26T16:57:44.334Z → 2026-08-29T15:10:55.812Z | `qjUuLxWo29QCBr7ZQw4EPLkAtmjHS2ZdZpZcH9g7fRb` | 0% | 100% |
| 2026-08-26T16:57:44.334Z → 2026-08-29T15:10:55.812Z | `QXmsTYFK7YT2BpP2AnvXwuRpfwmsJZpovLcUqdSjoK1` | 0% | 100% |
| 2026-08-26T16:57:44.334Z → 2026-08-29T15:10:55.812Z | `Fy6zNoZ1eCPpQX3JXeQ9Yd1HW1BFL8rrFmDvYYDnuxjT` | 0% | 100% |
| 2026-08-26T16:57:44.334Z → 2026-08-29T15:10:55.812Z | `EATzgj3KL3NAkaSKv8JFXPJahGueMbvTdVZj4zD9nQiV` | 5% | 4% |
| 2026-08-26T16:57:44.334Z → 2026-08-29T15:10:55.812Z | `CP6mfD4Qc5AYrboXBAQeHMYj5x1UnYksDXRjG7DMkHH7` | 4% | 5% |
| 2026-08-26T16:57:44.334Z → 2026-08-29T15:10:55.812Z | `AYSvheimgwhpRHXossLqrTBDPwo4jHDQJ1UhMeAArTwH` | 0% | 100% |
| 2026-08-26T16:57:44.334Z → 2026-08-29T15:10:55.812Z | `53ANFYA6BCDzdtiEeWawm5bqsH1Qgmjog8oMo5N4o4wU` | 0% | 100% |
| 2026-08-26T16:57:44.334Z → 2026-08-29T15:10:55.812Z | `42XzJdJvr1qE7zdEnPQhV5PsN9eyAcR45SWpTrifW1JB` | 0% | 100% |

## Economic Indicators

| Indicator | Value | Data through | Status |
|---|---:|---|---|
| SOL price | $99.62 (-0.2% / 24h) | 2026-09-03T00:33:50.000Z | Fresh |
| Stablecoin supply (USD-equivalent circulating) | $15.97B | 2026-09-01 | Fresh |
| DEX volume (completed UTC day) | $2.17B | 2026-09-01 | Fresh |
| Real Economic Value (REV) | 10,925.58 SOL | 2026-09-01 | Fresh |
| Median transaction fee | 5,000 lamports | 2026-09-03T00:35:26.919Z | Fresh |
| TVL alert input | $5.98B (+3.4% day/day) | 2026-09-01 | Fresh |

REV components for 2026-09-01: transaction fees 9,031.08 SOL (median of Allium and Dune) + gross Jito tips 1,894.51 SOL.

### Independent market-price evidence

These comparison observations are retained separately and are not averaged into the headline SOL price or its 24-hour alert.

| Series | Value | Data through | Status |
|---|---:|---|---|
| CoinGecko keyless comparison | $99.66 | 2026-09-03T00:33:10.000Z | Fresh |
| Coinbase Exchange SOL-USD daily close | $99.94 | 2026-09-01 | Fresh |

## Provider Comparison Evidence

Status: **Fresh**. These contributor-labelled series are delivered through the Solana Foundation Data endpoint; they are not separate Deskyrin HTTP collectors or source-health records.

Provider definitions can differ materially. The values are shown side by side, never averaged into the canonical headline metrics unless an existing methodology explicitly says otherwise.

| Metric | Provider | Data through | Retained points |
|---|---|---|---:|
| SOL Price (USD) | Allium | 2026-09-01 | 90 |
| SOL Price (USD) | Dune | 2026-09-01 | 90 |
| SOL Price (USD) | DeFiLlama | 2026-09-01 | 90 |
| SOL Price (USD) | Artemis | 2026-09-01 | 90 |
| SOL Price (USD) | Birdeye | 2026-09-01 | 90 |
| SOL Price (USD) | Blockworks | 2026-09-01 | 90 |
| SOL Price (USD) | DexPaprika | 2026-09-01 | 68 |
| SOL Price (USD) | Token Terminal | 2026-09-01 | 90 |
| SOL Price (USD) | Top Ledger | 2026-09-01 | 90 |
| SOL Price (USD) | Uniblock | 2026-09-01 | 90 |
| Fees (SOL) | Allium | 2026-09-01 | 90 |
| Fees (SOL) | Dune | 2026-09-01 | 90 |
| Fees (SOL) | Artemis | 2026-08-31 | 89 |
| Fees (SOL) | Blockworks | 2026-09-01 | 90 |
| Fees (SOL) | Solscan | 2026-09-01 | 90 |
| Fee Payers (Count) | Allium | 2026-09-01 | 90 |
| Fee Payers (Count) | Dune | 2026-09-01 | 90 |
| Fee Payers (Count) | Artemis | 2026-08-31 | 89 |
| Fee Payers (Count) | Blockworks | 2026-09-01 | 90 |
| Fee Payers (Count) | Token Terminal | 2026-09-01 | 90 |
| Fee Payers (Count) | Top Ledger | 2026-08-31 | 89 |
| DEX Volume (USD) | Allium | 2026-09-01 | 90 |
| DEX Volume (USD) | Dune | 2026-09-01 | 90 |
| DEX Volume (USD) | DeFiLlama | 2026-09-01 | 90 |
| DEX Volume (USD) | Artemis | 2026-08-31 | 89 |
| DEX Volume (USD) | Birdeye | 2026-09-01 | 90 |
| DEX Volume (USD) | Blockworks | 2026-09-01 | 90 |
| DEX Volume (USD) | DexPaprika | 2026-09-01 | 68 |
| DEX Volume (USD) | Solscan | 2026-09-01 | 90 |
| DEX Volume (USD) | Token Terminal | 2026-09-01 | 90 |
| DEX Volume (USD) | Top Ledger | 2026-08-31 | 89 |

## Ecosystem Growth

| Metric | Value | Observation | Status |
|---|---:|---|---|
| Tokenized-market spot volume (trailing 30d) | $1.3B | 2026-09-02T19:22:46.539Z | Fresh |
| Tokenized-equity spot volume (trailing 30d) | $975.03M | 2026-09-02T19:22:46.539Z | Fresh |
| Daily active addresses (initiating signers/fee payers) | 2,500,328 | 2026-09-01 | Fresh |

Tokens.xyz coverage: 362 of 439 indexed tokenized-market assets and 334 of 394 equities have accepted 30-day volume provenance. Excluded assets: 10 RWA.xyz-derived, 7 unrecognized provenance, and 60 without a 30-day value.

### Tokenized market category breakdown

This is a current cross-sectional breakdown of the same provenance-filtered trailing-30-day spot-volume total.

| Category | Indexed assets | Covered assets | Trailing 30d spot volume |
|---|---:|---:|---:|
| Equities | 394 | 334 | $975.03M |
| ETFs | 25 | 19 | $215.06M |
| Commodities | 5 | 5 | $106.62M |
| Other RWA | 15 | 4 | $5.11K |

### Leading covered tokenized assets

Ranked by accepted trailing-30-day spot volume; excluded provenance never enters this table.

| Rank | Asset | Category | Volume source | Trailing 30d spot volume |
|---:|---|---|---|---:|
| 1 | SPCX — SpaceX | Equities | birdeye | $185.42M |
| 2 | SPY — SP500 | ETFs | birdeye | $169.2M |
| 3 | CRCL — Circle | Equities | birdeye | $150.43M |
| 4 | SKHY — SK Hynix | Equities | clickhouse_trades | $139.36M |
| 5 | MU — Micron Technology | Equities | birdeye | $95.86M |
| 6 | GLD — Gold | Commodities | birdeye | $83.74M |
| 7 | SNDK — SanDisk | Equities | clickhouse_trades | $48.74M |
| 8 | NVDA — NVIDIA | Equities | birdeye | $47.5M |
| 9 | OPENAI — OpenAI | Equities | clickhouse_trades | $43.14M |
| 10 | MSTR — MicroStrategy | Equities | birdeye | $38.33M |

### Retired RWA.xyz transfer-volume evidence

The legacy trailing-30-day transfer-volume series ended at 2026-08-26T06:02:39.551Z. It remains available as historical evidence and is not joined to Tokens.xyz spot-volume history.

Final retained values: $3.21B across tokenized assets and $2.14B across tokenized equities.

### Upcoming upgrades and developments

- [Alpenglow](https://solana.com/upgrades/alpenglow) — In Development, Agave 4.3. Faster finality with Solana's next consensus protocol ([SIMD-0326](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0326-alpenglow.md), [SIMD-0337](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0337-parent-ready-update-marker.md), [SIMD-0357](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0357-alpenglow_validator_admission_ticket.md), [SIMD-0384](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0384-alpenglow-migration.md), [SIMD-0387](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0387-bls-pubkey-management-in-vote-account.md))
- [New Cryptography Schemes](https://solana.com/upgrades/new-cryptography) — In Development, Agave 4.3. Native syscalls for BN254 G2 and BLS12-381 curve operations ([SIMD-0302](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0302-bn254-g2-syscalls.md), [SIMD-0388](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0388-bls12-381-syscalls.md))
- [Reduced Slot Times](https://solana.com/upgrades/reduced-slot-times) — Pending Feature Activation, Agave 4.2. Cutting slot times from 400ms to 200ms ([SIMD-0525](https://github.com/solana-foundation/solana-improvement-documents/pull/525), [SIMD-0498](https://github.com/solana-foundation/solana-improvement-documents/pull/498))
- [Reduced Rent](https://solana.com/upgrades/reduced-rent) — Pending Feature Activation, Agave 4.2. Cutting the cost of on-chain storage by 90% ([SIMD-0437](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0437-incremental-rent-reduction.md), [SIMD-0392](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0392-rent-increase-adaptations.md))
- [Larger Transaction Sizes](https://solana.com/upgrades/larger-transaction-sizes) — Pending Feature Activation, Agave 4.2. Raising the maximum transaction size from 1232 to 4096 bytes ([SIMD-0296](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0296-larger-transactions.md), [SIMD-0385](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0385-transaction-v1.md))

### Ecosystem and Community News

- 2026-09-02 — [The Token Supercycle: Everything of Value is Becoming Programmable](https://solana.com/news/the-token-supercycle-oped)
- 2026-08-28 — [Solana Changelog: August 27, 2026](https://solana.com/news/solana-changelog-august-27-2026)
- 2026-08-27 — [The Token Supercycle Is Here: Solana Brings Breakpoint 2026 to London](https://solana.com/news/breakpoint-2026-london-speakers)
- 2026-08-24 — [Solana Changelog: August 20, 2026](https://solana.com/news/solana-changelog-august-20-2026)
- 2026-08-19 — [Lowering Slot Time and Validator Economics](https://solana.com/news/lowering-slot-time-and-validators-economic)
- 2026-08-17 — [v1 Transactions and the ALT Trade-off](https://solana.com/news/transaction-v1-and-the-alt-trade-off)
- 2026-08-13 — [Solana Changelog: August 13, 2026](https://solana.com/news/solana-changelog-august-13-2026)
- 2026-08-13 — [How Meow Built Agentic Banking and Agent Payment Rails, with Brandon Arvanaghi](https://solana.com/news/how-meow-built-agentic-banking-and-agent-payment-rails-with-brandon-arvanaghi)

### Recent Agave releases

Status: **Fresh**. Published releases and prereleases are kept separate from upcoming Solana upgrade cards.

- 2026-08-28 — [Release v4.3.0-beta.3](https://github.com/anza-xyz/agave/releases/tag/v4.3.0-beta.3) — `v4.3.0-beta.3` (prerelease)
- 2026-08-28 — [Release v4.2.2](https://github.com/anza-xyz/agave/releases/tag/v4.2.2) — `v4.2.2`
- 2026-08-28 — [Release v4.4.0-alpha.2](https://github.com/anza-xyz/agave/releases/tag/v4.4.0-alpha.2) — `v4.4.0-alpha.2` (prerelease)
- 2026-08-21 — [Release v4.3.0-beta.2](https://github.com/anza-xyz/agave/releases/tag/v4.3.0-beta.2) — `v4.3.0-beta.2` (prerelease)
- 2026-08-21 — [Release v4.3.0-beta.1](https://github.com/anza-xyz/agave/releases/tag/v4.3.0-beta.1) — `v4.3.0-beta.1` (prerelease)
- 2026-08-14 — [Release v4.3.0-beta.0](https://github.com/anza-xyz/agave/releases/tag/v4.3.0-beta.0) — `v4.3.0-beta.0` (prerelease)
- 2026-08-13 — [Release v4.2.1](https://github.com/anza-xyz/agave/releases/tag/v4.2.1) — `v4.2.1`
- 2026-08-07 — [Release v4.2.0](https://github.com/anza-xyz/agave/releases/tag/v4.2.0) — `v4.2.0`
- 2026-08-05 — [Release v4.3.0-alpha.3](https://github.com/anza-xyz/agave/releases/tag/v4.3.0-alpha.3) — `v4.3.0-alpha.3` (prerelease)
- 2026-07-31 — [Release v4.2.0-rc.1](https://github.com/anza-xyz/agave/releases/tag/v4.2.0-rc.1) — `v4.2.0-rc.1`

## Network Observability

Official Solana Status: **All Systems Operational** (none). Observed 2026-09-03T00:35:26.919Z; provider page updated 2026-09-03T00:14:24.684Z.

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
| tps-change | normal | +5.7% |
| slow-slot-time | normal | -0.73% |
| high-validator-delinquency | normal | 0.05% |
| large-tvl-change | normal | +3.4% |
| large-sol-price-move | normal | -0.2% |

## Data Sources and Freshness

| Source | State | Last success | Data through |
|---|---|---|---|
| [Solana JSON-RPC](https://api.mainnet-beta.solana.com) | fresh | 2026-09-03T00:35:26.919Z | 2026-09-03T00:35:26.919Z |
| [DefiLlama Coins API](https://coins.llama.fi/prices/current/coingecko:solana) | fresh | 2026-09-03T00:35:26.919Z | 2026-09-03T00:33:50.000Z |
| [CoinGecko Keyless API](https://api.coingecko.com/api/v3/simple/price) | fresh | 2026-09-03T00:35:26.919Z | 2026-09-03T00:33:10.000Z |
| [Coinbase Exchange SOL-USD](https://api.exchange.coinbase.com/products/SOL-USD/candles) | fresh | 2026-09-02T22:24:50.189Z | 2026-09-01 |
| [DefiLlama Chain TVL](https://api.llama.fi/v2/historicalChainTvl/Solana) | fresh | 2026-09-02T22:24:50.189Z | 2026-09-01 |
| [DefiLlama Stablecoins](https://stablecoins.llama.fi/stablecoincharts/Solana) | fresh | 2026-09-02T22:24:50.189Z | 2026-09-01 |
| [DefiLlama DEX Dimensions](https://api.llama.fi/overview/dexs/Solana?excludeTotalDataChart=false&excludeTotalDataChartBreakdown=true) | fresh | 2026-09-02T22:24:50.189Z | 2026-09-01 |
| [Solana Foundation Data](https://solana.com/api/databricks/data?days=120) | fresh | 2026-09-02T22:24:50.189Z | 2026-09-02T19:50:20.657Z |
| [Jito Daily MEV Rewards](https://kobe.mainnet.jito.network/api/v1/daily_mev_rewards) | fresh | 2026-09-02T22:24:50.189Z | 2026-09-01 |
| [Tokens.xyz Curated Markets](https://www.tokens.xyz/api/v1/assets/curated?groupBy=asset&limit=500&primaryVariantStrategy=liquidity) | fresh | 2026-09-02T19:22:46.539Z | 2026-09-02T19:22:46.539Z |
| [Solana News RSS](https://solana.com/news/rss.xml) | fresh | 2026-09-02T22:24:50.189Z | 2026-09-02T09:00:00.000Z |
| [Solana Upgrades Hub](https://solana.com/upgrades) | fresh | 2026-09-02T22:24:50.189Z | 2026-09-02T22:24:50.189Z |
| [Solana Status](https://status.solana.com/api/v2/summary.json) | fresh | 2026-09-03T00:35:26.919Z | 2026-09-03T00:35:26.919Z |
| [Agave Releases](https://api.github.com/repos/anza-xyz/agave/releases) | fresh | 2026-09-02T23:22:40.514Z | 2026-08-28T18:53:56.000Z |

Detailed definitions, windows, aggregation rules, and limitations are documented in [`methodology.md`](./methodology.md).
