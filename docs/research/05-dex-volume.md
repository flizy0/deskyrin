# Research 5 — DEX Volume

Status: complete (local candidate only; no global architecture decision)  
Researched: 2026-08-20

## Requirement

Aggregated Solana DEX volume with historical volume, explicit timeframe/coverage, no mandatory API key, and a decision on whether self-aggregation is necessary.

## Meaning

USD-denominated trading volume executed by Solana protocols classified by the provider as DEXs, aggregated for the latest completed UTC day and shown as a bounded daily time series.

The metric is direct DEX trading volume. DefiLlama maintains separate dimensions for DEX aggregators and derivatives, so aggregator-routed and derivatives dashboards should not be added to this total. This avoids intentionally combining unlike categories, though individual adapter classification remains a provider limitation.

## Option A — DefiLlama DEX overview for Solana

- Source: DefiLlama's free Dimensions API and open-source dimension adapters.
- Endpoint: `GET https://api.llama.fi/overview/dexs/Solana?excludeTotalDataChart=false&excludeTotalDataChartBreakdown=true`.
- Authentication: none.
- Methodology:
  - Use `totalDataChart`, whose points are `[UTC-day-start Unix timestamp, USD dailyVolume]`.
  - Determine current UTC day start in the collector.
  - Treat the newest point with timestamp strictly earlier than current UTC day start as the last completed day.
  - Compute `dayChangePercent = 100 * (lastCompleted / previousCompleted - 1)` from two validated completed buckets.
  - Use `total24h` as a consistency check rather than blindly joining it to the newest chart point.
- Timeframe: one completed UTC calendar day; bounded daily history for the chart.
- History: the live response contained 1,780 chart points at research time.
- Coverage: 119 protocol records were present for Solana in the live response. Each can expose a methodology URL into the public DefiLlama adapter repository.
- Advantages: no key, listing-named provider, aggregate and history in one request, protocol adapter transparency, no local indexer, separate DEX/aggregator/derivative categories.
- Disadvantages: provider coverage and classification can change; adapters use mixed on-chain/indexed/API techniques; response includes a partial current-day bucket; no formal SLA or exact public rate quota.

## Option B — Self-aggregate from Solana RPC

- Source: official Solana JSON-RPC.
- Endpoints: block/transaction history (`getBlocks`, `getBlock`, or address-signature scans) plus token metadata and pricing sources.
- Authentication: no key in principle, but practical volume exceeds public RPC suitability.
- Methodology: maintain every included DEX program/version, decode outer and inner swap instructions, identify input/output assets, avoid route/aggregator double counting, price legs in USD at execution time, and aggregate by day.
- Timeframe/history: requires processing a very large transaction stream and retaining an index.
- Advantages: full control and on-chain auditability if a production indexer is built.
- Disadvantages: effectively creates a chain indexer; very high RPC/data cost; continuous program upgrades; token-price dependency; complex deduplication; incompatible with the minimal static-first bounty architecture.

## Option C — Dune or another indexed analytics API

- Source: Dune dashboards/queries, Artemis, commercial indexers, or a bespoke public dataset.
- Authentication: stable automated APIs commonly require keys or query credits.
- Methodology/history: query/provider dependent.
- Advantages: custom SQL and alternative cross-checks may be available.
- Disadvantages: mandatory credentials, credit/rate limits, or brittle dashboard scraping; more maintenance than the free dedicated aggregate.

## Recommended candidate

Option A. Self-aggregation is not necessary and would be disproportionate. Normalize the last completed UTC day and a bounded historical series. Do not publish the current partial-day chart point as “24h” or a completed daily value.

No equally simple independent no-key aggregate fallback was found. On provider failure or stale history, preserve last-known-good DEX data and mark its source status rather than substituting partial protocol data.

## Dependencies

- Shared DefiLlama HTTP client and provenance/freshness handling.
- UTC date utilities and response contract validation.
- Bounded provider-series policy from Research 10.
- Dashboard time-series component from Research 11.

## Produced data

`scalar`, `time series`, `status`

## Update characteristics

- Underlying adapters may update hourly, but the selected completed-day metric changes daily.
- Fetching on each shared hourly-or-slower pipeline run is low volume; unchanged completed buckets should normalize identically.
- Own history is unnecessary because the provider supplies long daily history.
- A bounded 90- or 365-day normalized chart is tens of kilobytes.

## Risks / Open Questions

- Partial current day: at research time the final chart point represented the current UTC day and exceeded the preceding completed bucket. It must be excluded from the completed-day headline.
- `total24h` matched the preceding completed chart point in the live response, not the final partial point. Validate this within a small tolerance, but derive display timestamps from chart data.
- Adapter backfills/corrections can revise historical values. The project should always identify DefiLlama as direct source and avoid implying immutable on-chain totals.
- Coverage is only as complete as listed adapters and their successful fetches. Protocol additions/removals can create discontinuities.
- Wash trading and self-trading are not universally removed; volume means adapter-counted trade notional, not organic economic demand.
- USD conversion depends on provider token prices and adapter methodology.
- Reject negative/non-finite volumes, duplicate/non-monotonic timestamps, or a response with fewer than two completed days. A valid prior snapshot is preferable to fabricated zero.

## Sources

- DefiLlama API overview and free/pro distinction: https://api-docs.defillama.com/
- DefiLlama free DEX endpoint reference: https://api-docs.defillama.com/llms-free.txt
- DefiLlama dimension adapters: https://github.com/DefiLlama/dimension-adapters
- DefiLlama dimension methodology guidelines: https://github.com/DefiLlama/dimension-adapters/blob/master/GUIDELINES.md
- DefiLlama DEX dashboard (human cross-check): https://defillama.com/dexs
