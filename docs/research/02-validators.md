# Research 2 — Validators

Status: complete (local candidates only; no global architecture decision)  
Researched: 2026-08-20  
Cluster: Solana mainnet-beta

## Shared semantics and live validation

The official `getVoteAccounts` method returns vote accounts split by the RPC node into `current` and `delinquent` arrays. Each record contains the vote account, validator node identity, current activated stake, current epoch membership, commission, recent vote-credit tuples, last vote, and root slot.

Agave v3.1.8 classifies an account as current when its last vote is within the configured delinquent slot distance. The default is 128 slots. By default, delinquent accounts with zero activated stake are removed; `keepUnstakedDelinquents: true` retains them.

A live finalized mainnet query on 2026-08-20 showed why this filter matters. With the default filter there were 686 current records and 9 staked delinquent records; one current record had zero stake. With unstaked delinquents retained, the delinquent array grew to 6,158 records, of which 6,149 had zero activated stake. These counts are an endpoint validation observation, not a value to hard-code.

For bounty-facing counts, the coherent local candidate is the economically participating set: current and delinquent vote-account records with `activatedStake > 0`. This uses the RPC's status classification but applies the same positive-stake inclusion rule to both sides.

`activatedStake` is an unsigned 64-bit count of lamports. One SOL is 1,000,000,000 lamports. Individual values can exceed JavaScript's exact integer range, so collectors must parse them with an arbitrary-precision integer and JSON should encode exact lamports as decimal strings; normalized SOL and percentage values can be safe JSON numbers.

---

## Requirement

Active validator count, delinquent validator count, and per-validator active/delinquent status.

## Meaning

A validator is represented operationally by a staked vote account. Its status is the `current` or `delinquent` partition returned by `getVoteAccounts`, using the documented/default 128-slot distance. Counts include only records with positive activated stake so the active and delinquent populations use the same inclusion rule.

This is a vote-account count, not necessarily a count of distinct legal operators. `nodePubkey` is retained so identity-level duplication remains visible.

## Option A — Solana `getVoteAccounts`

- Source: official Solana JSON-RPC implemented by Agave.
- Endpoint: configured mainnet RPC; `getVoteAccounts` with `commitment: finalized`, `keepUnstakedDelinquents: false`, and the standard delinquency distance.
- Authentication: none on the official public endpoint.
- Methodology: normalize each positive-stake record and assign status based on its source array. `activeCount = count(current where activatedStake > 0)`; `delinquentCount = count(delinquent where activatedStake > 0)`.
- History: current snapshot only.
- Advantages: first-party status, stake, identity, and commission in one call; no key or indexer.
- Disadvantages: large response; no context slot in the response; public RPC has no SLA; “validator” is operationally a vote account.

## Option B — Solana CLI `solana validators --output json`

- Source: official Solana CLI wrapping RPC data.
- Authentication: none for a public RPC.
- Methodology/history: essentially the same underlying vote-account data.
- Advantages: familiar operator display.
- Disadvantages: requires installing and pinning the Solana CLI, adds subprocess and parsing complexity, and offers no data advantage over direct JSON-RPC.

## Option C — Third-party validator directory/API

- Source: services such as Validators.app, Solana Beach, StakeWiz, or commercial RPC/indexing providers.
- Authentication: varies; stable machine-readable access may require keys.
- Advantages: human-readable names, geography, version, and longer history may be available.
- Disadvantages: extra provider semantics, incomplete/undocumented APIs, key or availability risk, and data not required by the frozen scope.

## Recommended candidate

Option A. Explicitly document the positive-activated-stake filter and the delinquency slot distance. Include both vote and node public keys and expose `status: active | delinquent` in the normalized validator table.

## Dependencies

- Shared Solana RPC client, validation, retry, and stale-data behavior.
- Collection timestamp and a nearby finalized epoch/slot observation for provenance.
- Research 9 for the aggregate high-delinquency alert threshold.

## Produced data

`scalar`, `table`, `status`, `time series` (aggregate history only)

## Update characteristics

- Reasonable refresh: 15–60 minutes; 15 minutes is the local candidate before automation synthesis.
- Persist small aggregate snapshots (counts and stake totals/shares), not complete validator arrays every run.
- Current normalized table is expected to contain roughly 700 staked vote accounts and remain comfortably below 1 MB.

## Risks / Open Questions

