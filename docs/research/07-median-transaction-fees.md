# Research 7 — Median Transaction Fees

Status: complete (local candidate only; no global architecture decision)  
Researched: 2026-08-20

## Requirement

Show a defensible Solana median transaction fee, with an explicit definition, timeframe, sampling/full-calculation trade-off, RPC cost, history, accuracy, and update frequency. Do not relabel a prioritization-fee quote or a sender-specific statistic as the network-wide median transaction fee.

## Meaning

The locally recommended definition is:

> The median of the actual `meta.fee` values paid by all recorded transactions—successful or failed, vote or non-vote—in a deterministic, stratified sample of finalized Solana blocks spanning the trailing hour.

`meta.fee` is an integer number of lamports charged to the transaction. Solana's total fee is the base fee plus any priority fee, and fees are charged even when execution fails. Including vote transactions follows the literal network-transaction population and best matches the available benchmark definition; a separate non-vote-only median would be a different metric and is not required by the bounty.

For sorted fees `x[0..n-1]`:

```text
median = x[(n-1)/2]                         when n is odd
median = (x[n/2 - 1] + x[n/2]) / 2         when n is even
```

Store lamports as the canonical unit and derive SOL only for display (`lamports / 1_000_000_000`). The sample window and observation count are part of the methodology, not extra product metrics.

## Option A — Deterministic finalized-block sample via Solana RPC

- Source: official Solana JSON-RPC.
- Endpoints:
  - `getSlot` at `finalized` commitment for the sample endpoint;
  - `getBlocks` for produced slots in the trailing window;
  - `getBlock` with `transactionDetails: "accounts"`, `rewards: false`, `encoding: "json"`, and `maxSupportedTransactionVersion: 0`.
- Authentication: none on Solana's public mainnet endpoint.
- Methodology:
  1. Capture one finalized end slot.
  2. Use a trailing one-hour approximation of 9,000 slots and call `getBlocks` to remove skipped slots.
  3. Divide the returned produced-slot list into 16 equal strata and select the midpoint slot in each stratum. This is deterministic for the captured window and avoids a recent-block cluster.
  4. Fetch selected blocks in batches of at most eight. Require a response for every selected slot; retry bounded transient failures. Never silently compute from an incomplete sample.
  5. Extract every safe, finite, non-negative integer `meta.fee` from every returned transaction. Include successful, failed, vote, and non-vote transactions.
  6. Sort the pooled observations and calculate the exact sample median.
  7. Record the start/end slots, block count, transaction count, commitment, and observation timestamp alongside the result.
- Timeframe: trailing approximately one hour at collection time; the exact slot range is retained.
- History: RPC supplies blocks, not a ready-made median series. Append one normalized observation per successful scheduled update and bound retained history according to Research 10.
- Live feasibility result on 2026-08-20:
  - 8,953 produced slots in a 9,000-slot window;
  - 16/16 selected blocks returned when fetched as two batches of eight;
  - 30,250 transaction fee observations;
  - pooled median `5,001` lamports, interquartile range `5,000–7,994` lamports;
  - combined block-request time approximately 24.6 seconds on the public endpoint.
- Stability check: a separate 24-slot attempt yielded a pooled median of `5,003` lamports; temporal six-block groups were `5,003`, `5,001`, and `5,008` lamports before incomplete responses affected the final group. The values validate the sample scale but are research observations, not fixtures.
- Advantages: actual on-chain charged fees; no key; no third-party semantic dependency; auditable formula; feasible in a scheduled static pipeline; sampling captures tens of thousands of transactions.
- Disadvantages: estimate rather than exact population median; public RPC latency and rate limits; own history required; results can vary with slot selection; block response contracts are large enough to require careful chunking.

## Option B — Blockworks Research median transaction fee

- Source: Blockworks Research Solana metrics.
- Endpoints:
  - native: `GET https://api.blockworks.com/v1/metrics/transaction-fee-med-native?project=solana`;
  - USD: `GET https://api.blockworks.com/v1/metrics/transaction-fee-med-usd?project=solana`.
- Authentication: required `x-api-key` for the documented API.
- Methodology: Blockworks defines the daily metric as the median of the sum of base fee and priority fee that day.
- History: documented daily time series.
- Public page observation: the Blockworks Index page embeds a current `median_fee_usd` value and labels it “Median Fee (7d)”, but this is presentation HTML rather than a stable, documented no-key data contract.
- Advantages: independently calculated benchmark; directly matches the requested concept; historical daily data.
- Disadvantages: documented machine endpoint requires a key; the keyless HTML is brittle, current-only, and has a different seven-day presentation window. It is suitable for human validation, not the production source.

## Option C — Public dataset or prioritization-fee proxy

- Sources evaluated:
  - Coin Metrics Community API;
  - Solana `getRecentPrioritizationFees`;
  - Solana Data transaction-sender statistics.
