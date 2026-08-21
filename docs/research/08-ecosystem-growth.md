# Research 8 — Ecosystem Growth, News, and Upcoming Developments

Status: complete (local candidates only; no global architecture decision)  
Researched: 2026-08-20

The complete listing was obtained and frozen before this research. Its exact Ecosystem Growth metrics are **tokenized asset volumes (especially equities)** and **daily active addresses**. The listing also separately requires **Ecosystem and Community News** and **Upcoming upgrades/developments**, explicitly naming Alpenglow and SIMD-525. No additional ecosystem-growth metric is introduced here.

## Requirement — Tokenized asset volumes, especially equities

### Meaning

Use transfer volume, not outstanding asset value and not DEX trading volume:

> The trailing-30-day USD value transferred by tokenized real-world assets on Solana, plus the same measure for the equity/stocks subset.

The preferred provider's measure excludes mint and burn events. The total is the provider's Solana RWA universe and is kept separate from its stablecoin universe. “Especially equities” is implemented as a source-defined `Stocks` subset of the same measure and window, avoiding an incompatible proxy.

This is a rolling 30-day measure. A value observed today therefore overlaps heavily with yesterday's value and must not be described as single-day volume. Coverage and classification can change as the provider discovers assets.

### Option A — RWA.xyz public Solana network dataset

- Source: RWA.xyz's public Solana network page, backed by the same dataset documented by its API and methodology pages.
- Endpoint:
  - canonical page: `https://app.rwa.xyz/networks/solana`;
  - keyless Next.js data document: `https://app.rwa.xyz/_next/data/{buildId}/networks/solana.json?networkSlug=solana`, with `buildId` discovered from the canonical page rather than hard-coded;
  - embedded `__NEXT_DATA__` in the canonical HTML is an equivalent fallback representation.
- Authentication: none for the public page/data document. RWA.xyz's documented v4 API does require a bearer key, so it is not the production contract.
- Methodology:
  1. Resolve the current build identifier from the canonical page.
  2. Read the Solana network aggregate named `RWA 30D Transfer Volume`.
  3. Read the `Stocks` asset-class statistic `trailing30dTransferVolume`.
  4. Require USD denomination, finite non-negative values, the expected network/category identifiers, and a provider update timestamp.
  5. Store the source timestamp and source labels, and preserve last-known-good values if the page contract changes.
- History: the public payload exposes current and comparison observations (including 7/30/90-day comparison values for asset classes), but not a dense historical series for every day. Append one normalized daily observation locally.
- Live shape observed 2026-08-20, for provider date 2026-08-19:
  - Solana non-stablecoin RWA trailing-30-day transfer volume: about USD 2.922 billion;
  - Solana `Stocks` trailing-30-day transfer volume: about USD 1.952 billion;
  - `Stocks` asset count was 1,132, useful for validation/provenance but not a frozen dashboard metric.
- Advantages: broad Solana coverage, a coherent total/equity definition, keyless, source timestamps, source-documented daily refresh and methodology.
- Disadvantages: the keyless document is a public website data contract rather than a documented versioned API; payload is large; build paths and object shape can change; taxonomy revisions can restate results.

### Option B — Documented RWA.xyz API v4

- Source: RWA.xyz API v4.
- Endpoint: documented network, measure, and time-series resources under `https://api.rwa.xyz/v4/`.
- Authentication: bearer API key required.
- Methodology/history: the same RWA data model supports measures, filters, and time series. Measure 1007 is trailing-30-day transfer volume in USD; categories include stocks, debt, commodities, and other real-world assets.
- Advantages: documented and versioned machine contract; better historical querying and explicit schemas.
- Disadvantages: violates the no-mandatory-key preference and cannot be the default source. It may be documented as a future replacement if the project operator voluntarily supplies a free key, but the submitted project must work without one.

### Option C — xStocks registry plus DEX market data

