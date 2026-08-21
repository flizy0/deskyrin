# Research 9 — Alerts / Notable Changes

Status: complete (local candidates only; no global architecture decision)  
Researched: 2026-08-20

The listing names five notable-change classes: significant TPS drops or spikes, slow slot times, high validator delinquency, large TVL changes, and large SOL price moves. It does not prescribe thresholds or comparison windows. The values below are therefore project methodology, not Solana protocol rules. Alerts remain inside `data.json`, `report.md`, and the dashboard; there is no delivery service.

## Shared alert semantics

An alert is emitted only from a valid current observation and a valid, temporally comparable reference. Every alert must contain a stable kind/id, source metric, observed/reference values, unit, comparison window, threshold, observed time, and a short deterministic template message. There is no generated interpretation.

Rules common to all alert classes:

- Use percentage change `100 * (current / reference - 1)` only when the reference is finite and strictly positive.
- Compare like-for-like source semantics and windows. Never compare an intraday point with a completed daily point.
- An unavailable evaluation is not “normal.” Keep its evaluation status unavailable/stale; do not emit a false alert and do not erase last-known-good metric values.
- Threshold equality triggers (`>=` for magnitude, `<=` where directional).
- Include only currently active conditions in the main alerts list. Historical metric charts provide context; an alert log/product notification system is out of scope.
- At most one alert per kind per snapshot. Stable IDs prevent duplicate UI rows.

## Requirement — Significant TPS drop or spike

### Meaning

Detect a sustained short-window departure in total network TPS from its immediately preceding baseline, using the same official performance samples and total-transaction definition selected in Research 1.

### Option A — Robust recent-sample comparison

- Source: official Solana `getRecentPerformanceSamples`.
- Authentication: none on the public mainnet RPC.
- Methodology:
  1. Convert each complete positive-duration sample to total TPS.
  2. Form two non-overlapping recent five-minute bins from the newest ten approximately 60-second samples, using duration-weighted TPS.
  3. Form the baseline as the median of the next 60 complete per-sample TPS observations (approximately the preceding hour), excluding both current bins.
  4. A **drop** candidate is each recent bin at least 30% below baseline and at least 500 TPS lower.
  5. A **spike** candidate is each recent bin at least 30% above baseline and at least 500 TPS higher.
  6. Emit only when both adjacent recent bins satisfy the same direction. The evidence value is the newest five-minute bin; store both recent bins and baseline in provenance.
- History: RPC returns enough short history for immediate evaluation; own scheduled history remains useful for charts but is not needed to bootstrap this rule.
- Advantages: keyless, on-chain-derived, resistant to one bad minute, adaptive to gradual network-load changes, no day of warm-up.
- Disadvantages: a one-hour local baseline can itself be abnormal; total TPS includes votes; 30%/500 TPS are project-chosen thresholds.

### Option B — Scheduled-history baseline

- Source: persisted TPS observations from successful updates.
- Methodology: compare the current five-minute TPS with a trailing 24-hour median and require two consecutive scheduled breaches.
- History: requires at least 12 valid points and ideally a complete day.
- Advantages: broader baseline and easy dashboard consistency.
- Disadvantages: slow bootstrap; sensitivity depends on scheduler cadence; redeploy/history failures can suppress evaluation. It adds coupling to storage when RPC already provides a sufficient recent baseline.

### Option C — Fixed TPS threshold

- Methodology: alert below or above a hard-coded total TPS value.
- Advantages: simple.
- Disadvantages: network load and vote traffic change materially; a fixed number becomes stale and confuses low demand with degraded performance. Rejected.

### Recommended candidate

Option A with a 30% relative floor, 500 TPS absolute floor, and two adjacent five-minute bins. The dual threshold avoids calling a small low-load numerical change “significant”; adjacent-bin confirmation rejects one-sample noise.

### Dependencies

- The validated performance-sample collector from Research 1.
- Deterministic median/duration-weighted aggregation utilities.
- Data-quality status from Research 13.

### Produced data

`status`, `table`

### Update characteristics

- Evaluate on every scheduled network collection.
- Requires about 70 complete one-minute samples, well within the RPC's maximum 720.
- No additional source request or alert history is required.

### Risks / Open Questions

