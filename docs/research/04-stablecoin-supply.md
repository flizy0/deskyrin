# Research 4 — Stablecoin Supply

Status: complete (local candidate only; no global architecture decision)  
Researched: 2026-08-20

## Requirement

Solana stablecoin supply with current value, historical series, transparent aggregation, asset/chain coverage, and no mandatory API key.

## Meaning

The USD-equivalent circulating value of stablecoins present on Solana under one consistent asset registry and methodology. “Circulating” excludes provider-classified unreleased/reserve balances. It includes both assets minted natively on Solana and representations bridged to Solana.

Because the covered set includes USD, EUR, GBP, CHF, JPY, and other peg types, raw token units cannot be summed meaningfully. The headline is therefore:

`total stablecoin supply (USD) = sum(all finite non-negative values in totalCirculatingUSD by peg type)`

This should be labelled as USD-equivalent circulating stablecoin value, even if the compact dashboard title remains “Stablecoin Supply”. It is not the sum of maximum supplies and not the balance of only USDC/USDT.

## Option A — DefiLlama Pegged Assets / Stablecoins API

- Source: DefiLlama's open-source pegged-assets adapters and free API.
- Endpoints:
  - `GET https://stablecoins.llama.fi/stablecoincharts/Solana` for daily Solana aggregate history.
  - `GET https://stablecoins.llama.fi/stablecoins?includePrices=true` only if a current per-asset breakdown is selected during synthesis.
- Authentication: none.
- Methodology:
  - For each daily chain point, sum `totalCirculatingUSD` values across peg types.
  - Exclude `totalUnreleased`.
  - Preserve native/bridged fields as source methodology metadata; the total circulating value already incorporates both.
  - Use provider dates as source observation times and keep fetch time separately.
- History: the live chain endpoint returned 1,562 daily observations beginning in September 2021 and extending to the latest completed provider day.
- Asset coverage: the live global asset response contained 417 assets, with 72 reporting Solana chain circulation at research time. Coverage changes as DefiLlama's open-source registry changes.
- Advantages: no key, explicitly documented free endpoint, broad asset coverage, long history, native/bridged/unreleased distinctions, public adapter code, one aggregate request.
- Disadvantages: provider-maintained registry and adapters can change; daily rather than live; exact public rate limits/SLA are not guaranteed; response host conventions are not fully captured by the simplified current API docs.

## Option B — Reconstruct from Solana RPC

- Source: official Solana JSON-RPC.
- Endpoints: `getTokenSupply` for every relevant SPL/Token-2022 mint, plus account queries required to remove provider/reserve/unreleased balances and bridge escrow representations.
- Authentication: none on public RPC.
- Methodology: maintain a canonical mint registry, classify native versus bridged representations, query each supply, subtract non-circulating balances, attach a peg/FX price, and aggregate.
- History: standard RPC supplies only current token state; historical supply would require an archive/indexed dataset or first-party accumulation.
- Advantages: direct on-chain verification for a known mint; useful as a spot check of a few major assets.
- Disadvantages: RPC cannot infer that a token is a legitimate stablecoin; dozens of assets and multiple mint/bridge variants require continuous curation; reserve exclusions and non-USD conversion are hard; many calls; no backfill. It is not a realistic comprehensive aggregate without recreating an indexer/registry.

## Option C — Dune/Artemis/other indexed analytics

- Source: third-party indexed queries or dashboards.
- Endpoint/authentication: stable machine-readable APIs generally require a query/API key; public HTML is not a durable data contract.
- Methodology/history: provider/query dependent.
- Advantages: custom classifications and SQL-level auditability may be possible.
- Disadvantages: mandatory key or brittle scraping, query maintenance, rate/credit constraints, and no clear advantage over the dedicated free DefiLlama dataset.

## Recommended candidate

Option A. The aggregate historical chain endpoint alone is sufficient for the required headline and chart. Do not make the much larger global per-asset endpoint a hard dependency unless synthesis decides a small asset breakdown materially improves interpretation of the required supply metric.

RPC may be used in tests to spot-check selected major mints, but a partial mint list must never be presented as a fallback aggregate. If DefiLlama is unavailable, preserve and mark the last-known-good aggregate as stale.

## Dependencies

- Shared HTTP validation, retry/backoff, freshness, and last-known-good behavior.
- Storage/output synthesis for a bounded provider-supplied daily series.
- Explicit exclusion of stablecoins from any non-stablecoin tokenized-asset/RWA total in Research 8 to avoid category overlap.

## Produced data

`scalar`, `time series`, optionally `table`

## Update characteristics

- Provider cadence: daily.
- Reasonable fetch cadence: every shared pipeline run is acceptable at hourly-or-slower operation, though the normalized data usually changes once daily.
- Own historical accumulation: not required; retain a bounded normalized provider window (local candidate: 90 or 365 daily points).
- Aggregate history is modest: roughly 1,500 small records before trimming. The optional all-assets response is much larger and should not be fetched without a display need.

## Risks / Open Questions

- `totalCirculatingUSD` is market-value adjusted. A depeg can change the USD headline without token issuance/redemption; this is a methodology property, not necessarily a data error.
- Summing raw `totalCirculating` values across peg types would be invalid. Validate and sum the USD-normalized object only.
- Historical `date` values are numeric Unix seconds encoded as strings in the live response; normalize deliberately and reject malformed/non-monotonic points.
- Adapter additions, removals, bridge reclassification, or corrected history can create discontinuities. Preserve source attribution and do not describe every discontinuity as organic issuance.
- The provider's asset registry is broad, but no aggregate can prove exhaustive coverage of every unregistered stablecoin mint.
- `totalMintedUSD + totalBridgedToUSD` can explain the aggregate, while `totalUnreleased` must remain excluded. These supporting fields are methodology evidence, not additional headline metrics.

## Sources

- DefiLlama API overview and free stablecoin endpoints: https://api-docs.defillama.com/
- DefiLlama free endpoint reference: https://api-docs.defillama.com/llms-free.txt
- DefiLlama pegged-assets server and adapter methodology: https://github.com/DefiLlama/peggedassets-server
- DefiLlama API SDK stablecoin examples: https://github.com/DefiLlama/api-sdk
- Solana RPC `getTokenSupply` (useful only for individual-mint verification): https://solana.com/docs/rpc/http/gettokensupply