- Sources:
  - Backed/xStocks public token registry: `GET https://api.backed.fi/api/v1/token?type=xstocks`;
  - DexScreener token-pair endpoint for Solana mints.
- Authentication: none for the evaluated endpoints.
- Methodology: identify Solana xStocks mints from the issuer registry, fetch their pairs in batches, deduplicate pools, and sum rolling 24-hour DEX volume.
- History: no complete historical transfer series without building one locally; DexScreener supplies market/pair activity, not all token transfers.
- Advantages: keyless, easy to audit, specifically equity-oriented.
- Disadvantages: covers one issuer/framework rather than Solana tokenized assets; measures DEX trading rather than on-chain transfer volume; double-counting and pair-coverage risks. It is only a fallback/cross-check and cannot satisfy the primary metric by itself.

### Recommended candidate

Option A. Publish two explicitly named rolling measures from one coherent dataset:

```text
Solana tokenized-asset transfer volume, trailing 30d, USD
Solana tokenized-equity transfer volume, trailing 30d, USD
```

Parse the current build dynamically, validate semantic labels rather than relying only on array positions, retain provider timestamps, and fail stale instead of replacing values if the public representation changes. Do not add asset count or tokenized-asset market value as headline metrics.

### Dependencies

- HTTP validation and last-known-good preservation from Research 13.
- Own compact daily history selected in Research 10.
- Methodology copy that distinguishes transfers from trades and mints/burns.
- Alert logic does not consume this metric; no tokenized-asset alert is required.

### Produced data

`scalar`, `time series`, `status`

### Update characteristics

- Provider refresh: daily, with data generally refreshed around midnight UTC.
- Reasonable collection frequency: daily; a more frequent shared pipeline may reuse the unchanged provider observation.
- History: append at most one point per provider date for total RWA and stocks.
- Expected normalized history: only tens of kilobytes per year.

### Risks / Open Questions

- The keyless Next.js data document is not guaranteed as a stable public API. Schema assertions and last-known-good behavior are mandatory.
- RWA.xyz may add assets retrospectively or change classifications; comparisons can reflect methodology/coverage changes as well as activity.
- Transfer volume excludes mint and burn events, so it does not represent issuance or redemptions.
- USD conversion depends on the provider's pricing sources and available historical prices.
- The public payload is much larger than the two required values; the collector must immediately normalize it rather than publish the raw document.

### Sources

- RWA.xyz Solana network page: https://app.rwa.xyz/networks/solana
- RWA.xyz API overview: https://docs.rwa.xyz/api/overview
- RWA.xyz authentication: https://docs.rwa.xyz/api/authentication
- RWA.xyz time series: https://docs.rwa.xyz/api/timeseries
- RWA.xyz measures: https://docs.rwa.xyz/schemas/measures
- RWA.xyz data coverage: https://docs.rwa.xyz/methodology/data-coverage
- RWA.xyz data sourcing: https://docs.rwa.xyz/methodology/data-sourcing
- RWA.xyz update policy: https://docs.rwa.xyz/methodology/data-update
- xStocks OpenAPI: https://api.backed.fi/api-docs/
- DexScreener API reference: https://docs.dexscreener.com/api/reference
- Solana Foundation xStocks case study: https://solana.com/id/news/case-study-xstocks

## Requirement — Daily active addresses

### Meaning

The defensible no-key proxy is:

> The number of unique Solana transaction-initiating signers/fee payers observed during a completed UTC day.

An address is not a person: one user can control many addresses, custodial or sponsored systems can represent many users behind different transaction patterns, and programs are not counted unless they initiate/sign transactions. The source providers do not all use exactly the same population. The candidate therefore combines only observations whose disclosed semantics align with initiating signers/fee payers and preserves the contributing provider values.

### Option A — Solana Foundation public data aggregator

