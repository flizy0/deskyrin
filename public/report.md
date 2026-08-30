# Deskyrin

Updated: **2026-08-30T11:19:29.697Z**

Update status: **partial**

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
| TPS (all transactions) | 3,062.58 | 2026-08-30T11:19:27.431Z | Fresh |
| Non-vote TPS | 932.88 | 2026-08-30T11:19:27.431Z | Fresh |
| Slot time | 316.79 ms | 2026-08-30T11:19:27.431Z | Fresh |
| Block height | 420,913,931 | 2026-08-30T11:19:27.431Z | Fresh |
| Epoch progress | 15.31% (epoch 1025) | 2026-08-30T11:19:27.431Z | Fresh |

## Validator Status

Status: **Fresh**. Active and delinquent counts include only vote accounts with positive activated stake; delinquency uses the RPC 128-slot window.

| Metric | Value |
|---|---:|
| Active validators | 676 |
| Delinquent validators | 19 |
| Delinquent activated stake | 0.06% |
| Top 10 stake share | 24.25% |

### Top validators by activated stake

| Rank | Vote account | Status | Stake (SOL) | Share | Commission |
|---:|---|---|---:|---:|---:|
| 1 | `CcaHc2L43ZWjwCHART3oZoJvHLAe9hzT2DJNUpBzoTN1` | active | 17,203,740.86 | 3.94% | 7% |
| 2 | `he1iusunGwqrNtafDtLdhsUQDFvo13z9sUa36PauBtk` | active | 16,085,806.76 | 3.68% | 0% |
| 3 | `3N7s9zXMZ4QqvHQR15t5GNHyqc89KduzMP7423eWiD5g` | active | 12,389,823.57 | 2.83% | 0% |
| 4 | `CatzoSMUkTRidT5DwBxAC2pEtnwMBTpkCepHkFgZDiqb` | active | 11,479,512.08 | 2.63% | 5% |
| 5 | `8GbwASqdpw4dVcwbWUxbHXMrjyQx2aKkoBR5H1GJF8iD` | active | 9,452,658.3 | 2.16% | 0% |
| 6 | `26pV97Ce83ZQ6Kz9XT4td8tdoUFPTng8Fb8gPyc53dJx` | active | 9,293,056.33 | 2.13% | 7% |
| 7 | `51JBzSTU5rAM8gLAVQKgp4WoZerQcSqWC7BitBzgUNAm` | active | 9,023,631.15 | 2.06% | 10% |
| 8 | `CvSb7wdQAFpHuSpTYTJnX5SYH4hCfQ9VuGnqrKaKwycB` | active | 7,295,972.23 | 1.67% | 5% |
| 9 | `9QU2QSxhb24FUX3Tu2FpczXjpK3VYrvRudywSZaM29mF` | active | 7,201,761.97 | 1.65% | 7% |
| 10 | `DumiCKHVqoCQKD8roLApzR5Fit8qGV5fVQsJV9sTZk4a` | active | 6,589,844.83 | 1.51% | 0% |

### Commission tracking

A row means the commission differed between two successful validator snapshots. The interval is evidence of when the change could have occurred, not an exact change timestamp.

| Possible change window | Vote account | Previous | New |
|---|---|---:|---:|
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
| 2026-08-26T16:57:44.334Z → 2026-08-29T15:10:55.812Z | `3R4effnUPr3sDo5wdegPBnqTmKTZhKkbgL1wxYw7w4B6` | 0% | 100% |
| 2026-08-25T21:13:52.507Z → 2026-08-25T23:04:11.884Z | `QodirbUG8AZQBWpHhPJPfjj1xg4AaQUZCVVtwT8YfPi` | 0% | 100% |
| 2026-08-25T19:16:29.126Z → 2026-08-25T21:13:52.507Z | `5AC692spnjbegP7ttCXJEzUe8S81sLYsqJd8Ae6Zv1xU` | 0% | 100% |
| 2026-08-24T23:02:23.624Z → 2026-08-25T03:27:33.932Z | `QodirbUG8AZQBWpHhPJPfjj1xg4AaQUZCVVtwT8YfPi` | 100% | 0% |
| 2026-08-24T23:02:23.624Z → 2026-08-25T03:27:33.932Z | `5AC692spnjbegP7ttCXJEzUe8S81sLYsqJd8Ae6Zv1xU` | 100% | 0% |
| 2026-08-23T23:53:59.329Z → 2026-08-24T03:36:39.712Z | `QodirbUG8AZQBWpHhPJPfjj1xg4AaQUZCVVtwT8YfPi` | 0% | 100% |
| 2026-08-23T23:53:59.329Z → 2026-08-24T03:36:39.712Z | `5AC692spnjbegP7ttCXJEzUe8S81sLYsqJd8Ae6Zv1xU` | 0% | 100% |
| 2026-08-23T03:32:24.954Z → 2026-08-23T05:49:32.149Z | `QodirbUG8AZQBWpHhPJPfjj1xg4AaQUZCVVtwT8YfPi` | 100% | 0% |
| 2026-08-23T03:32:24.954Z → 2026-08-23T05:49:32.149Z | `5AC692spnjbegP7ttCXJEzUe8S81sLYsqJd8Ae6Zv1xU` | 100% | 0% |
| 2026-08-22T04:57:21.345Z → 2026-08-22T06:01:05.861Z | `QodirbUG8AZQBWpHhPJPfjj1xg4AaQUZCVVtwT8YfPi` | 0% | 100% |