- Total TPS can move because vote transaction behavior changes rather than user demand.
- A sudden change lasting under ten minutes is intentionally suppressed.
- The fixed 500 TPS absolute floor may warrant review if the network's normal transaction mix changes substantially; changing it is a methodology version change.
- Missing or malformed samples make evaluation unavailable; the algorithm must not shorten bins opportunistically.

### Sources

- Solana `getRecentPerformanceSamples`: https://solana.com/docs/rpc/http/getrecentperformancesamples
- Solana public RPC limits: https://solana.com/docs/references/clusters

## Requirement — Slow slot times

### Meaning

Detect that recent average slot intervals are materially slower than the immediately preceding network baseline. This is not confirmation latency or block finality.

### Option A — Adaptive performance-sample comparison

- Source: the same official `getRecentPerformanceSamples` response as TPS.
- Authentication: none.
- Methodology:
  1. Calculate average slot interval for each bin as `sum(samplePeriodSecs) / sum(numSlots) * 1,000` ms.
  2. Use the same two newest non-overlapping five-minute bins and the next approximately 60 minutes as the baseline.
  3. Calculate the baseline from all baseline seconds and slots (duration/slot weighted), not a mean of already rounded milliseconds.
  4. A bin is slow when it is both at least 50% above baseline and at least 75 ms above baseline.
  5. Emit after both adjacent recent bins are slow.
- History: immediate RPC series is sufficient; own history supports the dashboard.
- Advantages: automatically follows planned slot-target reductions such as SIMD-0525; no brittle 400ms assumption; no additional request; suppresses second-resolution/sample rounding noise.
- Disadvantages: if the baseline hour is already degraded, the alert can be suppressed; thresholds are project methodology.

### Option B — Absolute target threshold

- Methodology: warn above a fixed value such as 600 ms.
- Advantages: easy to explain relative to the historic 400ms target.
- Disadvantages: SIMD-0525 plans staged 350/300/250/200ms targets, so one fixed threshold becomes progressively less meaningful and does not adapt to future activation. Rejected as the sole rule.

### Option C — Block-time deltas

- Source: `getBlockTime` across selected produced slots.
- Methodology: compare wall-clock block timestamp deltas.
- Advantages: independent cross-check.
- Disadvantages: estimated timestamps have one-second resolution and skipped slots complicate interpretation; extra RPC calls. Rejected for alerting.

### Recommended candidate

Option A: two adjacent five-minute bins, each at least 1.5× and 75ms above the preceding-hour baseline. Both conditions must hold.

### Dependencies

- The exact same performance-sample validation and bin boundaries used for TPS.
- Upgrade methodology from Research 8 so documentation does not hard-code the old target as perpetual.

### Produced data

`status`, `table`

### Update characteristics

- Evaluate with every scheduled network collection at no additional source cost.
- No alert history required.

### Risks / Open Questions

- Integer-second sample periods limit per-sample precision; multi-minute aggregation mitigates this.
- A provider/RPC node lag can resemble network slowness. Full response validation and two-bin confirmation reduce but do not eliminate that risk.
- Slow relative performance after a protocol target change is caught; a gradual multi-hour regression may become part of the baseline and evade this short-horizon rule.

### Sources

- Solana `getRecentPerformanceSamples`: https://solana.com/docs/rpc/http/getrecentperformancesamples
- Official Reduced Slot Times upgrade: https://solana.com/upgrades/reduced-slot-times
- SIMD-0525: https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0525-reduce-slot-times.md

## Requirement — High validator delinquency

### Meaning

Warn when the fraction of positive activated stake assigned to vote accounts in the RPC's delinquent partition is operationally high:

```text
delinquentStakeShare = delinquentActivatedStake
                     / (currentActivatedStake + delinquentActivatedStake)
```

This is stake-weighted. Validator count is included as evidence but does not trigger the alert.

### Option A — Five-percent operational warning