- Source: Solana Foundation's open-source Solana Data aggregator and public Databricks route.
- Endpoint: `GET https://solana.com/api/databricks/data?days=365`.
- Authentication: none.
- Methodology:
  1. Select rows with metric name `Fee Payers`, unit `Count`, and a completed UTC date.
  2. Use semantically aligned provider observations. Allium exposes `tx_initiating_addresses`; Dune counts distinct transaction signers. Both produced nearly identical live values.
  3. Calculate a deterministic median of the aligned provider values for each date. With two values this is their arithmetic midpoint.
  4. Retain each provider observation and provenance so disagreement is visible and auditable.
  5. Do not mix Artemis into this consensus: its published query counts distinct signers of successful transactions, deliberately including fee-sponsored users, and therefore represents a broader population.
- History: up to 365 daily observations are returned; no own history is necessary for charts within that horizon, though the normalized snapshot may retain a bounded subset.
- Live observation: for 2026-08-18, Allium returned 2,508,219 and Dune 2,508,175; the route was generated 2026-08-19.
- Advantages: first-party public aggregation, no key, long chart-ready history, multiple independent providers, open-source metric/query definitions.
- Disadvantages: one-day lag; unversioned web route; provider semantics and coverage are not perfectly interchangeable; historical rows can be revised.

### Option B — One public aggregator provider only

- Source/endpoint: the same Solana Foundation route, selecting Dune or Allium only.
- Authentication: none.
- Methodology/history: use one provider's daily initiating-address series exactly as published.
- Advantages: simplest and avoids combining estimates.
- Disadvantages: creates a single-provider dependency and makes gaps more likely. The two aligned series are close enough that a deterministic consensus is a better local candidate while still retaining raw observations.

### Option C — Direct daily calculation from Solana RPC

- Source: finalized blocks from official Solana RPC.
- Endpoints: `getBlocks` and `getBlock` for every produced slot in a UTC day.
- Authentication: public RPC is keyless.
- Methodology: decode every transaction, identify the initiating signer/fee payer, insert it into an exact set, and count distinct keys.
- History: self-built only.
- Advantages: fully on-chain and exact under a frozen definition.
- Disadvantages: roughly 216,000 slots/day at a 400ms target, huge block payloads, archive/retention limits, and public rate limits. An exact daily scan is not operationally reasonable for this static-first project.

### Recommended candidate

Option A: latest completed-day median of Allium and Dune `Fee Payers`, with their individual values retained in provenance. Call the metric “daily active addresses (unique initiating signers/fee payers)” in methodology and never equate it with unique humans.

### Dependencies

- Provider-semantic allowlist and validation in the collector.
- Data-source timestamp distinct from snapshot `updatedAt`.
- Dashboard tooltip/methodology that explains the proxy and one-day lag.

### Produced data

`scalar`, `time series`, `status`

### Update characteristics

- Source refresh: daily, normally one completed day behind.
- Reasonable collection frequency: daily; the shared scheduler may check more often without duplicating history.
- History: provider supplies up to 365 daily points; normalized data size is small (well below one megabyte).

### Risks / Open Questions

- “Active address” is not standardized. Artemis, Blockworks, Token Terminal, Top Ledger, Dune, and Allium can differ on success filtering, signer roles, and sponsored transactions.
- Adding a new provider to the median is a methodology change, not merely a configuration edit.
- Current UTC-day rows must be excluded even if present.
- Provider divergence should fail or be flagged by validation rather than silently producing a misleading consensus.

### Sources

- Solana public data route: https://solana.com/api/databricks/data?days=365
- Solana Data aggregator repository: https://github.com/solana-foundation/solana-data-aggregator
- Overview metric definitions: https://github.com/solana-foundation/solana-data-aggregator/blob/main/metrics/overview.py
- Provider implementation directory: https://github.com/solana-foundation/solana-data-aggregator/tree/main/providers

## Requirement — Ecosystem and Community News

### Meaning

Show a bounded list of recent source-authored ecosystem/community items with title, publication time, canonical link, and optional source description. The project must not generate analysis or summaries. News is editorial content, not a growth metric and not an alert.

