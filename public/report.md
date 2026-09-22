# Deskyrin

Updated: **2026-09-22T17:09:59.288Z**

Update status: **complete**

All current values are generated deterministically from the cited public sources; this report contains no AI-generated analysis.

## Historical Continuity Repairs

Current values, source freshness, and alerts use direct observations only. Recovered points come from retained source evidence; `imputed: true` points are deterministic linear estimates between two bounding non-imputed observations. Nothing is extrapolated.

| History | Direct | Recovered source evidence | Imputed |
|---|---:|---:|---:|
| Network performance | 475 | 3 | 100 |
| Validator aggregates | 475 | 0 | 103 |
| Median transaction fee | 473 | 0 | 105 |
| Tokenized-market spot volume | 90 | 0 | 4 |

## Network Performance

| Metric | Value | Observation | Status |
|---|---:|---|---|
| TPS (all transactions) | 4,866.61 | 2026-09-22T17:09:23.445Z | Fresh |
| Non-vote TPS | 2,346.93 | 2026-09-22T17:09:23.445Z | Fresh |
| Slot time | 267.38 ms | 2026-09-22T17:09:23.445Z | Fresh |
| Block height | 427,482,221 | 2026-09-22T17:09:23.445Z | Fresh |
| Epoch progress | 37.47% (epoch 1040) | 2026-09-22T17:09:23.445Z | Fresh |

## Validator Status

Status: **Fresh**. Active and delinquent counts include only vote accounts with positive activated stake; delinquency uses the RPC 128-slot window.

| Metric | Value |
|---|---:|
| Active validators | 674 |
| Delinquent validators | 12 |
| Delinquent activated stake | 0.05% |
| Top 10 stake share | 24.32% |

### Top validators by activated stake

| Rank | Vote account | Status | Stake (SOL) | Share | Commission |
|---:|---|---|---:|---:|---:|
| 1 | `CcaHc2L43ZWjwCHART3oZoJvHLAe9hzT2DJNUpBzoTN1` | active | 17,826,722.02 | 4.05% | 7% |
| 2 | `he1iusunGwqrNtafDtLdhsUQDFvo13z9sUa36PauBtk` | active | 15,840,698.17 | 3.6% | 0% |
| 3 | `3N7s9zXMZ4QqvHQR15t5GNHyqc89KduzMP7423eWiD5g` | active | 12,354,353.49 | 2.81% | 0% |
| 4 | `CatzoSMUkTRidT5DwBxAC2pEtnwMBTpkCepHkFgZDiqb` | active | 11,265,428.99 | 2.56% | 5% |
| 5 | `8GbwASqdpw4dVcwbWUxbHXMrjyQx2aKkoBR5H1GJF8iD` | active | 10,210,832.24 | 2.32% | 0% |
| 6 | `26pV97Ce83ZQ6Kz9XT4td8tdoUFPTng8Fb8gPyc53dJx` | active | 9,211,355.88 | 2.09% | 7% |
| 7 | `51JBzSTU5rAM8gLAVQKgp4WoZerQcSqWC7BitBzgUNAm` | active | 9,144,102.43 | 2.08% | 10% |
| 8 | `9QU2QSxhb24FUX3Tu2FpczXjpK3VYrvRudywSZaM29mF` | active | 7,458,789.03 | 1.7% | 7% |
| 9 | `CvSb7wdQAFpHuSpTYTJnX5SYH4hCfQ9VuGnqrKaKwycB` | active | 7,089,341.68 | 1.61% | 5% |
| 10 | `DumiCKHVqoCQKD8roLApzR5Fit8qGV5fVQsJV9sTZk4a` | active | 6,555,721.55 | 1.49% | 0% |

### Commission tracking

A row means the commission differed between two successful validator snapshots. The interval is evidence of when the change could have occurred, not an exact change timestamp.