- Source: official Solana `getVoteAccounts` output selected in Research 2.
- Authentication: none.
- Methodology: emit when delinquent activated stake share is at least 5.0% in two consecutive valid scheduled observations. A prior observation must use the same positive-stake filter and denominator.
- Rationale: the Solana validator CLI historically used 5% as the default maximum delinquent-stake percentage for a safe validator restart window. It is an operational caution level far below the roughly one-third stake superminority that can impair consensus. It must not be described as a protocol safety threshold.
- History: requires the previous valid scheduled aggregate, not full validator-table history.
- Advantages: grounded in Solana validator operational practice; stake weighted; early enough to be useful; persistence suppresses a single partition/transient.
- Disadvantages: the CLI setting controls safe restart behavior, not a universally mandated network-health alert; scheduler cadence determines confirmation delay.

### Option B — Consensus-risk threshold

- Methodology: alert only near 33.34% delinquent voting power.
- Advantages: directly associated with a superminority's ability to disrupt consensus.
- Disadvantages: far too late for a “high delinquency” operational warning; would miss severe but sub-halting degradation. Rejected as the only threshold.

### Option C — Delinquent validator count share

- Methodology: `delinquentCount / (activeCount + delinquentCount)`.
- Advantages: intuitive count.
- Disadvantages: many tiny validators can outweigh one large validator by count while representing far less consensus power. Retain only as alert evidence.

### Recommended candidate

Option A: `delinquentStakeShare >= 5%` for two consecutive valid scheduled snapshots. The alert evidence includes stake share, delinquent stake lamports, total activated stake lamports, delinquent count, active count, and both observation times.

### Dependencies

- Positive-stake normalized vote accounts and consistent denominator from Research 2.
- One prior aggregate point in the bounded history selected in Research 10.
- Full-response sanity checks to prevent a partial RPC response from triggering an alert.

### Produced data

`status`, `time series`, `table`

### Update characteristics

- Evaluate on every validator collection.
- Confirmation requires two successful scheduled observations.
- Only a small aggregate history is required.

### Risks / Open Questions

- At hourly updates, two-point confirmation can delay warning by up to roughly an hour after the first observation. This is appropriate for a static report but not an incident-response system.
- RPC status is based on recent vote distance; validators near the boundary can move between partitions.
- The 5% rationale is operational, while the 33.34% figure describes consensus/censorship power. Documentation must keep them distinct.
- A network-wide incident can make an RPC endpoint stale. Freshness/context validation is essential.

### Sources

- Solana `getVoteAccounts`: https://solana.com/docs/rpc/http/getvoteaccounts
- Solana validator CLI source (stake-weighted restart check): https://github.com/solana-labs/solana/blob/master/validator/src/main.rs
- Solana validator CLI historical default of 5%: https://docs.rs/crate/solana-validator/1.9.8/source/src/main.rs
- Solana Foundation validator health report and 33.34% superminority context: https://solana.com/news/validator-health-report-march-2023

## Requirement — Large TVL changes

### Meaning

Detect a large day-over-day change between the two newest distinct, completed UTC-day Solana chain-TVL observations from the same DefiLlama series and methodology.

### Option A — Ten-percent completed-day change

- Source: DefiLlama `GET https://api.llama.fi/v2/historicalChainTvl/Solana`.
- Authentication: none.
- Methodology:
  1. Sort and deduplicate valid daily points.
  2. Exclude the current UTC day if present.
  3. Require the newest points to be adjacent calendar days and reasonably fresh.
  4. Compute `100 * (latest / previous - 1)`.
  5. Emit when absolute change is at least 10.0%.
- History: provider supplies the full daily series; no own history required.
- Advantages: transparent, symmetric inflow/outflow rule; avoids ambiguous intraday comparisons; large enough to suppress ordinary day noise.
- Disadvantages: 10% is project-selected; provider reclassification can resemble an economic move; daily latency.

### Option B — Rolling statistical outlier

- Methodology: flag a return exceeding a multiple of the trailing median absolute deviation or standard deviation.
- Advantages: adapts to market regimes.
- Disadvantages: harder to explain, unstable with quiet/zero-MAD periods, and can flag small moves or miss an objectively large move in volatile periods. Unnecessary for the bounty.

### Option C — Intraday current TVL versus prior daily close

- Source: `/v2/chains` current value plus historical series.
- Advantages: faster detection.
- Disadvantages: the current aggregate has no comparable completed-day timestamp/window, so the percentage is semantically ambiguous. Rejected.

### Recommended candidate

