# Research 6 — Real Economic Value (REV)

Status: complete (local candidate only; no global architecture decision)  
Researched: 2026-08-20

## Requirement

Show Solana Real Economic Value without relabelling ordinary protocol revenue as REV. Research the accepted definition, base fees, priority fees, vote fees, MEV/Jito tips, history, free endpoints, independent calculation, and limitations.

## Meaning

REV measures the value users pay for transaction execution. For Solana, the accepted composition is:

```text
REV = vote transaction fees
    + non-vote base fees
    + non-vote priority fees
    + out-of-protocol Jito tips
```

Equivalently, when the network-fee source already includes every transaction:

```text
daily REV (SOL) = daily transaction fees (SOL) + daily gross Jito tips (SOL)
```

Blockworks describes this as all transaction fees and out-of-protocol tips paid for execution. It explicitly separates vote fees, non-vote base fees, priority fees, and Jito tips. REV excludes inflationary token issuance, staking rewards, application revenue, DEX protocol fees, and TVL.

For the public Jito daily response, the two tip destinations are disjoint:

```text
gross Jito tips = validator_tips + jito_tips
```

`validator_tips` is the amount distributed to validators; `jito_tips` is the amount paid to Jito. Summing both measures the gross execution payment and avoids assuming a particular protocol-fee split. The observed split has changed documentation over time, so neither field should be scaled to infer the other.

## Option A — Blockworks native REV metric

- Source: Blockworks Research Solana Financials.
- Endpoint: `GET https://api.blockworks.com/v1/metrics/rev-native?project=solana`.
- Authentication: required `x-api-key`; an unauthenticated live request returned HTTP 401.
- Methodology: daily native SOL REV following the four-component definition above.
- History: daily series exposed by the metric API/dashboard.
- Advantages: directly named REV, accepted methodology, one already-aggregated series, native denomination.
- Disadvantages: mandatory credential and potentially paid access conflict with the bounty preference; cannot be the required production source.

## Option B — Construct REV from public Solana and Jito datasets

- Sources:
  - Solana Foundation's public Solana Data dashboard for total network transaction fees.
  - Jito Foundation's documented Daily MEV Rewards API for out-of-protocol tips.
- Endpoints:
  - `GET https://solana.com/api/databricks/data?days=365`, filtering `metricName == "Fees"` and `unit == "SOL"`.
  - `GET https://kobe.mainnet.jito.network/api/v1/daily_mev_rewards`.
- Authentication: none for either live endpoint.
- Methodology:
  1. Normalize Solana Data fee rows by UTC date and provider. The dashboard defines `Fees` as base plus priority fees; source collectors query all Solana transactions, so vote-transaction base fees are included in the network total.
  2. Retain provider observations and choose one deterministic daily consensus value during architecture synthesis (local candidate: median of valid provider values, with provider count/range retained as provenance).
  3. Normalize Jito's descending daily data and compute `grossJitoTipsSol = validator_tips + jito_tips`.
  4. Inner-join the two series on completed UTC date. Use the newest common complete date, never a partial current day.
  5. Compute `revSol = transactionFeesSol + grossJitoTipsSol`.
  6. If USD presentation is selected later, multiply each component by a documented same-day SOL price; keep native SOL as the auditable canonical calculation.
- History:
  - Solana Data returned 365 complete days with `truncated: false` in the live test.
  - Jito returned 1,327 descending daily rows, beginning in January 2023 and ending with the prior UTC day at research time.
- Refresh/lag:
  - The Solana Data Aggregator repository states twice-daily refreshes and an intentional one-day lag.
  - Jito documents a 60-second cache for reward queries and returned the prior UTC day in the live test.
  - Therefore the latest common completed date is normally one to two days behind wall-clock time and must be shown as the metric timestamp.
- Live sanity check on 2026-08-18:
  - Solana transaction-fee observations were `8434.861036 SOL` (Allium) and `8434.757426848486 SOL` (Dune).
  - Jito returned `73.85317130850063 SOL` to Jito plus `1403.210254861517 SOL` to validators, or `1477.0634261700175 SOL` gross tips.
  - The local median-fee candidate therefore gives approximately `9911.872658 SOL` REV for that completed date. This is a research-time validation, not a hard-coded value.
- Advantages: no key; daily history; accepted component formula; first-party Jito tip data; no block indexer or backend; native values; auditable component breakdown.
- Disadvantages: the Solana Data route is a public endpoint used by the official dashboard but is not presented as a versioned public API contract; its upstream providers can be revised; provider observations can differ slightly; common-date lag is longer than live RPC metrics.

## Option C — DefiLlama network fees plus Jito tips

- Sources: DefiLlama's Solana chain-fee adapter and the same Jito Daily MEV Rewards endpoint.
- Endpoint: `GET https://api.llama.fi/summary/fees/solana?dataType=dailyFees` plus Jito's daily endpoint.
- Authentication: none.
- Methodology:
  - DefiLlama's open adapter queries Allium, sums transaction `fee`, estimates base fee as transaction count multiplied by 5,000 lamports, and treats the remainder as priority fees.
  - DefiLlama converts the balance series to USD; Jito tips would need same-day SOL/USD conversion before addition.