- Authentication/history:
  - Coin Metrics Community is keyless with documented rate limits, but its Solana catalog did not expose `FeeMedNtv`; requesting it returned HTTP 403.
  - `getRecentPrioritizationFees` is keyless but only returns recent prioritization-fee estimates for blocks/account locks.
  - Solana Data exposes “Sender Median Fee” for specific transaction-sending providers, not the whole network transaction population.
- Advantages: small payloads and potentially simple automation.
- Disadvantages: none measures the required network-wide median of actual total transaction fees. `getRecentPrioritizationFees` excludes the base fee and reports a prioritization market quote, while sender medians cover overlapping provider traffic. These values must not be used as substitutes.

## Option D — Exact full-window calculation from RPC

- Source/endpoints: the same finalized `getBlocks` and `getBlock` data as Option A, but for every produced block in the selected UTC day or hour.
- Authentication: keyless in theory.
- Methodology: fetch every block, extract every `meta.fee`, and compute the population median.
- History: would require repeated indexing or an archive-capable provider.
- Advantages: exact population statistic for the chosen window.
- Disadvantages: an average 400 ms slot implies roughly 216,000 slots per day. At the public endpoint's method limit of 40 requests per 10 seconds, block requests alone have a theoretical lower bound near 15 hours per day before latency, failures, payload transfer, and retries. Payload volume is very large. This is not viable for the minimal scheduled pipeline.

## Recommended candidate

Option A: a 16-block deterministic stratified sample across the trailing approximately one hour, fetched in batches of eight and calculated over every valid `meta.fee` observation.

The sample is explicitly labelled as sampled in methodology and machine-readable provenance. If any selected block remains missing after bounded retries, do not publish a newly calculated median from a smaller accidental sample; preserve the last-known-good value as stale. Blockworks remains an external human/reference benchmark, not a runtime dependency.

## Dependencies

- Shared finalized-slot/RPC client and retry logic from Research 1 and Research 13.
- Bounded own-history storage selected in Research 10.
- Atomic snapshot publication so a partial block sample cannot overwrite the last-known-good value.
- Dashboard/report formatting for lamports and SOL without losing integer precision.

## Produced data

`scalar`, `time series`, `status`

## Update characteristics

- Reasonable refresh: on each scheduled update, no more often than hourly on the public endpoint.
- Calculation window: trailing approximately one hour (9,000 slots), anchored to one finalized end slot.
- Sample size: 16 produced blocks, commonly about 25,000–35,000 transaction observations based on live tests.
- Expected collection time: roughly 20–35 seconds under normal public-RPC conditions, plus bounded retries.
- Own history is required. At one observation per hour, a year of compact normalized points is well below one megabyte; a slower shared update cadence is smaller still.
- Store the metric observation time separately from the overall snapshot `updatedAt`.

## Risks / Open Questions

- Sampling error: the result is not an exact daily population median. Deterministic stratification and a large transaction count reduce variance, but the limitation must be visible in methodology.
- The literal all-transaction population is dominated by many base-fee/vote transactions. This is why the observed median is near 5,000 lamports. Do not silently switch to non-vote transactions to make the value appear larger.
- A live comparison showed a non-vote-only median of `6,000` lamports versus `5,021` lamports for all transactions in the same 12-block sample, demonstrating that population definition is material.
- One 24-request batch returned only 19 usable blocks despite HTTP success; two batches of eight returned 16/16. Validate every JSON-RPC item and chunk requests.
- Slot duration is variable, so 9,000 slots is only an approximate hour. The stored slot endpoints are canonical; optional block times can document wall-clock coverage if their extra RPC cost is accepted later.
- A transaction may have `meta: null` in exceptional historical responses. Exclude only after explicit validation and require a minimum observation count; do not coerce missing fees to zero.
- Public RPC has no SLA and discourages high-volume production use. The bounded sample fits its intended scale much better than exhaustive indexing, but rate-limit errors still require retries and stale preservation.
- Future transaction versions must be handled deliberately; an unsupported-version block is a failed sample, not permission to omit the block.

## Sources

- Solana fee structure: https://solana.com/docs/core/fees/fee-structure
- Solana transaction status metadata (`meta.fee`): https://solana.com/docs/rpc/json-structures#transaction-status-metadata
- Solana `getBlock`: https://solana.com/docs/rpc/http/getblock
- Solana `getBlocks`: https://solana.com/docs/rpc/http/getblocks
- Solana `getRecentPrioritizationFees`: https://solana.com/docs/rpc/http/getrecentprioritizationfees
- Solana public RPC limits: https://solana.com/docs/references/clusters
- Blockworks metric catalog and definition: https://docs.blockworksresearch.com/api-reference/metrics/catalog
- Blockworks native median-fee endpoint: https://docs.blockworksresearch.com/api-reference/metrics/solana/transaction-fee-med-native
- Blockworks USD median-fee endpoint: https://docs.blockworksresearch.com/api-reference/metrics/solana/transaction-fee-med-usd
- Blockworks Index page (human cross-check): https://blockworks.com/index
- Coin Metrics API overview: https://docs.coinmetrics.io/api
- Coin Metrics Community API terms/limits: https://gitbook-docs.coinmetrics.io/packages/coin-metrics-community-data