## Economic Indicators

| Indicator | Value | Data through | Status |
|---|---:|---|---|
| SOL price | $105.15 (+1.48% / 24h) | 2026-08-30T11:14:00.000Z | Fresh |
| Stablecoin supply (USD-equivalent circulating) | $16.35B | 2026-08-29 | Fresh |
| DEX volume (completed UTC day) | $1.52B | 2026-08-29 | Fresh |
| Real Economic Value (REV) | 11,338.91 SOL | 2026-08-28 | Fresh |
| Median transaction fee | 5,000 lamports | 2026-08-30T11:19:27.431Z | Fresh |
| TVL alert input | $5.87B (-2.38% day/day) | 2026-08-29 | Fresh |

REV components for 2026-08-28: transaction fees 9,081.63 SOL (median of Allium and Dune) + gross Jito tips 2,257.29 SOL.

### Independent market-price evidence

These comparison observations are retained separately and are not averaged into the headline SOL price or its 24-hour alert.

| Series | Value | Data through | Status |
|---|---:|---|---|
| CoinGecko keyless comparison | $105.12 | 2026-08-30T11:17:20.000Z | Fresh |
| Coinbase Exchange SOL-USD daily close | $105.61 | 2026-08-29 | Fresh |

## Provider Comparison Evidence

Status: **Fresh**. These contributor-labelled series are delivered through the Solana Foundation Data endpoint; they are not separate Deskyrin HTTP collectors or source-health records.

Provider definitions can differ materially. The values are shown side by side, never averaged into the canonical headline metrics unless an existing methodology explicitly says otherwise.

| Metric | Provider | Data through | Retained points |
|---|---|---|---:|
| SOL Price (USD) | Allium | 2026-08-29 | 90 |
| SOL Price (USD) | Dune | 2026-08-29 | 90 |
| SOL Price (USD) | DeFiLlama | 2026-08-29 | 90 |
| SOL Price (USD) | Artemis | 2026-08-29 | 90 |
| SOL Price (USD) | Birdeye | 2026-08-29 | 90 |
| SOL Price (USD) | Blockworks | 2026-08-28 | 89 |
| SOL Price (USD) | DexPaprika | 2026-08-29 | 65 |
| SOL Price (USD) | Token Terminal | 2026-08-28 | 89 |
| Fees (SOL) | Allium | 2026-08-28 | 89 |
| Fees (SOL) | Dune | 2026-08-29 | 90 |
| Fees (SOL) | Artemis | 2026-08-28 | 89 |
| Fees (SOL) | Blockworks | 2026-08-28 | 89 |
| Fees (SOL) | Solscan | 2026-08-29 | 90 |
| Fee Payers (Count) | Allium | 2026-08-28 | 89 |
| Fee Payers (Count) | Dune | 2026-08-29 | 90 |
| Fee Payers (Count) | Artemis | 2026-08-28 | 89 |
| Fee Payers (Count) | Blockworks | 2026-08-28 | 89 |
| Fee Payers (Count) | Token Terminal | 2026-08-28 | 89 |
| DEX Volume (USD) | Allium | 2026-08-28 | 89 |
| DEX Volume (USD) | Dune | 2026-08-29 | 90 |
| DEX Volume (USD) | DeFiLlama | 2026-08-29 | 90 |
| DEX Volume (USD) | Artemis | 2026-08-28 | 89 |
| DEX Volume (USD) | Birdeye | 2026-08-29 | 90 |
| DEX Volume (USD) | Blockworks | 2026-08-28 | 89 |
| DEX Volume (USD) | DexPaprika | 2026-08-29 | 65 |
| DEX Volume (USD) | Solscan | 2026-08-29 | 90 |
| DEX Volume (USD) | Token Terminal | 2026-08-28 | 89 |