- A node identity may be associated with more than one vote account. Grouping by node identity could merge different commissions or statuses, so the primary row key should be `votePubkey`.
- RPC partitions have no returned context slot; they cannot be made perfectly atomic with a separate slot request.
- A validator hovering around the 128-slot boundary can change status between runs. Alerting should use aggregate stake and a persistence/window rule rather than one validator transition.
- A future Agave release could change the default. The final methodology must either pin 128 explicitly or record the runtime threshold as configuration.

---

## Requirement

Stake distribution.

## Meaning

How activated voting stake is allocated across the currently staked validator vote accounts, while retaining delinquent stake in the denominator because it still matters to cluster safety.

## Option A — Derive from `getVoteAccounts.activatedStake`

- Source: the same official RPC response.
- Authentication: none.
- Methodology:
  - `totalActivatedStake = sum(activatedStake)` across positive-stake current and delinquent records.
  - `validatorStakeShare = activatedStake / totalActivatedStake`.
  - Sort records by exact lamports.
  - A compact distribution visualization can show the top validators individually and group the remaining share as “Other”; the full table preserves every record.
- History: current distribution only; aggregate concentration/display values may be retained per run if the final UI requires a trend.
- Advantages: exact first-party stake values, no additional provider or call.
- Disadvantages: no operator grouping or human-readable identity names; delegated stake can change at epoch boundaries and during activation/deactivation.

## Option B — Enumerate stake-program accounts

- Source: Solana RPC `getProgramAccounts` for the stake program, followed by stake-state parsing and vote-account aggregation.
- Authentication: none in principle.
- Methodology: decode every stake account, determine activation state, and group delegation by vote account.
- History: current only unless stored.
- Advantages: independently reconstructs delegation and can expose activation details.
- Disadvantages: extremely large and expensive public-RPC query, more protocol parsing, and duplicates a value already supplied by `getVoteAccounts`.

## Option C — Third-party stake analytics

- Source/authentication: provider dependent.
- Advantages: operator labels and precomputed concentration measures.
- Disadvantages: additional dependency and methodology; unnecessary for the explicitly requested distribution.

## Recommended candidate

Option A. Use exact lamport sums in the collector, publish safe normalized values, render a top-N-plus-other distribution, and retain the complete sortable validator table.

## Dependencies

- Exact integer handling.
- Dashboard table and compact distribution visualization research.

## Produced data

`distribution`, `table`

## Update characteristics

- Refresh with the validator snapshot.
- No raw per-run historical snapshot is needed.
- Current normalized distribution is on the order of hundreds of rows.

## Risks / Open Questions

- Do not use only active stake as the denominator while separately claiming delinquent stake share; use one explicit denominator across positive-stake current and delinquent records.
- Rounding shares independently can make displayed percentages sum to slightly more or less than 100%; calculations retain full precision and display rounding is cosmetic.
- “Other” must be calculated from exact total minus the displayed top-N sum, not from rounded percentages.

---

## Requirement

Top validators by stake.

## Meaning

The highest-staked vote accounts in the same population and denominator used for stake distribution.

## Option A — Sort normalized `getVoteAccounts` records

- Source/authentication: same official no-key RPC response.
- Methodology: descending exact `activatedStake`, deterministic tie-break by `votePubkey`; retain rank, status, vote identity, node identity, stake in exact lamports and SOL, stake share, and commission.
- History: current ranking.
- Advantages: no extra source or call; directly consistent with distribution totals.
- Disadvantages: only public keys, not operator names.

## Option B — Third-party labelled leaderboard

- Source: validator directories/explorers.
- Advantages: easier human recognition.
- Disadvantages: name ownership and freshness are additional trust problems; no-key machine-readable availability is not assured.

## Recommended candidate

Option A. Show a concise top table (local candidate: top 20) and allow the complete validator table to be sorted and filtered in the browser. Human-readable names are not a frozen requirement and should not add a provider.

## Dependencies

- Stake distribution normalization.
- Readable dashboard table.

## Produced data

`table`

## Update characteristics

- Refresh each validator run.
- Top-20 output is only a few kilobytes; complete table remains the canonical table.

## Risks / Open Questions

- A rank is a snapshot, not historical performance or endorsement.
- The UI and report must never imply that high stake or low commission means the project recommends a validator.

---

## Requirement

Validator commission and commission tracking.

## Meaning

The vote account's configured commission on staking rewards, expressed as an integer percentage. It is not Jito MEV commission, transaction-fee share, or total validator take rate. “Tracking” requires detecting changes over time, not only rendering the latest field.