| Possible change window | Vote account | Previous | New |
|---|---|---:|---:|
| 2026-09-22T07:41:53.148Z → 2026-09-22T13:24:25.482Z | `Luna8BkZNpZ9DKmszrZYPvFpTr4eJJfxxTnGDwTrYkv` | 0% | 5% |
| 2026-09-22T01:37:25.466Z → 2026-09-22T07:41:53.148Z | `VaCdXKupamusfRsDf9Ai7e8Up36Z4f3MP6SqhnM7c76` | 0% | 5% |
| 2026-09-22T01:37:25.466Z → 2026-09-22T07:41:53.148Z | `QodirbUG8AZQBWpHhPJPfjj1xg4AaQUZCVVtwT8YfPi` | 100% | 0% |
| 2026-09-22T01:37:25.466Z → 2026-09-22T07:41:53.148Z | `5AC692spnjbegP7ttCXJEzUe8S81sLYsqJd8Ae6Zv1xU` | 100% | 0% |
| 2026-09-21T06:19:16.813Z → 2026-09-21T14:06:55.543Z | `QodirbUG8AZQBWpHhPJPfjj1xg4AaQUZCVVtwT8YfPi` | 0% | 100% |
| 2026-09-21T06:19:16.813Z → 2026-09-21T14:06:55.543Z | `5AC692spnjbegP7ttCXJEzUe8S81sLYsqJd8Ae6Zv1xU` | 0% | 100% |
| 2026-09-20T20:47:29.040Z → 2026-09-20T23:14:19.789Z | `QodirbUG8AZQBWpHhPJPfjj1xg4AaQUZCVVtwT8YfPi` | 100% | 0% |
| 2026-09-20T20:47:29.040Z → 2026-09-20T23:14:19.789Z | `5AC692spnjbegP7ttCXJEzUe8S81sLYsqJd8Ae6Zv1xU` | 100% | 0% |
| 2026-09-20T04:25:19.816Z → 2026-09-20T05:23:29.411Z | `QodirbUG8AZQBWpHhPJPfjj1xg4AaQUZCVVtwT8YfPi` | 0% | 100% |
| 2026-09-20T04:25:19.816Z → 2026-09-20T05:23:29.411Z | `5AC692spnjbegP7ttCXJEzUe8S81sLYsqJd8Ae6Zv1xU` | 0% | 100% |
| 2026-09-19T21:22:52.311Z → 2026-09-19T22:23:04.913Z | `sfo5vA1fFdPRsvqd8qdePtTnK97Qj6Jj3GupEzmNPjJ` | 4% | 5% |
| 2026-09-19T12:28:52.100Z → 2026-09-19T13:23:58.763Z | `QodirbUG8AZQBWpHhPJPfjj1xg4AaQUZCVVtwT8YfPi` | 100% | 0% |
| 2026-09-19T12:28:52.100Z → 2026-09-19T13:23:58.763Z | `5AC692spnjbegP7ttCXJEzUe8S81sLYsqJd8Ae6Zv1xU` | 100% | 0% |
| 2026-09-18T20:24:31.060Z → 2026-09-18T21:24:05.320Z | `QodirbUG8AZQBWpHhPJPfjj1xg4AaQUZCVVtwT8YfPi` | 0% | 100% |
| 2026-09-18T20:24:31.060Z → 2026-09-18T21:24:05.320Z | `5AC692spnjbegP7ttCXJEzUe8S81sLYsqJd8Ae6Zv1xU` | 0% | 100% |
| 2026-09-18T18:26:54.449Z → 2026-09-18T19:23:23.026Z | `6hcGvZypizjf6PPsxboshZHRqefyQKSG9L8vZqYdm7UY` | 0% | 5% |
| 2026-09-18T04:25:34.180Z → 2026-09-18T05:23:57.267Z | `QodirbUG8AZQBWpHhPJPfjj1xg4AaQUZCVVtwT8YfPi` | 100% | 0% |
| 2026-09-18T04:25:34.180Z → 2026-09-18T05:23:57.267Z | `5AC692spnjbegP7ttCXJEzUe8S81sLYsqJd8Ae6Zv1xU` | 100% | 0% |
| 2026-09-17T20:26:08.023Z → 2026-09-17T21:24:40.828Z | `HZDt9b6AVva1cgbuHBRKQczfA5FGGwLh4a6wLRM6FSvT` | 5% | 8% |
| 2026-09-17T09:26:36.069Z → 2026-09-17T10:25:57.550Z | `QodirbUG8AZQBWpHhPJPfjj1xg4AaQUZCVVtwT8YfPi` | 0% | 100% |

## Economic Indicators

| Indicator | Value | Data through | Status |
|---|---:|---|---|
| SOL price | $117.52 (-0.03% / 24h) | 2026-09-22T17:01:30.000Z | Fresh |
| Stablecoin supply (USD-equivalent circulating) | $15.91B | 2026-09-21 | Fresh |
| DEX volume (completed UTC day) | $3.43B | 2026-09-21 | Fresh |
| Real Economic Value (REV) | 11,259.99 SOL | 2026-09-21 | Fresh |
| Median transaction fee | 5,000 lamports | 2026-09-22T17:09:23.445Z | Fresh |
| TVL alert input | $6.21B (+0.48% day/day) | 2026-09-21 | Fresh |

REV components for 2026-09-21: transaction fees 9,225.4 SOL (median of Allium and Dune) + gross Jito tips 2,034.59 SOL.

