# Research 13 — Minimal Reliability and Error Handling

Status: complete (local candidate only; no global architecture decision)  
Researched: 2026-08-20

## Requirement

Implement only the reliability layer needed for unattended scheduled collection and static publication:

- detect HTTP, Solana RPC, schema, semantic, and freshness failures;
- use bounded timeouts/retries;
- isolate partial provider failures;
- preserve last-known-good values instead of writing `0`/`null` garbage;
- mark stale and unavailable data with timestamps;
- stop the pipeline on critical failure;
- publish `data.json` and `report.md` consistently and atomically from the user's perspective.

No monitoring service, telemetry backend, queue, dead-letter system, pager, or notification channel is required.

## Meaning

Reliability is a data contract, not merely `try/catch`. A response is successful only after transport, protocol, shape, units, temporal semantics, and cross-field invariants all pass.

Three result states are sufficient:

- `fresh`: a valid value was obtained in this run and its observation/source time meets the metric's freshness rule;
- `stale`: this run could not replace a prior valid value, so the last-known-good value is retained with its original `observedAt` and an explicit failed `attemptedAt`/reason;
- `unavailable`: no valid last-known-good value exists for the metric, or an alert cannot be evaluated from comparable fresh inputs.

Never overwrite a numeric metric with zero, `null`, an empty array, or an empty string merely because a source failed. `null` may exist only in a typed availability wrapper where the schema explicitly says no value has ever been obtained; it is not a numeric fallback.

## Option A — Typed collector results, per-domain last-known-good merge, and gated static publication

- Runtime: the single scheduled Node process selected in Research 12.
- Storage: previous validated canonical `data.json` from Research 10.
- Methodology:
  1. Validate the prior snapshot and schema/methodology versions before any merge.
  2. Give every collector a domain boundary and return either validated normalized data or a structured failure; collectors never write output files.
  3. Retry only safe transient failures within a small deadline.
  4. Replace a logically coherent domain only when all fields needed for that domain pass. Otherwise retain its prior last-known-good value/history and set `stale`.
  5. Recompute derived metrics and alerts only from compatible inputs. Alert evaluation becomes `unavailable` when inputs are stale/incomparable; an old alert is not copied forward as if current.
  6. Build a complete candidate snapshot in memory/staging, generate the Markdown report from that candidate, then run schema, invariant, size, and output-consistency tests.
  7. Only after all gates pass, replace working output files and commit them together. Vercel sees one Git commit/deployment.
- Advantages: precise failure isolation; no database/service; auditable stale behavior; one source of truth; testable with fixtures; critical failures cannot publish partial garbage.
- Disadvantages: requires explicit schemas and merge ownership for every domain; a valid mixed-freshness snapshot is more complex than all-or-nothing generation; alert evaluation status must be represented separately from active alerts.

## Option B — All-or-nothing update

- Methodology: any source failure stops the entire run and publishes nothing.
- Advantages: simplest consistency rule; every published snapshot is entirely fresh.
- Disadvantages: the project has several independent public providers with no SLA. One RSS/RWA/market outage would freeze unrelated on-chain network data and the report timestamp. It fails the requirement to mark unavailable/stale data and makes the dashboard less useful.

## Option C — Best-effort replacement with defaults

- Methodology: catch failures and use zero, `null`, empty arrays, or whatever subset returned.
- Advantages: pipeline rarely exits non-zero.
- Disadvantages: explicitly prohibited; creates fake crashes/spikes, broken denominators, false “no alerts,” and irreversible last-known-good loss. Rejected.

## Option D — External observability, queue, or redundant orchestration

- Candidates: Sentry, Datadog, uptime monitor, message queue, retry worker, second scheduler, webhook notifications.
- Advantages: richer incident response and durable retry coordination.
- Disadvantages: accounts, credentials, backend/runtime, cost and maintenance; the bounty asks only for necessary error handling and existing GitHub/Vercel logs. Rejected.

## Recommended candidate

Option A. Reliability is implemented inside the scheduled generator with strict normalized contracts, last-known-good merging, explicit freshness, and a final publication gate. No runtime backend is added.

## HTTP policy

### Request controls

- Use HTTPS only and a fixed descriptive `User-Agent`/`Accept` header.
- Default connect/response deadline: 15 seconds per ordinary HTTP request.
- Large known public page/data requests may use 30 seconds; Solana block batches may use 45 seconds.
- Cap total collector time so retries cannot exceed the 15-minute workflow timeout.
- Enforce source-specific response-size ceilings, considering the known RWA/Solana Data payloads; reject a response that is unexpectedly many times larger than the researched contract.
- Require an expected content type before parsing where the provider supplies one.
- XML/HTML is parsed as data and sanitized; source HTML is never executed or injected.

### Retry classification

Maximum three total attempts for an idempotent GET or read-only JSON-RPC request:

```text
attempt 1: immediate
attempt 2: after ~1 second
attempt 3: after ~3 seconds
```