## Option A — Current RPC field plus a local change log

- Source: `getVoteAccounts[].commission`.
- Authentication: none.
- Methodology: show current commission for every normalized validator. Compare the current map keyed by `votePubkey` with the previous successful map and append an event only when a value changes: observation time, vote pubkey, previous percentage, and new percentage.
- History: locally retained change events; no full-table snapshot per run.
- Advantages: exact current protocol value; compact event-sourced history; no provider.
- Disadvantages: history starts when this project first runs and cannot reconstruct older changes.

## Option B — Store every validator snapshot

- Source: same RPC.
- Methodology: persist every validator's commission on every scheduled run.
- Advantages: simple append semantics and complete observation trail.
- Disadvantages: roughly 700 mostly unchanged values per run; unnecessary repository growth and noisy diffs.

## Option C — Indexed validator-history provider

- Source/authentication: provider dependent.
- Advantages: possible pre-deployment history.
- Disadvantages: key/methodology/dependency risk and likely unnecessary for current bounty interpretation.

## Recommended candidate

Option A. Current commission is always in the table; a bounded append-only change log satisfies tracking with minimal storage. On the first run, write a baseline map but do not manufacture “change” events.

## Dependencies

- Persistent lightweight state/history selected in Research 10.
- Exact vote-account keying and atomic update behavior from Research 13.

## Produced data

`table`, `time series` (sparse change events)

## Update characteristics

- Compare on each successful validator collection.
- Commission events should be rare, so expected long-term size is small.
- Retention can be bounded by time or event count after storage synthesis.

## Risks / Open Questions

- A new or returning vote account needs a baseline, not a false change from `null`.
- If validator data is stale or partial, do not infer mass removals or changes.
- Validate commission as an integer in the protocol-supported display range; quarantine an invalid response rather than clamp it.

---

## Requirement

High validator delinquency warning.

## Meaning

A cluster-level warning derived from delinquent activated stake, not merely the noisier count of small validators.

## Option A — Stake-weighted RPC aggregate

- Source: same `getVoteAccounts` snapshot.
- Methodology: `delinquentStakeShare = delinquentActivatedStake / totalActivatedStake`; compare with a documented threshold and optional persistence rule.
- History: own aggregate time series is required for context/persistence.
- Advantages: directly related to consensus stake and resilient to many tiny inactive accounts.
- Disadvantages: threshold is not specified by the bounty.

## Option B — Count-weighted aggregate

- Methodology: `delinquentCount / (activeCount + delinquentCount)`.
- Advantages: easy to explain.
- Disadvantages: one large validator and many tiny validators have radically different security impact; easy to produce noisy alerts.

## Recommended candidate

Option A as the alert trigger, while exposing both count and stake share in the alert evidence. Threshold and persistence are deliberately deferred to Research 9.

## Dependencies

- Research 9 alert methodology.
- Aggregate validator history.

## Produced data

`status`, `time series`

## Update characteristics

- Evaluate on each valid validator snapshot.
- Aggregate observation is only tens of bytes before metadata.

## Risks / Open Questions

- A single transient RPC partition should not produce a high-delinquency alert from a malformed or partial response.
- Consensus safety thresholds and an early operational warning are different concepts; the eventual warning threshold must not be described as a protocol halt threshold.

## Cross-requirement local candidate

One finalized, default-filtered `getVoteAccounts` response closes all validator requirements. Normalize only positive-stake vote accounts, preserve the RPC partition as status, derive one consistent activated-stake denominator, expose a complete current table plus top ranking, retain aggregate delinquency snapshots, and persist commission changes rather than repeated full snapshots.

## Sources

- Solana RPC — `getVoteAccounts`: https://solana.com/docs/rpc/http/getvoteaccounts
- Agave RPC implementation and filtering behavior: https://github.com/anza-xyz/agave/blob/v3.1.8/rpc/src/rpc.rs
- Agave RPC request constants (`DELINQUENT_VALIDATOR_SLOT_DISTANCE = 128`): https://github.com/anza-xyz/agave/blob/v3.1.8/rpc-client-types/src/request.rs
- Agave response types and field semantics: https://github.com/anza-xyz/agave/blob/v3.1.8/rpc-client-types/src/response.rs
- Solana staking and commission overview: https://solana.com/docs/references/staking
- Solana public RPC limits: https://solana.com/docs/references/clusters
