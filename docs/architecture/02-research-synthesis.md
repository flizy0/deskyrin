# Phase 2 — Research Synthesis

Status: complete  
Synthesized: 2026-08-20  
Inputs: Frozen Master Scope and Research 1–13

## Synthesis goal

The independent candidates are now evaluated as one system. The deciding priorities are:

1. satisfy every frozen listing requirement with defensible semantics;
2. no mandatory data-provider API key;
3. prefer on-chain Solana RPC where the metric is realistically obtainable;
4. minimize providers, persistent state, dependencies, and deployment services;
5. preserve truthful timestamps and last-known-good data;
6. keep the dashboard entirely static on Vercel.

## Consolidated provider set

Five primary provider domains close the complete scope:

| Provider domain | Requirements closed | Why retained |
| --- | --- | --- |
| Official Solana mainnet RPC | TPS, slot time, block height, epoch progress, validator counts/status/stake/top/commission, sampled median transaction fee | Direct network data, keyless, one RPC client |
| DefiLlama public APIs | SOL price/movement, Solana TVL alert input, stablecoin supply, DEX volume | One no-key provider family with documented aggregate histories |
| Solana Foundation public web/data | REV fee component, daily active addresses, official RSS news, curated upcoming upgrades | One first-party domain; the same data route supplies REV fees and fee-payer rows |
| Jito public data | REV Jito-tip component | Required to avoid mislabelling ordinary fee revenue as REV |
| RWA.xyz public Solana page data | Tokenized-asset and tokenized-equity transfer volume | Only researched broad keyless Solana RWA/equity dataset with coherent transfer-volume semantics |

CoinGecko remains a SOL-price fallback and is not polled in healthy runs. Blockworks, xStocks/Backed, DexScreener, raw SIMD files, GitHub content enumeration, and RPC reconstructions remain methodology references or fallbacks only; none is a normal runtime dependency.

Although DefiLlama uses multiple official hosts (`api.llama.fi`, `coins.llama.fi`, and `stablecoins.llama.fi`), it is one provider/methodology family. Similarly, Solana Foundation's data route, RSS, and upgrade hub are independent failure domains under one publisher and must still be collected separately.

## Final metric semantics selected for architecture

### Network Performance

- **TPS:** duration-weighted total transactions per second across the newest five complete approximately one-minute `getRecentPerformanceSamples` rows. Non-vote TPS is retained only as provenance/tooltip context, not promoted to an extra headline metric.
- **Slot time:** `sum(samplePeriodSecs) / sum(numSlots) * 1000` over the exact same five samples; label as recent average slot interval.
- **Block height:** finalized `getEpochInfo.blockHeight` as an exact integer string.
- **Epoch progress:** `slotIndex / slotsInEpoch * 100`, retaining the raw epoch/index/length.

### Validator Status

- A displayed validator is a `getVoteAccounts` vote-account record with `activatedStake > 0`.
- Status comes directly from the RPC's current/delinquent partition using the standard 128-slot distance.
- Counts use the same positive-stake filter for both partitions.
- Stake denominator includes positive-stake current and delinquent records.
- Full current table is deterministically sorted by exact activated stake descending, then vote pubkey.
- Top validators are the first ten rows; stake distribution is top ten plus “other.”
- Commission is the current integer percent from the vote account. Because the listing explicitly says commission tracking, each successful refresh compares the vote-account map with the prior successful table and retains a bounded sparse log of actual percentage changes; new/returning accounts only establish a baseline.
- High delinquency uses delinquent activated-stake share, not validator count share.

### Economic Indicators

- **SOL price movement:** current SOL/USD plus same-provider trailing-24-hour percentage movement; 90-day daily chart plus the timestamped current point.
- **Stablecoin supply:** latest completed-day Solana `totalCirculatingUSD` across provider peg types, excluding unreleased, with 90 daily points.
- **DEX volume:** aggregate Solana direct-DEX daily USD volume for the latest strictly completed UTC day, with 90 daily points; exclude aggregators and derivatives.
- **REV:** for the newest common completed UTC date, deterministic consensus of semantically valid Solana Foundation `Fees` observations (native SOL, including vote/non-vote base and priority fees) plus gross Jito tips (`jito_tips + validator_tips`). Publish component breakdown and 90 joined daily points.
- **Median transaction fees:** median actual `meta.fee` over all transactions in 16 deterministic stratified finalized blocks spanning approximately one hour. Headline is lamports with SOL display conversion; retain the exact sample metadata and 30 days of hourly successful points.

