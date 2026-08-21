# Deskyrin

Updated: **2026-08-20T13:11:40.074Z**

Update status: **complete**

All values are generated deterministically from the cited public sources; this report contains no AI-generated analysis.

## Network Performance

| Metric | Value | Observation | Status |
|---|---:|---|---|
| TPS (all transactions) | 4,107.32 | 2026-08-20T13:10:33.559Z | Fresh |
| Non-vote TPS | 2,479.75 | 2026-08-20T13:10:33.559Z | Fresh |
| Slot time | 420.76 ms | 2026-08-20T13:10:33.559Z | Fresh |
| Block height | 418,528,898 | 2026-08-20T13:10:33.559Z | Fresh |
| Epoch progress | 62.75% (epoch 1019) | 2026-08-20T13:10:33.559Z | Fresh |

## Validator Status

Status: **Fresh**. Active and delinquent counts include only vote accounts with positive activated stake; delinquency uses the RPC 128-slot window.

| Metric | Value |
|---|---:|
| Active validators | 688 |
| Delinquent validators | 6 |
| Delinquent activated stake | 0% |
| Top 10 stake share | 24.38% |

### Top validators by activated stake

| Rank | Vote account | Status | Stake (SOL) | Share | Commission |
|---:|---|---|---:|---:|---:|
| 1 | `CcaHc2L43ZWjwCHART3oZoJvHLAe9hzT2DJNUpBzoTN1` | active | 17,101,526.86 | 3.93% | 7% |
| 2 | `he1iusunGwqrNtafDtLdhsUQDFvo13z9sUa36PauBtk` | active | 16,011,570.34 | 3.68% | 0% |
| 3 | `CatzoSMUkTRidT5DwBxAC2pEtnwMBTpkCepHkFgZDiqb` | active | 12,410,377.83 | 2.85% | 5% |
| 4 | `3N7s9zXMZ4QqvHQR15t5GNHyqc89KduzMP7423eWiD5g` | active | 12,198,972.14 | 2.8% | 0% |
| 5 | `26pV97Ce83ZQ6Kz9XT4td8tdoUFPTng8Fb8gPyc53dJx` | active | 9,188,631.12 | 2.11% | 7% |
| 6 | `51JBzSTU5rAM8gLAVQKgp4WoZerQcSqWC7BitBzgUNAm` | active | 8,991,289.76 | 2.07% | 10% |
| 7 | `8GbwASqdpw4dVcwbWUxbHXMrjyQx2aKkoBR5H1GJF8iD` | active | 8,308,413.01 | 1.91% | 0% |
| 8 | `9QU2QSxhb24FUX3Tu2FpczXjpK3VYrvRudywSZaM29mF` | active | 7,991,430.5 | 1.84% | 7% |
| 9 | `CvSb7wdQAFpHuSpTYTJnX5SYH4hCfQ9VuGnqrKaKwycB` | active | 7,344,654.5 | 1.69% | 5% |
| 10 | `DumiCKHVqoCQKD8roLApzR5Fit8qGV5fVQsJV9sTZk4a` | active | 6,546,145.69 | 1.5% | 0% |

### Commission tracking

| Observed | Vote account | Previous | New |
|---|---|---:|---:|
| 2026-08-20T13:10:33.559Z | `QodirbUG8AZQBWpHhPJPfjj1xg4AaQUZCVVtwT8YfPi` | 0% | 100% |
| 2026-08-20T13:10:33.559Z | `5AC692spnjbegP7ttCXJEzUe8S81sLYsqJd8Ae6Zv1xU` | 0% | 100% |

## Economic Indicators

| Indicator | Value | Data through | Status |
|---|---:|---|---|
| SOL price | $87.25 (+11.53% / 24h) | 2026-08-20T13:08:50.000Z | Fresh |
| Stablecoin supply (USD-equivalent circulating) | $16.01B | 2026-08-19 | Fresh |
| DEX volume (completed UTC day) | $3.01B | 2026-08-19 | Fresh |
| Real Economic Value (REV) | 9,911.87 SOL | 2026-08-18 | Fresh |
| Median transaction fee | 5,000 lamports | 2026-08-20T13:10:33.559Z | Fresh |
| TVL alert input | $4.9B (+0.97% day/day) | 2026-08-19 | Fresh |

REV components for 2026-08-18: transaction fees 8,434.81 SOL (median of Allium and Dune) + gross Jito tips 1,477.06 SOL.

## Ecosystem Growth

| Metric | Value | Observation | Status |
|---|---:|---|---|
| Tokenized-asset transfer volume (trailing 30d) | $3.09B | 2026-08-20T06:58:37.123Z | Fresh |
| Tokenized-equity transfer volume (trailing 30d) | $2.1B | 2026-08-20T06:58:37.123Z | Fresh |
| Daily active addresses (initiating signers/fee payers) | 2,508,197 | 2026-08-18 | Fresh |

### Upcoming upgrades and developments