### Option A — Official Solana News RSS

- Source: Solana Foundation's official News feed.
- Endpoint: `GET https://solana.com/news/rss.xml`.
- Authentication: none.
- Methodology: parse RSS 2.0; require non-empty title, HTTPS canonical link, unique GUID/link, and valid `pubDate`; strip/sanitize HTML from an optional provider-written description; sort descending and cap to the latest eight items.
- History: the feed is bounded by its publisher and provides recent items, not a permanent archive.
- Advantages: first-party, keyless, compact, standard XML, includes ecosystem roundups and community-oriented posts, source-written copy avoids AI analysis.
- Disadvantages: only official Solana editorial coverage; feed retention and cadence are publisher-controlled.

### Option B — Solana media repository content

- Source: `apps/media/content/posts` in the public `solana-foundation/solana-com` repository.
- Endpoint: GitHub contents/tree APIs or raw MDX files.
- Authentication: none within GitHub's low unauthenticated rate limit.
- Methodology/history: enumerate published post frontmatter and sort by `publishedAt`.
- Advantages: source-controlled archive and explicit metadata.
- Disadvantages: many requests or a large tree response, GitHub unauthenticated rate limits, draft/filtering logic, and more parsing surface than RSS. Suitable fallback only.

### Option C — General news/search/social feeds

- Sources: generic news search, social APIs, or third-party crypto feeds.
- Authentication: varies; often keyed or unstable.
- Advantages: broader coverage.
- Disadvantages: duplication, spam, uncertain provenance, copyright risk, unstable contracts, and pressure to summarize. It adds providers without a bounty requirement for exhaustive media monitoring and is rejected.

### Recommended candidate

Option A. Store and render the latest eight official RSS items. Preserve source titles/descriptions verbatim except safe HTML stripping and length bounding; do not generate commentary.

### Dependencies

- Safe XML parser and URL/text sanitation.
- Stale preservation if the feed fails.
- Dashboard/report link rendering; no alert dependency.

### Produced data

`table`, `status`

### Update characteristics

- Reasonable refresh: each shared scheduled update.
- Expected size: a few kilobytes after normalizing eight items.
- No own history required beyond the current bounded feed.

### Risks / Open Questions

- The official feed may not cover every independent community story. It is nevertheless the highest-trust minimal source.
- RSS descriptions can contain markup and must never be injected as raw HTML.
- A future feed outage must mark the retained list stale, not erase it.

### Sources

- Solana News: https://solana.com/news
- Official RSS feed: https://solana.com/news/rss.xml
- Solana website repository: https://github.com/solana-foundation/solana-com

## Requirement — Upcoming upgrades/developments, including Alpenglow and SIMD-525

### Meaning

Show Solana Foundation-curated network upgrades that are not fully complete, with their source title, short description/subtitle, release grouping, explicit rollout stage, publication/update context, and canonical detail link. Proposal status and deployment status are different concepts: the official upgrades hub is authoritative for rollout presentation, while SIMD documents provide protocol proposal detail.

### Option A — Official Solana Upgrades hub and source MDX

- Sources:
  - public hub: `https://solana.com/upgrades`;
  - public source files under `apps/media/content/upgrades` in the Solana website repository.
- Authentication: none.
- Endpoint/methodology:
  1. Fetch the hub and parse its release groups and upgrade cards.
  2. Keep cards whose stage is not `Live on Mainnet`/`live`; current source stages include `in_development` and `pending_activation`.
  3. Normalize only source-authored title, subtitle, stage, release, key metrics, and canonical detail URL.
  4. Require Alpenglow and Reduced Slot Times/SIMD-0525 to be present while they remain upcoming. Treat their absence after becoming live as a source-state transition that requires a deliberate fixture/methodology update, not fabricated retention.
  5. Store the retrieval timestamp. The hub itself is the current status source; individual MDX `publishedAt` values describe editorial publication, not necessarily last status change.