### Ecosystem Growth

- **Tokenized asset volume:** RWA.xyz Solana non-stablecoin RWA trailing-30-day transfer volume in USD.
- **Tokenized equity volume:** the same source/window/measure for its `Stocks` subset.
- **Daily active addresses:** latest completed-day median of the semantically aligned Allium and Dune Solana Foundation `Fee Payers` rows; describe as unique initiating signers/fee payers, not people.
- No additional ecosystem-growth metric is added.

### Content required elsewhere in the listing

- **Ecosystem and Community News:** newest eight valid official Solana RSS items, source title/description only, no generated summary.
- **Upcoming upgrades/developments:** current official Solana Upgrades cards whose deployment stage is non-live. Preserve official status/release/metrics/links and ensure source coverage includes Alpenglow and Reduced Slot Times/SIMD-0525 while they remain upcoming.

### Alerts / notable changes

- TPS drop/spike: two adjacent five-minute bins, each at least 30% and 500 TPS from the preceding approximately one-hour median in the same direction.
- Slow slot time: two adjacent five-minute bins, each at least 50% and 75ms above the preceding approximately one-hour baseline.
- High validator delinquency: at least 5% activated stake for two consecutive scheduled snapshots.
- Large TVL change: absolute completed day-over-day move of at least 10%.
- Large SOL move: absolute same-provider trailing-24-hour move of at least 10%.

TVL remains an alert input/evidence item rather than a standalone Economic Indicators card. The alert section shows evaluation status and evidence even when no alert is active, which is necessary to distinguish “normal” from “unavailable” without adding a new product area.

## Source consolidation decisions

### One Solana RPC collection graph

The RPC work shares one configured endpoint/client but is split into failure domains:

```text
performance samples ──→ TPS + slot time + their alerts
epoch info          ──→ block height + epoch progress
vote accounts       ──→ every validator requirement + delinquency alert
slot/blocks         ──→ sampled median fee
```

The first three lightweight calls may share a JSON-RPC batch. Median-fee block calls remain separately chunked because their payload/latency and failure behavior differ. A median-fee failure must not discard valid network/validator results.

### One DefiLlama provider family, separate semantic adapters

Price, TVL, stablecoins, and DEX volume share an HTTP client and provenance conventions but not fallback substitution. A healthy price fallback cannot repair a failed stablecoin or DEX aggregate. Each adapter retains its own source status and last-known-good boundary.

### One Solana Data response for two requirements

A single bounded `https://solana.com/api/databricks/data?days=...` response is validated once and supplies:

- `Fees` rows for the REV fee consensus;
- selected `Fee Payers` rows for daily active addresses.

The derived REV fee and active-address domains remain independently validated. If one metric family changes shape while the other remains valid, the valid normalized family can still be used; the raw response is never retained.

### REV cannot be collapsed into DefiLlama revenue

DefiLlama fee history plus Jito is a fallback/reference, not the primary architecture. The accepted REV definition needs the full fee component including vote fees and priority fees plus gross Jito tips. Jito therefore remains the one unavoidable extra economic source.

## Unified history model

The provider already supplies chart history for SOL price, TVL, stablecoins, DEX, REV inputs, and active addresses. Those are normalized to the newest 90 completed daily points every successful collection; the repository does not pretend to own that history.

Only four project-originated history families accumulate:

1. TPS and slot time — 30 days of hourly observations;
2. validator aggregates/delinquent stake share — 30 days hourly;
3. sampled median fee — 30 days hourly;
4. tokenized asset/equity rolling-30-day observations — up to 365 distinct provider dates.

All live in bounded chronological arrays in the single canonical snapshot. No raw responses, JSONL, full validator snapshot history, database, Blob store, or alert log is retained.

