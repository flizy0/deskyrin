# Research 3 — SOL Price and TVL

Status: complete (local candidates only; no global architecture decision)  
Researched: 2026-08-20

## Provider facts

DefiLlama documents a free, no-auth API separately from its paid Pro API. The needed coin-price and chain-TVL resources are in the free set. Live tests on 2026-08-20 confirmed:

- `https://coins.llama.fi/prices/current/coingecko:solana` returned price, symbol, provider timestamp, and confidence.
- `https://coins.llama.fi/percentage/coingecko:solana?period=24h` returned a 24-hour percentage change.
- `https://coins.llama.fi/chart/coingecko:solana?...` returned requested timestamp/price points.
- `https://api.llama.fi/v2/historicalChainTvl/Solana` returned 1,982 daily points beginning in March 2021 and continuing through the most recent completed provider day.

The current DefiLlama documentation page states one base URL for free endpoints, but the live price endpoint is served from `coins.llama.fi`; the nominal `api.llama.fi/prices/current/...` path returned HTTP 404 during research. Treat host/path availability as part of contract tests rather than assuming the documentation summary is sufficient.

---

## Requirement

SOL current price and historical price movement.

## Meaning

Current SOL/USD reference price, its deterministic 24-hour percentage movement, and a bounded historical price series suitable for an interactive trend chart. This is a market reference price, not an executable quote on a particular exchange.

## Option A — DefiLlama Coins API

- Source: DefiLlama free Coins API, using the canonical `coingecko:solana` identifier.
- Endpoints:
  - `/prices/current/coingecko:solana` on `coins.llama.fi`.
  - `/percentage/coingecko:solana?period=24h`.
  - `/chart/coingecko:solana` with explicit `start`, `span`, and `period`.
- Authentication: none.
- Methodology: current USD price and source timestamp come directly from the current response. Use the documented 24-hour percentage endpoint for movement, and a daily series (local candidate: 30 or 90 days) for the chart. Preserve the response's provider timestamp and fetch timestamp separately.
- History: requested regular intervals; a 31-point daily request was validated successfully.
- Advantages: no key, documented free API, current and historical data from one source family, small responses, simple automation.
- Disadvantages: provider methodology aggregates other market sources; no SLA or published exact free rate quota; the price host differs from the documentation's headline base-URL statement.

## Option B — CoinGecko Keyless Public API

- Source: CoinGecko's officially documented Keyless Public API.
- Endpoints:
  - `/api/v3/simple/price?ids=solana&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true`.
  - `/api/v3/coins/solana/market_chart?vs_currency=usd&days=30&interval=daily`.
- Authentication: none.
- Methodology: use CoinGecko's current USD price, 24-hour change, last-updated timestamp, and daily market chart.
- History: keyless market-chart endpoint is available, subject to public-tier limits.
- Advantages: authoritative documented keyless interface; the simple-price call returns price, movement, and timestamp together.
- Disadvantages: CoinGecko explicitly says the keyless service has dynamic shared-IP limits (approximately 10–30 CoinGecko calls/minute), is not suitable for scheduled production polling, and can return 429. It is also not fully independent from a DefiLlama series identified via CoinGecko.

## Option C — On-chain oracle or venue-derived price

- Source: a Pyth price feed, an on-chain liquidity pool, or another Solana oracle/venue.
- Authentication: Solana RPC or a public oracle endpoint can be keyless.
- Methodology: decode current oracle price or calculate a pool/oracle reference value.
- History: generally unavailable from standard RPC without retained snapshots or an indexer.
- Advantages: on-chain/current and independent of a general market-data API.
- Disadvantages: additional protocol-specific decoding, feed identifiers, confidence/exponent handling, and no convenient long history; a single venue is not the same as broad SOL market price.

## Recommended candidate

Option A as primary. Option B is a documented, occasional fallback for current price and 24-hour movement, not a parallel source polled on every run. Keep last-known-good DefiLlama history if both are unavailable. Provider switching must be recorded in provenance so a change in methodology is visible.

## Dependencies

- Common HTTP client, retry/backoff, response validation, source timestamps, and last-known-good behavior.
- Research 9 for the “large SOL price move” threshold.
- Dashboard chart window selection during synthesis.

## Produced data

`scalar`, `time series`, `status`

## Update characteristics

- Current price: reasonable refresh every 15–60 minutes; hourly is sufficient for a scheduled static report and will be reconciled with deployment limits.
- Daily history: fetch/normalize a bounded window on each successful provider call; no first-party history storage is required.
- Expected response size is tens of kilobytes or less for a bounded chart.

## Risks / Open Questions