- [Alpenglow](https://solana.com/upgrades/alpenglow) — In Development, Agave 4.3. Faster finality with Solana's next consensus protocol ([SIMD-0326](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0326-alpenglow.md), [SIMD-0337](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0337-parent-ready-update-marker.md), [SIMD-0357](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0357-alpenglow_validator_admission_ticket.md), [SIMD-0384](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0384-alpenglow-migration.md), [SIMD-0387](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0387-bls-pubkey-management-in-vote-account.md))
- [New Cryptography Schemes](https://solana.com/upgrades/new-cryptography) — In Development, Agave 4.3. Native syscalls for BN254 G2 and BLS12-381 curve operations ([SIMD-0302](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0302-bn254-g2-syscalls.md), [SIMD-0388](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0388-bls12-381-syscalls.md))
- [Reduced Slot Times](https://solana.com/upgrades/reduced-slot-times) — Pending Feature Activation, Agave 4.2. Cutting slot times from 400ms to 200ms ([SIMD-0525](https://github.com/solana-foundation/solana-improvement-documents/pull/525), [SIMD-0498](https://github.com/solana-foundation/solana-improvement-documents/pull/498))
- [Reduced Rent](https://solana.com/upgrades/reduced-rent) — Pending Feature Activation, Agave 4.2. Cutting the cost of on-chain storage by 90% ([SIMD-0437](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0437-incremental-rent-reduction.md), [SIMD-0392](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0392-rent-increase-adaptations.md))
- [Larger Transaction Sizes](https://solana.com/upgrades/larger-transaction-sizes) — Pending Feature Activation, Agave 4.2. Raising the maximum transaction size from 1232 to 4096 bytes ([SIMD-0296](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0296-larger-transactions.md), [SIMD-0385](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0385-transaction-v1.md))

### Ecosystem and Community News

- 2026-08-19 — [Lowering Slot Time and Validators Economic](https://solana.com/news/lowering-slot-time-and-validators-economic)
- 2026-08-17 — [Transaction v1 and the ALT Trade-off](https://solana.com/news/transaction-v1-and-the-alt-trade-off)
- 2026-08-13 — [Solana Changelog: August 13, 2026](https://solana.com/news/solana-changelog-august-13-2026)
- 2026-08-13 — [How Meow Built Agentic Banking and Agent Payment Rails, with Brandon Arvanaghi](https://solana.com/news/how-meow-built-agentic-banking-and-agent-payment-rails-with-brandon-arvanaghi)
- 2026-08-12 — [Why Asia Is Ahead on Stablecoins, According to Reap's Daren Guo](https://solana.com/news/bits-to-bricks-asia-ahead-stablecoins-daren-guo-reap)
- 2026-08-11 — [MoneyGram Ramps launches on Solana](https://solana.com/news/moneygram-ramps)
- 2026-08-06 — [Solana Changelog: August 6, 2026](https://solana.com/news/solana-changelog-august-6-2026)
- 2026-08-05 — [Webinar Recap: Giving AI agents a native way to pay with x402](https://solana.com/news/webinar-recap-agentic-payments)

## Alerts / notable changes

- **Large SOL price move** — SOL moved 11.5% over the 24-hour reference window. (2026-08-20T13:08:50.000Z)

| Check | State | Current / reason |
|---|---|---|
| tps-change | normal | +2.97% |
| slow-slot-time | normal | +1.4% |
| high-validator-delinquency | normal | 0% |
| large-tvl-change | normal | +0.97% |
| large-sol-price-move | triggered | +11.53% |

## Data Sources and Freshness

| Source | State | Last success | Data through |
|---|---|---|---|
| [Solana JSON-RPC](https://api.mainnet-beta.solana.com) | fresh | 2026-08-20T13:10:33.559Z | 2026-08-20T13:10:33.559Z |
| [DefiLlama Coins API](https://coins.llama.fi/prices/current/coingecko:solana) | fresh | 2026-08-20T13:10:33.559Z | 2026-08-20T13:08:50.000Z |
| [DefiLlama Chain TVL](https://api.llama.fi/v2/historicalChainTvl/Solana) | fresh | 2026-08-20T13:10:33.559Z | 2026-08-19 |
| [DefiLlama Stablecoins](https://stablecoins.llama.fi/stablecoincharts/Solana) | fresh | 2026-08-20T13:10:33.559Z | 2026-08-19 |
| [DefiLlama DEX Dimensions](https://api.llama.fi/overview/dexs/Solana?excludeTotalDataChart=false&excludeTotalDataChartBreakdown=true) | fresh | 2026-08-20T13:10:33.559Z | 2026-08-19 |
| [Solana Foundation Data](https://solana.com/api/databricks/data?days=120) | fresh | 2026-08-20T13:10:33.559Z | 2026-08-20T10:44:41.139Z |
| [Jito Daily MEV Rewards](https://kobe.mainnet.jito.network/api/v1/daily_mev_rewards) | fresh | 2026-08-20T13:10:33.559Z | 2026-08-19 |
| [RWA.xyz Solana Network](https://app.rwa.xyz/networks/solana) | fresh | 2026-08-20T13:10:33.559Z | 2026-08-20T06:58:37.123Z |
| [Solana News RSS](https://solana.com/news/rss.xml) | fresh | 2026-08-20T13:10:33.559Z | 2026-08-19T10:00:00.000Z |
| [Solana Upgrades Hub](https://solana.com/upgrades) | fresh | 2026-08-20T13:10:33.559Z | 2026-08-20T13:10:33.559Z |

Detailed definitions, windows, aggregation rules, and limitations are documented in [`methodology.md`](./methodology.md).
