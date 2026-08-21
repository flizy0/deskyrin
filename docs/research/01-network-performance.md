# Research 1 — Network Performance

Status: complete (local candidates only; no global architecture decision)  
Researched: 2026-08-20  
Cluster: Solana mainnet-beta

## Shared RPC facts

The official no-key endpoint is suitable for a small scheduled collector, but Solana explicitly describes public RPC as rate-limited and not intended as production-grade infrastructure. Documented mainnet limits at research time are 100 requests per 10 seconds per IP, 40 requests per 10 seconds for one RPC method, 40 concurrent connections, 40 new connections per 10 seconds, and 100 MB per 30 seconds. Limits may change. HTTP 429 responses should honor `Retry-After`; HTTP 403 can mean the client has been blocked.

A live batch request to `https://api.mainnet-beta.solana.com` on 2026-08-20 successfully returned `getRecentPerformanceSamples`, `getEpochInfo`, `getBlockHeight`, and `getHealth`. The observed response shapes matched the official documentation.

Use `finalized` commitment for point-in-time epoch/block values. `getRecentPerformanceSamples` has no commitment parameter and must be treated as a node-produced recent sample series.

---

## Requirement

TPS.

## Meaning

Observed transactions per second over a documented recent window. Solana performance samples expose both total transactions and non-vote transactions. The unqualified bounty metric should be reported as total TPS; a non-vote component may be retained alongside it to make vote traffic explicit rather than silently changing the definition.

## Option A — Solana `getRecentPerformanceSamples`

- Source: official Solana JSON-RPC.
- Endpoint: configured mainnet RPC URL; method `getRecentPerformanceSamples` with a limit of recent 60-second samples.
- Authentication: none on the official public endpoint.
- Methodology: for a window of samples, `total TPS = sum(numTransactions) / sum(samplePeriodSecs)`. If every sample supplies `numNonVoteTransactions`, `non-vote TPS = sum(numNonVoteTransactions) / sum(samplePeriodSecs)`.
- Window: five most recent valid 60-second samples is a reasonable local candidate for a stable “current” five-minute measure. The final window is deferred to synthesis.
- History: at most 720 reverse-ordered samples, approximately 12 hours at 60 seconds each. Samples contain ending slot but no wall-clock timestamp.
- Advantages: first-party, no key, low request count, exact RPC counters, both total and non-vote traffic.
- Disadvantages: short history; no commitment/context slot; public RPC has no SLA; the sample series has no direct timestamp.

## Option B — Aggregate transactions from `getBlock`

- Source: official Solana JSON-RPC.
- Endpoint: `getBlocks` plus `getBlock` for every produced block in a time window.
- Authentication: none on the public endpoint.
- Methodology: count block transactions and divide by elapsed block time.
- History: bounded by the RPC node's retained ledger and the cost of fetching blocks.
- Advantages: permits custom filtering and independent verification.
- Disadvantages: hundreds of calls and large responses even for a short window; susceptible to public RPC limits; block-time estimates and skipped slots complicate the denominator. This is disproportionate for TPS.

## Option C — Third-party indexed metric

- Source: an analytics provider such as Dune, Blockworks, or another Solana data indexer.
- Authentication: commonly requires a key for stable machine-readable access.
- Advantages: long history may already exist.
- Disadvantages: adds provider methodology, key, availability, and dependency risk even though RPC directly satisfies the requirement.

## Recommended candidate

Option A. Compute a duration-weighted recent total TPS and retain the corresponding non-vote value as explanatory provenance. Persist one normalized observation per successful scheduled run for dashboard history.

## Dependencies

- Configurable mainnet RPC URL.
- Shared HTTP/RPC retry, validation, and timestamp handling.
- Own bounded history for periods beyond the RPC cache.
- Research 9 for TPS anomaly comparison windows and thresholds.

## Produced data

`scalar`, `time series`

## Update characteristics

- Reasonable collection frequency: 15–60 minutes; local candidate is 15 minutes, subject to global automation constraints.
- Current calculation window candidate: five minutes.
- Own history required for multi-day trend/anomaly analysis.
- Raw response is small: 5 samples are typically well below 2 KB.

## Risks / Open Questions

- The newest sample should be rejected if its duration is zero or visibly incomplete; valid samples must have positive period and slot counts.
- Old RPC versions may return `numNonVoteTransactions: null`; total TPS remains available.
- Total TPS can be dominated by vote transactions. Labels and methodology must not imply that total TPS equals user TPS.
- Samples lack source timestamps. Persist the collector observation time; do not fabricate precise historical timestamps for the 720 cached samples without a documented block-time anchor.

---

## Requirement

Slot time.

## Meaning

Observed average time per Solana slot over a recent window, in milliseconds. This must be labelled as an average slot interval, not transaction finality or block latency.

## Option A — Derive from `getRecentPerformanceSamples`

- Source: official Solana JSON-RPC.
- Endpoint: the same `getRecentPerformanceSamples` response used for TPS.
- Authentication: none.
- Methodology: `average slot time seconds = sum(samplePeriodSecs) / sum(numSlots)`; multiply by 1,000 for milliseconds.
- Window/history: identical to TPS.
- Advantages: no extra request; aggregation covers many slots and smooths second-resolution timing noise.
- Disadvantages: measures slots that occurred over the sampling interval; it is not the production time of a particular block and carries no direct wall-clock timestamp.

## Option B — Difference between `getBlockTime` observations