Honor a valid `Retry-After` for HTTP 429/503, capped by the collector deadline. Retry network resets/timeouts and HTTP 408, 425, 429, 500, 502, 503, and 504. Do not retry authentication/permission errors, ordinary 4xx contract errors, invalid JSON/XML, schema violations, wrong units, or semantic/freshness failures; repetition cannot repair a changed contract.

Fallback providers are used only where research explicitly selected one (SOL price). A partial mint/protocol sum is never synthesized as a fallback for aggregate stablecoin, DEX, TVL, REV, or tokenized-asset metrics.

## Solana RPC policy

- Every request has a unique ID and requires `jsonrpc: "2.0"`.
- HTTP 200 is not success if a response contains `error`.
- Batch responses are mapped by ID because JSON-RPC permits arbitrary response order.
- Missing, duplicate, unknown, or `null` IDs/results are explicit failures unless that exact RPC method documents `null` as a valid domain result.
- Do not retry JSON-RPC parse/invalid-request/method-not-found/invalid-params errors (`-32700`, `-32600`, `-32601`, `-32602`). A transient internal/server/rate-limit error may be retried under the endpoint deadline.
- Respect the public RPC's `Retry-After` header and rate limits; block requests remain in the researched batches of at most eight.
- Use the selected commitment explicitly (`finalized`) and record observation/finalized slot context where the method supplies it.
- For the median-fee sample, every selected produced block must return and every usable transaction must have a valid non-negative integer `meta.fee`. An incomplete block set fails the whole fee domain; it cannot silently reduce sample size.
- For `getVoteAccounts`, current/delinquent arrays and every included positive-stake record must validate before replacing the validator domain. Counts, stake distribution, top list, commissions, and statuses are one coherent replacement unit.
- For performance samples, require the exact number of complete bins needed by current metrics/alerts, positive periods/slot counts, safe non-negative counts, and internally coherent total/non-vote counts.

## Provider contract validation

Common rules:

- no `Number(value)` coercion of empty strings, `null`, booleans, `NaN`, or infinity;
- currency/unit/chain/metric identifiers must match researched source semantics;
- timestamps/dates parse strictly, normalize to UTC, sort deterministically, and deduplicate by canonical key;
- values required to be non-negative or positive are checked before calculations;
- daily alert points must be completed UTC days and adjacent when the rule says day-over-day;
- historical arrays must not silently reverse or duplicate conflicting dates;
- comparison denominators must be strictly positive;
- integer fields above JavaScript safe range remain validated decimal strings/BigInt internally and decimal strings in JSON;
- exact source labels used by brittle public page contracts (RWA/upgrades/Solana Data) are asserted, not accessed only by array position.

Source-specific minimums:

- DefiLlama daily series: correct chain/category, at least the two newest comparable completed points, no current partial DEX day as headline.
- REV: fee component needs the configured minimum semantically valid provider consensus and Jito needs matching completed date; no unmatched partial REV.
- Daily active addresses: both selected aligned Allium and Dune observations must exist for a consensus date; Artemis is not silently substituted.
- RWA: expected Solana network aggregate, `Stocks` subset, USD/30-day semantics, and provider date must all exist.
- RSS: valid RSS/channel, unique item GUID/link, safe HTTPS canonical URLs, valid titles/dates; one malformed item may be discarded only if a documented minimum valid item count remains, otherwise retain the previous news domain.
- Upgrades: recognized release/stage values and safe canonical detail links; unknown stage is a contract failure, not an invitation to guess inclusion.

## Freshness policy

Freshness uses source observation time, not only the pipeline clock:

| Domain | Fresh current-run requirement |
| --- | --- |
| Network, validators, sampled fee | successful observation in this run |
| SOL current price | provider timestamp no more than 2 hours behind collection |
| TVL, stablecoins, DEX, active addresses | newest completed provider day no more than 3 UTC days behind |
| REV | newest common completed day no more than 3 UTC days behind |
| Tokenized assets | provider update date no more than 3 UTC days behind |
| News and upgrades | page/feed fetched and validated in this run; item publication date is content age, not fetch freshness |

If a successful response is semantically older than its allowed window, treat it as a failed fresh observation and retain prior last-known-good data as stale. A stale retained value keeps its original `observedAt` and exposes an `ageSeconds` derived at generation time. There is no hidden grace period that labels retained data fresh.

Provider cadences can legitimately change. A freshness-window change is a reviewed methodology update with fixtures, not an ad hoc runtime override.

## Last-known-good merge boundaries

Replacement happens at the smallest coherent domain that cannot contradict itself:

- network performance samples/TPS/slot-time alert evidence together;
- block-height/epoch-progress together from one epoch response;
- validator table/counts/stake distribution/top/commission/delinquency evidence together;
- current SOL price/movement and its compatible chart/provenance together, unless the explicit price fallback produces its own complete domain;
- TVL, stablecoin, DEX, median-fee, RWA, active-address, news, and upgrades each as separate domains;
- REV fee/Jito components and joined total together for each published point.

Histories append only for fresh successful observations. A failed run never appends the retained value at the new pipeline time, because that would fabricate a measurement.