- History: DefiLlama returned 2,040 daily fee points at research time; Jito returned history from January 2023.
- Advantages: public, long history, open adapter, documented free API, useful fallback/cross-check.
- Disadvantages: it does not include Jito tips by itself and therefore is not REV; its base-fee split assumes one 5,000-lamport base unit per transaction rather than counting actual signatures; native fee values are not directly exposed in the returned headline series; it depends on an indexed Allium query and provider pricing.

## Option D — Calculate every component from Solana RPC

- Source: official finalized Solana blocks plus Jito's official `getTipAccounts` list.
- Endpoints: `getBlocks`/`getBlock` and Jito Block Engine `getTipAccounts`.
- Authentication: possible without a key in principle.
- Methodology:
  - Sum `meta.fee` for every transaction in every finalized block over the UTC day.
  - Decode transfers to the current Jito tip accounts and distinguish gross tips from unrelated movements/drains.
  - Aggregate exact block timestamps into UTC days.
- History: requires an archive-capable RPC and persistent local indexing.
- Advantages: on-chain auditability and full control if complete archival infrastructure exists.
- Disadvantages: roughly hundreds of thousands of slots and very large transaction payloads per day; public Solana RPC is not intended for bulk historical indexing; Jito accounts rotate; exact tip attribution needs instruction/inner-instruction parsing; retries across skipped/unavailable blocks are complex; a sample is statistically fragile because tips are heavy-tailed. This is incompatible with the static-first, minimal-dependency requirement.

## Recommended candidate

Option B. It is the only researched candidate that preserves the accepted REV definition, supplies usable daily history, and needs no project API key or continuously running indexer.

Use daily native SOL as the canonical calculation and expose both component values and the completed-date timestamp so the figure is auditable. A USD representation may be derived from the selected historical SOL price series during global architecture design, but it must not replace the native components.

Use Option C only as a fallback/cross-check for the transaction-fee component. It must still be combined with Jito tips and explicitly marked with different methodology. Option A remains the human/reference benchmark, not a production dependency.

## Dependencies

- Research 3's same-day historical SOL price if a USD representation is selected.
- UTC completed-day joining and bounded-history policy from Research 10.
- Per-source provenance, freshness, and last-known-good rules from Research 13.
- Shared HTTP validation for the Solana Data and Jito response contracts.

## Produced data

`scalar`, `time series`, `status`

## Update characteristics

- Reasonable refresh: daily; more frequent polling does not make the completed daily source materially fresher.
- Retain a bounded 90- or 365-day normalized time series for the dashboard.
- Provider history covers the selected chart window, so long-term self-indexing is not required initially.
- A normalized 365-day REV series with components is only tens of kilobytes.
- The latest REV date can legitimately lag the snapshot `updatedAt`; store both timestamps.

## Risks / Open Questions

- Solana Data's `/api/databricks/data` route is first-party and actively used by its dashboard, but not versioned/documented as a stable external API. Contract validation and last-known-good preservation are mandatory.
- Fee-provider values can be missing or differ slightly. Never sum providers. Record the deterministic selection/aggregation rule in final methodology.
- Jito's array is newest-first, unlike most other provider histories. Sort after parsing and reject duplicate dates.
- `jito_tips` and `validator_tips` must both be finite and non-negative. Do not reconstruct gross tips from a hard-coded percentage.
- The Jito API measures Jito-mediated out-of-protocol tips. If another independent out-of-protocol execution market becomes material, the accepted REV definition and source coverage must be revisited rather than silently claiming universal MEV coverage.
- The two sources can close a UTC day at different times. Publish only their latest common complete date; never combine mismatched dates.
- Blockworks' direct number may differ because of fee classification, provider backfills, price convention, or Jito accounting cutoffs. Such variance is a methodology limitation, not evidence that ordinary app revenue should be substituted.
- A sampled RPC estimate is not an acceptable fallback for the headline. Preserve a stale last-known-good exact daily value instead.

## Sources

- Blockworks REV definition and component descriptions: https://blockworks.com/analytics/solana/solana-financials/solana-network-rev
- Blockworks native REV API reference: https://docs.blockworksresearch.com/api-reference/metrics/solana/rev-native
- Solana Network Health Report discussing REV: https://solana.com/vi/news/network-health-report-june-2025
- Solana Data dashboard and fee clarification: https://solana.com/data
- Solana Data Aggregator source and refresh policy: https://github.com/solana-foundation/solana-data-aggregator
- Solana Data fee model: https://github.com/solana-foundation/solana-data-aggregator/blob/main/metrics/overview.py
- Solana Data provider implementations: https://github.com/solana-foundation/solana-data-aggregator/tree/main/providers
- Jito Validator API, including Daily MEV Rewards: https://www.jito.network/docs/jitosol/jitosol-liquid-staking/for-developers/stake-pool-api/
- Jito MEV and Claims API: https://www.jito.network/docs/jitosol/jitosol-liquid-staking/for-developers/mev-and-staker-rewards-api-info/
- Jito tip account JSON-RPC reference: https://github.com/jito-labs/mev-protos/blob/master/json_rpc/http.md
- DefiLlama Solana fee adapter: https://github.com/DefiLlama/dimension-adapters/blob/master/fees/solana.ts
- DefiLlama free API documentation: https://api-docs.defillama.com/llms-free.txt