- Source: official Solana JSON-RPC.
- Endpoint: `getBlockTime` for two sufficiently separated produced slots, with produced-slot discovery via `getBlocks` if needed.
- Authentication: none.
- Methodology: `(laterBlockTime - earlierBlockTime) / (laterSlot - earlierSlot)`.
- History: depends on retained ledger.
- Advantages: independently ties slot numbers to ledger-estimated UTC times.
- Disadvantages: `getBlockTime` is an estimated, stake-weighted timestamp with one-second resolution and may be unavailable; skipped slots and short spans produce noisy results; requires extra calls.

## Option C — Measure `slotSubscribe` arrival intervals

- Source: official Solana WebSocket RPC.
- Authentication: none on public endpoints.
- Methodology: keep a persistent client and measure notification arrival intervals.
- Advantages: live measurement.
- Disadvantages: measures RPC/network delivery as well as cluster behavior, requires a continuously running collector, and conflicts with static-first scheduled operation.

## Recommended candidate

Option A, using exactly the same validated samples and window as TPS. This is the least ambiguous low-cost scheduled measure. Option B can be a diagnostic check during testing but should not be a production dependency.

## Dependencies

- Same collector/history as TPS.
- Research 9 for the slow-slot threshold.

## Produced data

`scalar`, `time series`

## Update characteristics

- Same frequency and expected size as TPS.
- Store milliseconds as a finite non-negative number and retain the sample duration/slot count as methodology metadata.

## Risks / Open Questions

- A sample with `numSlots == 0` cannot produce a valid slot time and must be rejected.
- The chosen label must distinguish slot interval from block production time and confirmation/finality.

---

## Requirement

Block height.

## Meaning

The block height seen by the RPC node at a documented commitment. It is not the absolute slot: skipped slots cause block height and slot to diverge.

## Option A — `getBlockHeight`

- Source: official Solana JSON-RPC.
- Endpoint: `getBlockHeight` with `commitment: finalized`.
- Authentication: none.
- Methodology: use the returned unsigned integer directly.
- History: current value only.
- Advantages: dedicated method with clear semantics.
- Disadvantages: one more subrequest if `getEpochInfo` is already needed.

## Option B — `getEpochInfo.blockHeight`

- Source: official Solana JSON-RPC.
- Endpoint: `getEpochInfo` with `commitment: finalized`.
- Authentication: none.
- Methodology: use the response's `blockHeight` field directly.
- History: current value only.
- Advantages: the same response also provides every input for epoch progress, reducing calls and consistency drift.
- Disadvantages: slightly less single-purpose than `getBlockHeight`.

## Recommended candidate

Option B. A single finalized `getEpochInfo` observation supplies block height and epoch position coherently. The dedicated method is useful in tests as a response-shape/consistency check, not as a required production call.

## Dependencies

- Configured RPC and common response validation.

## Produced data

`scalar`

## Update characteristics

- Refresh with each pipeline run.
- No long-term history is required to satisfy the metric; retaining it would add little dashboard value beyond TPS/slot history.
- Response field is a small integer value.

## Risks / Open Questions

- Different commitments or RPC nodes can legitimately report different heights. Use one RPC batch and one commitment.
- Never substitute `absoluteSlot` for block height.

---

## Requirement

Epoch progress.

## Meaning

Current epoch number and the fraction of scheduled slots already traversed in that epoch.

## Option A — `getEpochInfo`

- Source: official Solana JSON-RPC.
- Endpoint: `getEpochInfo` with `commitment: finalized`.
- Authentication: none.
- Methodology: `progressPercent = 100 * slotIndex / slotsInEpoch`; `remainingSlots = slotsInEpoch - slotIndex`. Preserve the raw epoch, slot index, and slots-in-epoch fields so the percentage is auditable.
- History: current value only; the RPC response does not provide prior epoch progress.
- Advantages: first-party and direct; one small call also supplies block height and absolute slot.
- Disadvantages: an estimated completion time would require a separate slot-time assumption and is not required.

## Option B — `getSlot` plus `getEpochSchedule`

- Source: official Solana JSON-RPC.
- Endpoint: `getSlot` and `getEpochSchedule`.
- Authentication: none.
- Methodology: reproduce epoch calculation from the schedule and current slot.
- History: current only.
- Advantages: independent derivation.
- Disadvantages: two methods, more implementation surface, and no benefit over the direct epoch response.

## Recommended candidate

Option A. Show epoch number, progress percentage, and the raw `slotIndex / slotsInEpoch` values. Do not add an “estimated epoch end” unless later evidence makes it necessary.

## Dependencies

- Same finalized epoch observation used for block height.

## Produced data

`scalar`, `status`

## Update characteristics

- Refresh each pipeline run.
- No own historical series is required.
- Negligible data size.

## Risks / Open Questions

- Validate `0 <= slotIndex < slotsInEpoch` and `slotsInEpoch > 0`.
- The percentage is a slot-schedule fraction, not a transaction/work completion fraction.

## Cross-requirement local candidate

One JSON-RPC batch can request a small recent performance-sample window, finalized epoch info, and optionally node health. TPS and slot time are derived from the same duration-weighted window; block height and epoch progress are derived from the same finalized epoch response. This avoids an external network-metrics provider and keeps provenance internally consistent.

## Sources

- Solana RPC — `getRecentPerformanceSamples`: https://solana.com/docs/rpc/http/getrecentperformancesamples
- Solana RPC — `getBlockHeight`: https://solana.com/docs/rpc/http/getblockheight
- Solana RPC — `getEpochInfo`: https://solana.com/docs/rpc/http/getepochinfo
- Solana RPC — `getBlockTime`: https://solana.com/docs/rpc/http/getblocktime
- Solana clusters and public RPC limits: https://solana.com/docs/references/clusters
- Agave RPC implementation linked by the official RPC documentation: https://github.com/anza-xyz/agave/blob/v3.1.8/rpc/src/rpc.rs