## Ecosystem Growth

| Metric | Value | Observation | Status |
|---|---:|---|---|
| Tokenized-asset transfer volume (trailing 30d) | $3.21B | 2026-08-26T06:02:39.551Z | Stale since 2026-08-29T15:10:55.812Z |
| Tokenized-equity transfer volume (trailing 30d) | $2.14B | 2026-08-26T06:02:39.551Z | Stale since 2026-08-29T15:10:55.812Z |
| Daily active addresses (initiating signers/fee payers) | 2,460,115 | 2026-08-28 | Fresh |

### Upcoming upgrades and developments

- [Alpenglow](https://solana.com/upgrades/alpenglow) — In Development, Agave 4.3. Faster finality with Solana's next consensus protocol ([SIMD-0326](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0326-alpenglow.md), [SIMD-0337](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0337-parent-ready-update-marker.md), [SIMD-0357](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0357-alpenglow_validator_admission_ticket.md), [SIMD-0384](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0384-alpenglow-migration.md), [SIMD-0387](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0387-bls-pubkey-management-in-vote-account.md))
- [New Cryptography Schemes](https://solana.com/upgrades/new-cryptography) — In Development, Agave 4.3. Native syscalls for BN254 G2 and BLS12-381 curve operations ([SIMD-0302](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0302-bn254-g2-syscalls.md), [SIMD-0388](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0388-bls12-381-syscalls.md))
- [Reduced Slot Times](https://solana.com/upgrades/reduced-slot-times) — Pending Feature Activation, Agave 4.2. Cutting slot times from 400ms to 200ms ([SIMD-0525](https://github.com/solana-foundation/solana-improvement-documents/pull/525), [SIMD-0498](https://github.com/solana-foundation/solana-improvement-documents/pull/498))
- [Reduced Rent](https://solana.com/upgrades/reduced-rent) — Pending Feature Activation, Agave 4.2. Cutting the cost of on-chain storage by 90% ([SIMD-0437](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0437-incremental-rent-reduction.md), [SIMD-0392](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0392-rent-increase-adaptations.md))
- [Larger Transaction Sizes](https://solana.com/upgrades/larger-transaction-sizes) — Pending Feature Activation, Agave 4.2. Raising the maximum transaction size from 1232 to 4096 bytes ([SIMD-0296](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0296-larger-transactions.md), [SIMD-0385](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0385-transaction-v1.md))

### Ecosystem and Community News

- 2026-08-27 — [The Token Supercycle Is Here: Solana Brings Breakpoint 2026 to London](https://solana.com/news/breakpoint-2026-london-speakers)
- 2026-08-24 — [Solana Changelog: August 20, 2026](https://solana.com/news/solana-changelog-august-20-2026)
- 2026-08-19 — [Lowering Slot Time and Validators Economic](https://solana.com/news/lowering-slot-time-and-validators-economic)
- 2026-08-17 — [Transaction v1 and the ALT Trade-off](https://solana.com/news/transaction-v1-and-the-alt-trade-off)
- 2026-08-13 — [Solana Changelog: August 13, 2026](https://solana.com/news/solana-changelog-august-13-2026)
- 2026-08-13 — [How Meow Built Agentic Banking and Agent Payment Rails, with Brandon Arvanaghi](https://solana.com/news/how-meow-built-agentic-banking-and-agent-payment-rails-with-brandon-arvanaghi)
- 2026-08-12 — [Why Asia Is Ahead on Stablecoins, According to Reap's Daren Guo](https://solana.com/news/bits-to-bricks-asia-ahead-stablecoins-daren-guo-reap)
- 2026-08-11 — [MoneyGram Ramps launches on Solana](https://solana.com/news/moneygram-ramps)

### Recent Agave releases

Status: **Fresh**. Published releases and prereleases are kept separate from upcoming Solana upgrade cards.

- 2026-08-28 — [Release v4.3.0-beta.3](https://github.com/anza-xyz/agave/releases/tag/v4.3.0-beta.3) — `v4.3.0-beta.3` (prerelease)
- 2026-08-28 — [Release v4.2.2](https://github.com/anza-xyz/agave/releases/tag/v4.2.2) — `v4.2.2` (prerelease)
- 2026-08-28 — [Release v4.4.0-alpha.2](https://github.com/anza-xyz/agave/releases/tag/v4.4.0-alpha.2) — `v4.4.0-alpha.2` (prerelease)
- 2026-08-21 — [Release v4.3.0-beta.2](https://github.com/anza-xyz/agave/releases/tag/v4.3.0-beta.2) — `v4.3.0-beta.2` (prerelease)
- 2026-08-21 — [Release v4.3.0-beta.1](https://github.com/anza-xyz/agave/releases/tag/v4.3.0-beta.1) — `v4.3.0-beta.1` (prerelease)
- 2026-08-14 — [Release v4.3.0-beta.0](https://github.com/anza-xyz/agave/releases/tag/v4.3.0-beta.0) — `v4.3.0-beta.0` (prerelease)
- 2026-08-13 — [Release v4.2.1](https://github.com/anza-xyz/agave/releases/tag/v4.2.1) — `v4.2.1`
- 2026-08-07 — [Release v4.2.0](https://github.com/anza-xyz/agave/releases/tag/v4.2.0) — `v4.2.0`
- 2026-08-05 — [Release v4.3.0-alpha.3](https://github.com/anza-xyz/agave/releases/tag/v4.3.0-alpha.3) — `v4.3.0-alpha.3` (prerelease)
- 2026-07-31 — [Release v4.2.0-rc.1](https://github.com/anza-xyz/agave/releases/tag/v4.2.0-rc.1) — `v4.2.0-rc.1`

## Network Observability

Official Solana Status: **All Systems Operational** (none). Observed 2026-08-30T11:19:27.431Z; provider page updated 2026-08-30T09:34:50.976Z.

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
| tps-change | normal | -3.99% |
| slow-slot-time | normal | +0.37% |
| high-validator-delinquency | normal | 0.06% |
| large-tvl-change | normal | -2.38% |
| large-sol-price-move | normal | +1.48% |

## Data Sources and Freshness

| Source | State | Last success | Data through |
|---|---|---|---|
| [Solana JSON-RPC](https://api.mainnet-beta.solana.com) | fresh | 2026-08-30T11:19:27.431Z | 2026-08-30T11:19:27.431Z |
| [DefiLlama Coins API](https://coins.llama.fi/prices/current/coingecko:solana) | fresh | 2026-08-30T11:19:27.431Z | 2026-08-30T11:14:00.000Z |
| [CoinGecko Keyless API](https://api.coingecko.com/api/v3/simple/price) | fresh | 2026-08-30T11:19:27.431Z | 2026-08-30T11:17:20.000Z |
| [Coinbase Exchange SOL-USD](https://api.exchange.coinbase.com/products/SOL-USD/candles) | fresh | 2026-08-30T09:19:17.836Z | 2026-08-29 |
| [DefiLlama Chain TVL](https://api.llama.fi/v2/historicalChainTvl/Solana) | fresh | 2026-08-30T09:19:17.836Z | 2026-08-29 |
| [DefiLlama Stablecoins](https://stablecoins.llama.fi/stablecoincharts/Solana) | fresh | 2026-08-30T09:19:17.836Z | 2026-08-29 |
| [DefiLlama DEX Dimensions](https://api.llama.fi/overview/dexs/Solana?excludeTotalDataChart=false&excludeTotalDataChartBreakdown=true) | fresh | 2026-08-30T09:19:17.836Z | 2026-08-29 |
| [Solana Foundation Data](https://solana.com/api/databricks/data?days=120) | fresh | 2026-08-30T09:19:17.836Z | 2026-08-30T04:36:21.136Z |
| [Jito Daily MEV Rewards](https://kobe.mainnet.jito.network/api/v1/daily_mev_rewards) | fresh | 2026-08-30T09:19:17.836Z | 2026-08-29 |
| [RWA.xyz Solana Network](https://app.rwa.xyz/networks/solana) | stale | 2026-08-26T14:06:46.554Z | 2026-08-26T06:02:39.551Z |
| [Solana News RSS](https://solana.com/news/rss.xml) | fresh | 2026-08-30T09:19:17.836Z | 2026-08-27T04:15:00.000Z |
| [Solana Upgrades Hub](https://solana.com/upgrades) | fresh | 2026-08-30T09:19:17.836Z | 2026-08-30T09:19:17.836Z |
| [Solana Status](https://status.solana.com/api/v2/summary.json) | fresh | 2026-08-30T11:19:27.431Z | 2026-08-30T11:19:27.431Z |
| [Agave Releases](https://api.github.com/repos/anza-xyz/agave/releases) | fresh | 2026-08-30T09:19:17.836Z | 2026-08-28T18:53:56.000Z |

Detailed definitions, windows, aggregation rules, and limitations are documented in [`methodology.md`](./methodology.md).