### Independent market-price evidence

These comparison observations are retained separately and are not averaged into the headline SOL price or its 24-hour alert.

| Series | Value | Data through | Status |
|---|---:|---|---|
| CoinGecko keyless comparison | $117.65 | 2026-09-22T17:05:30.000Z | Fresh |
| Coinbase Exchange SOL-USD daily close | $118.9 | 2026-09-21 | Fresh |

## Provider Comparison Evidence

Status: **Fresh**. These contributor-labelled series are delivered through the Solana Foundation Data endpoint; they are not separate Deskyrin HTTP collectors or source-health records.

Provider definitions can differ materially. The values are shown side by side, never averaged into the canonical headline metrics unless an existing methodology explicitly says otherwise.

| Metric | Provider | Data through | Retained points |
|---|---|---|---:|
| SOL Price (USD) | Allium | 2026-09-21 | 90 |
| SOL Price (USD) | Dune | 2026-09-21 | 90 |
| SOL Price (USD) | DeFiLlama | 2026-09-21 | 90 |
| SOL Price (USD) | Artemis | 2026-09-21 | 90 |
| SOL Price (USD) | Birdeye | 2026-09-21 | 90 |
| SOL Price (USD) | Blockworks | 2026-09-21 | 90 |
| SOL Price (USD) | DexPaprika | 2026-09-21 | 88 |
| SOL Price (USD) | Token Terminal | 2026-09-21 | 90 |
| SOL Price (USD) | Top Ledger | 2026-09-21 | 90 |
| SOL Price (USD) | Uniblock | 2026-09-21 | 90 |
| Fees (SOL) | Allium | 2026-09-21 | 90 |
| Fees (SOL) | Dune | 2026-09-21 | 90 |
| Fees (SOL) | Artemis | 2026-09-21 | 90 |
| Fees (SOL) | Blockworks | 2026-09-21 | 90 |
| Fees (SOL) | Solscan | 2026-09-21 | 90 |
| Fee Payers (Count) | Allium | 2026-09-21 | 90 |
| Fee Payers (Count) | Dune | 2026-09-21 | 90 |
| Fee Payers (Count) | Artemis | 2026-09-21 | 90 |
| Fee Payers (Count) | Blockworks | 2026-09-21 | 90 |
| Fee Payers (Count) | Token Terminal | 2026-09-21 | 90 |
| Fee Payers (Count) | Top Ledger | 2026-09-20 | 89 |
| DEX Volume (USD) | Allium | 2026-09-21 | 90 |
| DEX Volume (USD) | Dune | 2026-09-21 | 90 |
| DEX Volume (USD) | DeFiLlama | 2026-09-21 | 90 |
| DEX Volume (USD) | Artemis | 2026-09-21 | 90 |
| DEX Volume (USD) | Birdeye | 2026-09-21 | 90 |
| DEX Volume (USD) | Blockworks | 2026-09-21 | 90 |
| DEX Volume (USD) | DexPaprika | 2026-09-21 | 88 |
| DEX Volume (USD) | Solscan | 2026-09-21 | 90 |
| DEX Volume (USD) | Token Terminal | 2026-09-21 | 90 |
| DEX Volume (USD) | Top Ledger | 2026-09-20 | 89 |

## Ecosystem Growth

| Metric | Value | Observation | Status |
|---|---:|---|---|
| Tokenized-market spot volume (trailing 30d) | $2.78B | 2026-09-22T17:09:23.445Z | Fresh |
| Tokenized-equity spot volume (trailing 30d) | $1.98B | 2026-09-22T17:09:23.445Z | Fresh |
| Daily active addresses (initiating signers/fee payers) | 3,115,012 | 2026-09-21 | Fresh |

Tokens.xyz coverage: 368 of 441 indexed tokenized-market assets and 338 of 396 equities have accepted 30-day volume provenance. Excluded assets: 10 RWA.xyz-derived, 5 unrecognized provenance, and 58 without a 30-day value.

### Tokenized market category breakdown

This is a current cross-sectional breakdown of the same provenance-filtered trailing-30-day spot-volume total.

| Category | Indexed assets | Covered assets | Trailing 30d spot volume |
|---|---:|---:|---:|
| Equities | 396 | 338 | $1.98B |
| ETFs | 25 | 20 | $682.85M |
| Commodities | 5 | 5 | $114.92M |
| Other RWA | 15 | 5 | $28.2K |

### Leading covered tokenized assets

Ranked by accepted trailing-30-day spot volume; excluded provenance never enters this table.