- Current source evidence:
  - Alpenglow is grouped under planned Agave 4.3 and marked `In Development`; its official page links SIMD-0326.
  - Reduced Slot Times is grouped under Agave 4.2 and marked `Pending Feature Activation`; its official page says it implements SIMD-0525 in four staged reductions from 400ms to 200ms.
- History: current-state list only. No bounty requirement for upgrade-status history.
- Advantages: first-party curated scope, explicit deployment stages, no key, concise list, directly covers both listing examples.
- Disadvantages: HTML/website representation is not a versioned API; hub structure can change; source does not expose a true `updatedAt` for every card.

### Option B — Solana improvement documents repository

- Source: `solana-foundation/solana-improvement-documents`.
- Endpoints: repository tree/raw proposal Markdown, including:
  - `proposals/0326-alpenglow.md`;
  - `proposals/0525-reduce-slot-times.md`.
- Authentication: raw files are keyless; GitHub API is keyless within unauthenticated limits.
- Methodology: parse SIMD frontmatter (`simd`, title, type, category, proposal status, created date) and selected source links.
- History: Git history is available but unnecessary.
- Advantages: primary protocol specifications, stable identifiers, exact proposal status and design.
- Disadvantages: proposal status does not say whether a feature is deployed; enumerating every open SIMD would invent a much broader product feature. Use as supporting provenance, not as the rollout list.

### Option C — Validator release schedules and announcements

- Sources: Anza Agave release wiki, GitHub releases, and validator announcements.
- Authentication: generally keyless.
- Advantages: detailed activation schedules and operational context.
- Disadvantages: fragmented, tentative, and client-specific; more scraping and reconciliation. Useful linked evidence for an individual upgrade, not the canonical current list.

### Recommended candidate

Option A for the bounded upcoming-upgrade list, with official SIMD links retained from each detail page. The collector should normalize the hub's current non-live cards rather than maintain a hand-written roadmap. Option B supplies source links and exact proposal identifiers for Alpenglow (SIMD-0326) and Reduced Slot Times (SIMD-0525), but does not drive deployment status.

### Dependencies

- HTML or structured-page parser with strict shape validation.
- A small allowlist of recognized source stages, with unknown stages causing validation failure rather than automatic inclusion/exclusion.
- Stale preservation from Research 13.
- News and upgrades remain distinct arrays in the eventual schema.

### Produced data

`table`, `status`

### Update characteristics

- Reasonable refresh: daily or on each shared update.
- Expected size: fewer than a dozen normalized cards, typically under 20 KB.
- No own time-series history required.

### Risks / Open Questions

- Status text can change as features activate. The parser must key on normalized source values and fail safely on unknown values.
- An editorial `publishedAt` date is not a deployment-status timestamp; label it accurately.
- SIMD-0326's repository status was `Review` while the upgrades hub said `In Development`; this is not a contradiction because proposal process and rollout are different state machines.
- SIMD-0525 and its official upgrade page describe a staged rollout. A single top-level stage does not prove every gate is active.
- The website HTML is a public presentation contract, not a formal API. Source-MDX frontmatter can be a fallback, but GitHub request limits and repo-path changes must be considered.

### Sources

- Solana Upgrades hub: https://solana.com/upgrades
- Official Alpenglow upgrade page/source: https://solana.com/upgrades/alpenglow
- Official Reduced Slot Times page: https://solana.com/upgrades/reduced-slot-times
- Alpenglow source MDX: https://github.com/solana-foundation/solana-com/blob/main/apps/media/content/upgrades/alpenglow.mdx
- Reduced Slot Times source MDX: https://github.com/solana-foundation/solana-com/blob/main/apps/media/content/upgrades/reduced-slot-times.mdx
- SIMD repository: https://github.com/solana-foundation/solana-improvement-documents
- SIMD-0326 Alpenglow: https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0326-alpenglow.md
- SIMD-0525 Reduce Slot Times: https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0525-reduce-slot-times.md