- Validate finite positive price, plausible timestamp, expected symbol, and a bounded percentage value.
- Daily history may end at the latest completed provider day while current price is newer. Append the current observation to the displayed chart only with its real timestamp; do not relabel it as a daily close.
- The DefiLlama coin identifier delegates some underlying price methodology to CoinGecko or DefiLlama's adapters. The output must identify DefiLlama as the direct source and avoid claiming exchange execution precision.
- Fallback values from another provider should not be spliced invisibly into the primary daily series.

---

## Requirement

TVL and historical TVL needed for the named large-TVL-change alert.

## Meaning

USD value locked in Solana DeFi under one stable provider methodology. TVL is an alert input named by the listing, not a separately frozen headline economic metric. DefiLlama's documented chain TVL excludes liquid staking and double-counted TVL.

## Option A — DefiLlama historical chain TVL

- Source: DefiLlama free API.
- Endpoint: `GET https://api.llama.fi/v2/historicalChainTvl/Solana`.
- Authentication: none.
- Methodology: use provider daily `{date, tvl}` observations. The latest complete daily observation is the current alert reference. `dailyChangePercent = 100 * (latest / previous - 1)` when both adjacent valid days are present.
- History: full daily chain history was available from 2021 in the live test.
- Advantages: explicitly named by the bounty, no key, documented methodology exclusion, long history, one request, no local TVL history needed.
- Disadvantages: typically daily rather than live; provider adapters and category exclusions define coverage; no formal SLA or exact public rate guarantee.

## Option B — DefiLlama current chains endpoint plus history

- Source: DefiLlama free API.
- Endpoints: `/v2/chains` for a current chain row plus `/v2/historicalChainTvl/Solana` for daily history.
- Authentication: none.
- Methodology: use current chain TVL for display and compare against an older daily point.
- History: same historical endpoint as Option A.
- Advantages: potentially fresher headline value.
- Disadvantages: current response does not expose a source timestamp in its documented shape, and comparing an intraday value to completed daily points creates an ambiguous alert window; adds a call.

## Option C — Sum protocol-level TVL or use another indexer

- Source: DefiLlama `/protocols`, Dune, Artemis, or another analytics provider.
- Authentication: varies; common stable APIs require keys.
- Methodology: sum Solana protocol values after resolving double-counted, borrowed, staking, and multi-chain categories.
- History: provider dependent.
- Advantages: more granular breakdown could be constructed.
- Disadvantages: easy to double count and to diverge from the accepted aggregate methodology; unnecessary for the alert requirement; more data and dependencies.

## Recommended candidate

Option A. Use the two newest valid, distinct daily points for a transparent day-over-day alert and retain a bounded normalized history for evidence. Do not mix the timestamp-less current `/v2/chains` value into that daily comparison.

## Dependencies

- Research 9 for the large-change threshold and false-positive rules.
- Common provider freshness and last-known-good handling.

## Produced data

`time series`, `scalar`, `status`

## Update characteristics

- Provider data is daily; polling more than every few hours offers little benefit. The shared pipeline may run more often, but should cache/accept unchanged daily observations.
- No own historical accumulation is necessary because the endpoint supplies long history.
- Full response observed roughly two thousand small points; normalize only the final bounded window needed for dashboard/alert, while validating ordering and latest freshness.

## Risks / Open Questions

- The endpoint may lag a UTC day. Mark source time separately and allow an explicit freshness budget appropriate to daily data (candidate: 48 hours, finalized in Research 13).
- A provider methodology or adapter revision can produce a step change that resembles an anomaly. The alert explanation must identify the source and daily values; Research 9 should consider a persistence or data-quality guard.
- There is no comparably simple, documented, independent, no-key aggregate TVL fallback. On failure, preserving and marking last-known-good data is safer than synthesizing a partial sum.

## Cross-requirement local candidate

Use DefiLlama's free API as the direct primary source for SOL price/movement and daily Solana TVL. CoinGecko Keyless is a low-frequency price fallback only. Provider-supplied histories mean neither metric needs an expanding local historical database; retain normalized bounded series in the generated snapshot and preserve last-known-good values during outages.

## Sources

- DefiLlama API overview and free/pro distinction: https://api-docs.defillama.com/
- DefiLlama free endpoint reference: https://api-docs.defillama.com/llms-free.txt
- DefiLlama price SDK examples: https://github.com/DefiLlama/api-sdk
- CoinGecko Keyless Public API and limits: https://docs.coingecko.com/docs/keyless-public-api
- CoinGecko historical chart endpoint: https://docs.coingecko.com/reference/coins-id-market-chart