| Rank | Asset | Category | Volume source | Trailing 30d spot volume |
|---:|---|---|---|---:|
| 1 | SPY — SP500 | ETFs | birdeye | $584.83M |
| 2 | CRCL — Circle | Equities | birdeye | $200.66M |
| 3 | SPCX — SpaceX | Equities | birdeye | $177.49M |
| 4 | ANTHROPIC — Anthropic | Equities | birdeye | $135.18M |
| 5 | OPENAI — OpenAI | Equities | clickhouse_trades | $127.55M |
| 6 | MU — Micron Technology | Equities | clickhouse_trades | $108.01M |
| 7 | NVDA — NVIDIA | Equities | birdeye | $101.38M |
| 8 | SKHY — SK Hynix | Equities | birdeye | $83.47M |
| 9 | QQQ — Nasdaq | ETFs | birdeye | $69.19M |
| 10 | AAPL — Apple | Equities | birdeye | $66.94M |

### Upcoming upgrades and developments

- [sBPFv3 Programs](https://solana.com/upgrades/sbpfv3-programs) — In Development, Agave 4.4. Simplifying and modernizing the Solana runtime and program deployments ([SIMD-0500](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0500-disable-deployment-of-sbpf-v0-v1-v2.md), [SIMD-0178](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0178-static-syscalls.md), [SIMD-0377](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0377-ebpf-isa-compatibility.md))
- [Alpenglow](https://solana.com/upgrades/alpenglow) — In Development, Agave 4.3. Solana's next consensus protocol delivers sub-second finality ([SIMD-0363](https://github.com/solana-foundation/solana-improvement-documents/pull/363), [SIMD-0326](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0326-alpenglow.md), [SIMD-0337](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0337-parent-ready-update-marker.md), [SIMD-0357](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0357-alpenglow_validator_admission_ticket.md), [SIMD-0384](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0384-alpenglow-migration.md), [SIMD-0387](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0387-bls-pubkey-management-in-vote-account.md))
- [Reduced Slot Times](https://solana.com/upgrades/reduced-slot-times) — Partially Activated, Agave 4.2. Cutting slot times from 400ms to 200ms ([SIMD-0525](https://github.com/solana-foundation/solana-improvement-documents/pull/525), [SIMD-0498](https://github.com/solana-foundation/solana-improvement-documents/pull/498))
- [Reduced Rent](https://solana.com/upgrades/reduced-rent) — Partially Activated, Agave 4.2. Cutting the cost of on-chain storage by 90% ([SIMD-0437](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0437-incremental-rent-reduction.md), [SIMD-0392](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0392-rent-increase-adaptations.md))

### Ecosystem and Community News

- 2026-09-19 — [Solana Changelog: September 18, 2026](https://solana.com/news/solana-changelog-september-18-2026)
- 2026-09-19 — [How AI Is Reshaping Crypto Security, with Michael Coates](https://solana.com/news/bits-to-bricks-crypto-security-michael-coates)
- 2026-09-16 — [Project Harmonia Brings Institutional Tokenized Funds to Solana](https://solana.com/news/project-harmonia-brings-institutional-tokenized-funds-to-solana)
- 2026-09-14 — [Solana: Building, Proving and Earning Trust in Public](https://solana.com/news/solana-building-trust-in-public)
- 2026-09-10 — [Solana Changelog: September 10, 2026](https://solana.com/news/solana-changelog-september-10-2026)
- 2026-09-10 — [Solana Changelog: September 3, 2026](https://solana.com/news/solana-changelog-september-3-2026)
- 2026-09-08 — [Report: Stablecoins Are Reshaping Remittances](https://solana.com/news/report-stablecoins-are-reshaping-remittances)
- 2026-09-07 — [How BitRobot Crowdsources Real-World Data for Embodied AI, with Jonathan Victor](https://solana.com/news/bits-to-bricks-bitrobot-jonathan-victor)

### Recent Agave releases

Status: **Fresh**. Published releases and prereleases are kept separate from upcoming Solana upgrade cards.

- 2026-09-18 — [Release v4.4.0-alpha.5](https://github.com/anza-xyz/agave/releases/tag/v4.4.0-alpha.5) — `v4.4.0-alpha.5` (prerelease)
- 2026-09-18 — [Release v4.3.0](https://github.com/anza-xyz/agave/releases/tag/v4.3.0) — `v4.3.0`
- 2026-09-11 — [Release v4.3.0-rc.1](https://github.com/anza-xyz/agave/releases/tag/v4.3.0-rc.1) — `v4.3.0-rc.1`
- 2026-09-10 — [Release v4.4.0-alpha.4](https://github.com/anza-xyz/agave/releases/tag/v4.4.0-alpha.4) — `v4.4.0-alpha.4` (prerelease)
- 2026-09-04 — [Release v4.3.0-rc.0](https://github.com/anza-xyz/agave/releases/tag/v4.3.0-rc.0) — `v4.3.0-rc.0`
- 2026-09-03 — [Release v4.4.0-alpha.3](https://github.com/anza-xyz/agave/releases/tag/v4.4.0-alpha.3) — `v4.4.0-alpha.3` (prerelease)
- 2026-08-28 — [Release v4.3.0-beta.3](https://github.com/anza-xyz/agave/releases/tag/v4.3.0-beta.3) — `v4.3.0-beta.3` (prerelease)
- 2026-08-28 — [Release v4.2.2](https://github.com/anza-xyz/agave/releases/tag/v4.2.2) — `v4.2.2`
- 2026-08-28 — [Release v4.4.0-alpha.2](https://github.com/anza-xyz/agave/releases/tag/v4.4.0-alpha.2) — `v4.4.0-alpha.2` (prerelease)
- 2026-08-21 — [Release v4.3.0-beta.2](https://github.com/anza-xyz/agave/releases/tag/v4.3.0-beta.2) — `v4.3.0-beta.2` (prerelease)

## Network Observability

Official Solana Status: **All Systems Operational** (none). Observed 2026-09-22T17:09:23.445Z; provider page updated 2026-09-22T16:49:27.429Z.

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
| tps-change | normal | +1.73% |
| slow-slot-time | normal | -0.27% |
| high-validator-delinquency | normal | 0.05% |
| large-tvl-change | normal | +0.48% |
| large-sol-price-move | normal | -0.03% |

## Data Sources and Freshness

| Source | State | Last success | Data through |
|---|---|---|---|
| [Solana JSON-RPC](https://api.mainnet-beta.solana.com) | fresh | 2026-09-22T17:09:23.445Z | 2026-09-22T17:09:23.445Z |
| [DefiLlama Coins API](https://coins.llama.fi/prices/current/coingecko:solana) | fresh | 2026-09-22T17:09:23.445Z | 2026-09-22T17:01:30.000Z |
| [CoinGecko Keyless API](https://api.coingecko.com/api/v3/simple/price) | fresh | 2026-09-22T17:09:23.445Z | 2026-09-22T17:05:30.000Z |
| [Coinbase Exchange SOL-USD](https://api.exchange.coinbase.com/products/SOL-USD/candles) | fresh | 2026-09-22T17:09:23.445Z | 2026-09-21 |
| [DefiLlama Chain TVL](https://api.llama.fi/v2/historicalChainTvl/Solana) | fresh | 2026-09-22T17:09:23.445Z | 2026-09-21 |
| [DefiLlama Stablecoins](https://stablecoins.llama.fi/stablecoincharts/Solana) | fresh | 2026-09-22T17:09:23.445Z | 2026-09-21 |
| [DefiLlama DEX Dimensions](https://api.llama.fi/overview/dexs/Solana?excludeTotalDataChart=false&excludeTotalDataChartBreakdown=true) | fresh | 2026-09-22T17:09:23.445Z | 2026-09-21 |
| [Solana Foundation Data](https://solana.com/api/databricks/data?days=120) | fresh | 2026-09-22T17:09:23.445Z | 2026-09-22T13:55:27.605Z |
| [Jito Daily MEV Rewards](https://kobe.mainnet.jito.network/api/v1/daily_mev_rewards) | fresh | 2026-09-22T17:09:23.445Z | 2026-09-21 |
| [Tokens.xyz Curated Markets](https://www.tokens.xyz/api/v1/assets/curated?groupBy=asset&limit=500&primaryVariantStrategy=liquidity) | fresh | 2026-09-22T17:09:23.445Z | 2026-09-22T17:09:23.445Z |
| [Solana News RSS](https://solana.com/news/rss.xml) | fresh | 2026-09-22T17:09:23.445Z | 2026-09-19T11:28:00.000Z |
| [Solana Upgrades Hub](https://solana.com/upgrades) | fresh | 2026-09-22T17:09:23.445Z | 2026-09-22T17:09:23.445Z |
| [Solana Status](https://status.solana.com/api/v2/summary.json) | fresh | 2026-09-22T17:09:23.445Z | 2026-09-22T17:09:23.445Z |
| [Agave Releases](https://api.github.com/repos/anza-xyz/agave/releases) | fresh | 2026-09-22T17:09:23.445Z | 2026-09-18T15:32:23.000Z |

Detailed definitions, windows, aggregation rules, and limitations are documented in [`methodology.md`](./methodology.md).