## Unified update model

One GitHub Actions workflow runs hourly. Within that pipeline, collectors have explicit due intervals to avoid waste while preserving one scheduler:

| Collector group | Due interval | Reason |
| --- | --- | --- |
| Solana RPC network/validators/median fee | 1 hour | Current network state and own hourly history |
| SOL current/history | 1 hour | 24h movement alert and current market value |
| DefiLlama completed-day metrics | 6 hours | Sources update daily; four checks/day catches publication without hourly large-history polling |
| Solana Data + Jito | 6 hours | Daily inputs with normal one-to-two-day lag |
| RWA.xyz | 6 hours | Daily source; expensive public page payload |
| RSS news + upgrade hub | 6 hours | Editorial/roadmap content, not live network telemetry |

On bootstrap every collector is due. A not-due valid domain is carried forward as fresh only while its source observation/fetch time remains inside the documented freshness window; `lastAttemptAt`, `lastSuccessAt`, and `nextDueAt` remain explicit. Skipping a not-due source is not recorded as a failure.

This refinement avoids repeatedly downloading large daily datasets while keeping one update command and one scheduler. It does not create a second pipeline.

## Unified output and frontend model

- `data.json` is the canonical schema-versioned snapshot and last-known-good state.
- `report.md` is generated deterministically from that exact candidate.
- The Vite/vanilla/Chart.js dashboard fetches only same-origin `/data.json`.
- The scheduled writer verifies JSON, Markdown, and static build before committing both generated outputs.
- Vercel deploys the Git commit as immutable static assets. No upstream source is contacted by a visitor.

## Provider/fallback policy

| Domain | Primary | Runtime fallback |
| --- | --- | --- |
| Solana network/validators/fee | Official public RPC | last-known-good only; optional alternate RPC URL may be configured but is not required |
| SOL price | DefiLlama Coins | CoinGecko public endpoint, provider switch recorded |
| TVL/stablecoin/DEX | DefiLlama | last-known-good only |
| REV fees | Solana Data provider consensus | last-known-good joined REV only |
| REV tips | Jito public dataset | last-known-good joined REV only |
| Active addresses | Solana Data aligned rows | last-known-good only |
| Tokenized assets/equities | RWA.xyz public page data | last-known-good only; xStocks is not equivalent |
| News | official RSS | last-known-good only; repository enumeration is a manual adapter fallback |
| Upgrades | official hub | last-known-good only; MDX/SIMD sources are manual adapter evidence |

Fallback means semantic equivalence, not “some data is better than none.” Partial reconstructed totals are rejected.

## Dependency synthesis

The likely minimal implementation dependency set is:

- Node.js standard `fetch`, filesystem, test runner, and crypto/utilities;
- one runtime schema validator to make provider/canonical contracts explicit;
- one small XML parser for RSS;
- one HTML parser for RWA/upgrades pages;
- Vite as build tooling;
- Chart.js as the sole frontend runtime library.

Before implementation planning, Phase 3 will decide exact packages and interfaces. No Solana SDK is needed because all selected on-chain reads are small JSON-RPC calls; avoiding an SDK reduces dependency surface.

## Static-first necessity decision

No backend component passes the required necessity test:

1. Scheduled collection is handled by GitHub Actions.
2. Durable bounded state is the required repository `data.json`.
3. History is either provider-supplied or tiny and embedded in the snapshot.
4. Dashboard/report delivery is static on Vercel.
5. Git pushes trigger production deployments.

Therefore the synthesized architecture has zero Vercel Functions, zero databases, zero Blob/KV stores, and zero persistent processes.

## Synthesis risks carried into architecture

- Official public RPC and public web endpoints have no SLA.
- RWA/upgrades/Solana Data keyless representations are not versioned public APIs.
- REV component dates must join exactly and may lag wall clock.
- GitHub schedule and Vercel deployment are sequential, not one cross-platform transaction.
- Provider daily methodologies can revise old values.
- One static JSON must stay under the browser/repository size ceiling.

Each risk has a concrete schema validation, freshness, last-known-good, or bounded-retention response. Phase 4 will attempt to break the completed global architecture before code begins.