Option A: absolute completed-day change of at least 10%. Emit immediately from one validated pair; do not require another day, which would turn a daily change alert into a two-day lag. Include both dates/values and source methodology in evidence.

### Dependencies

- Historical TVL normalization from Research 3.
- Calendar adjacency/freshness checks and last-known-good behavior from Research 13.

### Produced data

`status`, `table`

### Update characteristics

- Evaluate when the source publishes a new completed day.
- No own alert history required.

### Risks / Open Questions

- A protocol reclassification, exploit, or provider correction may all produce the same numerical step. The deterministic alert reports the change but does not infer a cause.
- DefiLlama chain TVL excludes liquid staking and double-counted categories under its methodology; the alert inherits that scope.
- A missing calendar day makes evaluation unavailable rather than comparing a multi-day gap as “daily.”

### Sources

- DefiLlama free API documentation: https://defillama.com/docs/api
- DefiLlama chain TVL endpoint: https://api.llama.fi/v2/historicalChainTvl/Solana
- DefiLlama methodology: https://docs.llama.fi/list-your-project/what-to-list

## Requirement — Large SOL price moves

### Meaning

Detect an absolute SOL/USD price change of at least ten percent over a true trailing 24-hour comparison from one provider.

### Option A — DefiLlama timestamped current and historical prices

- Source: DefiLlama Coins API on `coins.llama.fi` for `coingecko:solana`.
- Authentication: none.
- Methodology:
  1. Capture the current provider price/timestamp and confidence.
  2. Query the closest supported observation at `currentTimestamp - 86,400` seconds from the same coin identifier/provider.
  3. Validate positive finite prices, timestamp tolerance, and acceptable confidence.
  4. Compute `100 * (current / reference - 1)` and emit when the absolute value is at least 10.0%.
- History: provider supplies price history; own history is useful for the chart but not alert evaluation.
- Advantages: keyless, exact stated window, same-provider comparison, symmetric rule, timely.
- Disadvantages: provider aggregation/source confidence can change; 10% is project-selected; the historical endpoint returns a nearest observation subject to timestamp tolerance.

### Option B — Completed daily closes

- Source: DefiLlama chart/history or CoinGecko public history.
- Methodology: compare adjacent completed UTC-day prices.
- Advantages: aligns with daily economic series and avoids intraday sampling.
- Disadvantages: can delay a large market move by almost a day and does not match ordinary “24h price move” semantics.

### Option C — Volatility-adjusted rule

- Methodology: rolling z-score or standard-deviation threshold.
- Advantages: adaptive.
- Disadvantages: less transparent, requires methodology choices and long clean history, and can suppress large moves in volatile regimes. Rejected.

### Recommended candidate

Option A: absolute 24-hour SOL/USD move of at least 10%. Include direction, both prices, both timestamps, actual elapsed seconds, confidence, and source ID. Do not label ordinary below-threshold movement as an alert; it remains visible in the SOL chart/card.

### Dependencies

- Price collector and timestamp/confidence validation from Research 3.
- Exact-window data-quality tolerance selected in Research 13.

### Produced data

`status`, `table`

### Update characteristics

- Evaluate every scheduled price update.
- No local alert history required.

### Risks / Open Questions

- A 10% threshold is a transparent project convention, not a market standard mandated by the listing.
- Source failure or a reference point too far from 24 hours makes evaluation unavailable.
- The rule identifies magnitude and direction only; it makes no causal claim or prediction.

### Sources

- DefiLlama Coins API: https://defillama.com/docs/api
- Current price endpoint: https://coins.llama.fi/prices/current/coingecko:solana
- Historical price endpoint: https://coins.llama.fi/prices/historical/0/coingecko:solana

## Consolidated local candidate

```text
TPS drop/spike:
  two adjacent 5m bins, each >=30% and >=500 TPS from prior ~60m median

Slow slots:
  two adjacent 5m bins, each >=50% and >=75ms above prior ~60m baseline

High validator delinquency:
  delinquent activated stake >=5%, two scheduled observations

Large TVL change:
  absolute completed UTC day-over-day change >=10%

Large SOL move:
  absolute same-provider trailing-24h SOL/USD change >=10%
```

These thresholds are deliberately centralized as versioned configuration/methodology constants. The global architecture may choose their storage location, but must not silently change their values.