## Alert failure behavior

- Active alerts are recomputed for the candidate snapshot; they are not copied from the old snapshot.
- A fresh rule whose condition is false yields no active alert and evaluation status `ok`.
- A stale, missing, nonadjacent, or otherwise incomparable input yields evaluation status `unavailable`, with the metric/reason visible in dashboard/report.
- A stale prior alert is therefore not falsely presented as active, but the UI cannot imply “all clear” while evaluation is unavailable.
- Deterministic alert messages are templates populated only from validated values.

## Critical versus partial failures

### Critical — stop before publication

- canonical previous snapshot exists but fails schema/checksum/invariant validation and no deliberate migration applies;
- candidate top-level schema/methodology version is unknown or invalid;
- no fresh value and no valid previous value exists for any frozen required metric on bootstrap;
- configuration or required source identifiers are invalid;
- calculations yield non-finite values, unsafe integer loss, impossible denominators, or cross-section contradictions;
- `data.json`/`report.md` disagree on required current values/timestamps/statuses;
- output exceeds the 2 MB JSON ceiling or includes raw/unapproved fields;
- tests or static production build fail;
- staging/final file replacement or Git commit preparation fails.

### Partial — publish retained stale domain if available

- one independent public provider times out/rate-limits/changes shape while its last-known-good domain validates;
- the median-fee block sample is incomplete but a previous fee value exists;
- one logically independent RPC call fails while other coherent RPC domains succeed;
- news/upgrades/RWA fails while network/economic domains succeed;
- an alert cannot be evaluated while its underlying retained metric remains displayable as stale.

The candidate snapshot may be published only if every frozen output has either a fresh valid domain or an explicit valid stale last-known-good domain. “Unavailable with no value” is allowed only during a deliberate first-deployment sample/bootstrap artifact if the Definition of Done does not yet claim production readiness; the production scheduled pipeline's first successful commit must close all required metrics.

## Atomic publishing

- Generate candidate JSON and Markdown in a temporary/staging directory on the same runner.
- Parse the generated JSON again, run cross-output verification and the frontend production build against it.
- Move/replace the two working-tree outputs only after verification. The CI runner is ephemeral, so a crash before commit cannot affect the repository.
- Stage exactly the generated files and inspect the staged diff; commit both in one normal Git commit.
- Never push a commit containing only one output.
- Vercel deployments are immutable; a failed build does not rewrite the previously deployed static files. Manual rollback remains possible through Vercel if a post-build defect is discovered.

## Dependencies

- Final domain schemas and source matrix from Phase 3.
- Serialized GitHub Actions workflow from Research 12.
- Bounded canonical snapshot from Research 10.
- Fixture-driven tests for success, timeout, HTTP error, malformed body, schema drift, stale dates, missing RPC batch IDs, incomplete block sample, and partial-source retention.

## Produced data

`status`, `structured errors`, `timestamps`, `validated snapshot`, `pipeline exit code`

## Update characteristics

- Up to three bounded attempts per transiently failing request; no unbounded loop.
- Per-source errors are concise stable codes in generated provenance; detailed stack traces remain only in GitHub logs.
- One run-level summary lists fresh/stale/unavailable domains and whether publication occurred.
- No separate monitoring data is retained.

## Risks / Open Questions

- Public endpoints have no SLA and several chosen first-party/public web routes are unversioned. Fixtures detect known schema drift but cannot prevent future changes; stale preservation is the safety mechanism.
- Strict freshness can freeze a source during a legitimate provider delay. This is preferable to silently labelling old observations current.
- Last-known-good data can become very old during a long outage. The timestamp/age remains visible; operators must repair the adapter, but the value is not erased.
- A mixed-freshness snapshot is truthful only if each metric status is visible in JSON, report, and dashboard; hiding per-metric status would invalidate this design.
- Git commit atomicity does not guarantee immediate Vercel promotion. The live site's deployed timestamp remains the honest observable boundary.
- Response-size ceilings must be based on measured fixtures with headroom; too low creates avoidable outages, too high weakens protection.

## Sources

- JSON-RPC 2.0 responses, errors, and unordered batches: https://www.jsonrpc.org/specification
- Solana public RPC endpoint limits and `Retry-After`: https://solana.com/docs/references/clusters
- Solana shared RPC JSON structures: https://solana.com/docs/rpc/json-structures
- Solana `getRecentPerformanceSamples`: https://solana.com/docs/rpc/http/getrecentperformancesamples
- Solana `getVoteAccounts`: https://solana.com/docs/rpc/http/getvoteaccounts
- Solana `getBlock`: https://solana.com/docs/rpc/http/getblock
- HTTP semantics (RFC 9110): https://www.rfc-editor.org/rfc/rfc9110
- Vercel Git deployment behavior: https://vercel.com/docs/git/vercel-for-github
- Vercel build failure troubleshooting: https://vercel.com/docs/deployments/troubleshoot-a-build
- Vercel rollback behavior: https://vercel.com/docs/deployments/rollback-production-deployment
