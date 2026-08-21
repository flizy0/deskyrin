# Research 10 — Data Storage and Outputs

Status: complete (local candidate only; no global architecture decision)  
Researched: 2026-08-20

## Requirement

Select the smallest durable storage model that can:

- preserve last-known-good required values across scheduled runs;
- retain only the history that providers do not already supply;
- publish one machine-readable `data.json` and one human-readable `report.md` atomically;
- feed a static Vercel dashboard without a persistent backend or database;
- remain keyless for all data providers and maintainable after deployment.

The storage decision must account for every researched metric rather than optimizing one collector in isolation.

## Meaning

There are three different kinds of state:

1. **Current snapshot state** — current network/validator values, source observations, news, upgrades, alerts, per-metric availability/freshness, and timestamps.
2. **Provider-supplied history** — bounded normalized windows re-fetched from DefiLlama, Solana Data, and Jito. The provider remains the historical source of truth.
3. **Project-originated history** — normalized observations that cannot be re-fetched cheaply: TPS, slot time, sampled median fee, validator aggregate/delinquency, and tokenized-asset rolling-volume observations.

Raw provider responses, full validator snapshots per run, block payloads, transaction samples, and an alert event log are not required outputs and should not be retained.

`updatedAt` means the time a complete validated snapshot/report pair was published. Each metric also needs its own `observedAt`, source timestamp where available, and `fresh | stale | unavailable` status. A new pipeline run can therefore publish fresh metrics alongside retained stale metrics without misrepresenting their observation times.

## History inventory

| Data | Provider history | Own history needed | Local candidate retention |
| --- | --- | --- | --- |
| TPS and slot time | RPC exposes only about 12 hours | Yes, for dashboard trend | 30 days of scheduled points |
| Block height and epoch progress | Current only | No | Current snapshot only |
| Validator table/top/stake distribution | Current only | No historical table requirement | Current positive-stake table only |
| Validator aggregate/delinquency | Current only | Yes, alert persistence/context | 30 days of scheduled points |
| SOL price | Provider history available | No accumulation | Latest 90 daily points plus current observation |
| Solana TVL | Full daily provider history | No accumulation | Latest 90 completed daily points |
| Stablecoin supply | Full daily provider history | No accumulation | Latest 90 completed daily points |
| DEX volume | Full daily provider history | No accumulation | Latest 90 completed daily points |
| REV components | Daily provider histories | No accumulation | Latest 90 joined completed daily points |
| Median transaction fee | RPC calculation only | Yes | 30 days of scheduled points |
| Tokenized-asset/equity 30d volume | Only sparse comparison points publicly | Yes | Up to 365 distinct provider-date points |
| Daily active addresses | 365 daily provider points | No accumulation | Latest 90 completed daily points |
| News | Bounded RSS | No | Latest eight items |
| Upcoming upgrades | Current curated list | No | Current non-live cards |
| Alerts | Derived current conditions | No event log | Active alerts only |

The default retention values are presentation/storage bounds, not claims that older history does not exist. They can be methodology constants, but changing them should not change metric definitions.

## Expected data volume

At an hourly update cadence:

- 30 days is 720 project-originated points per hourly series;
- compact normalized TPS, slot, fee, and validator aggregate histories together are expected to be roughly 150–400 KB in minified JSON;
- 90-day daily provider series across price, TVL, stablecoins, DEX, REV, and active addresses are expected to be below 150 KB after normalization;
- approximately 700 positive-stake validator rows are expected to be roughly 150–350 KB depending on provenance fields;
- news, upgrades, alerts, source states, and scalar sections are expected to be below 50 KB;
- one complete minified `data.json` should normally remain under roughly 1 MB and is explicitly validated against a conservative 2 MB ceiling.

One year of daily tokenized-asset observations is only tens of kilobytes. The project therefore has no volume-based need for SQL, KV, object storage, or sharded files.

## Option A — Bounded generated JSON committed with the report

- Source of truth: the latest validated repository `data.json` on the production branch.
- Files:
  - `data.json`: canonical current snapshot plus bounded normalized histories and per-source state;
  - `report.md`: deterministic derived view of the same snapshot;
  - dashboard static assets: consumers, never an independent data store.
- Authentication: scheduled GitHub Actions can write using the repository-scoped built-in `GITHUB_TOKEN`; no data API key and no storage service credential.
- Methodology:
  1. Read and schema-validate the previous `data.json`.
  2. Collect new observations into memory/temporary workspace.
  3. Replace successful metric values and append/deduplicate own-history points by canonical observation time.
  4. On an allowed partial-source failure, retain the previous valid metric/history and mark it stale with a structured error; never append a fake point.
  5. Trim every series to its documented bound.
  6. Generate both outputs, validate cross-output invariants, then commit them in one Git commit.
  7. Vercel deploys the commit; the prior deployment remains live if the new deployment fails.
- History: contained in bounded arrays within `data.json`. Git history provides an audit trail but is not queried by the dashboard and is not the metric-history format.
- Advantages: one inspectable artifact; static CDN delivery; no database/backend/provider account; built-in versioning; easiest local reproduction; snapshot/report cannot drift if generated together; directly meets the required outputs.
- Disadvantages: scheduled commits and deployments; Git retains old deltas even when arrays are trimmed; concurrent runs need serialization; a corrupt production snapshot must stop the pipeline rather than be overwritten.

GitHub recommends keeping individual objects below 1 MB and enforces 100 MB; the candidate's 2 MB validation ceiling is far below the enforced limit but can exceed the recommendation in an edge case. GitHub also recommends generated data outside Git for large repositories, yet this bounded sub-megabyte public artifact is the product output itself, not a bulk dataset. Repository growth must be reviewed as an operational limitation.

## Option B — JSONL/project data files committed to Git

- Source of truth: append-only JSONL files, potentially one per metric/month, plus a generated current `data.json`.
- Authentication: built-in `GITHUB_TOKEN`.
- Methodology: append a row per successful observation and compact/read segments during generation.
- History: explicit, append-friendly, and potentially unbounded unless rotated.
- Advantages: clean event history, small textual diffs, easier recovery of old project-originated observations.
- Disadvantages: duplicates data between JSONL and required `data.json`; introduces compaction, segmentation, deduplication, and partial-write concerns; encourages retaining history the bounty does not require; more files and repository growth. The bounded histories are too small to justify it.

## Option C — Vercel Blob

- Source of truth: public or private Blob objects for snapshot/history/report.
- Authentication: writes require a Vercel Blob store and `BLOB_READ_WRITE_TOKEN` or equivalent project integration credentials.
- Methodology: scheduled updater writes versioned objects and updates a stable reference, with application-side consistency/version handling.
- History: arbitrary object-based retention.
- Advantages: avoids frequent data commits/redeploys; suitable if files become large; Vercel CDN delivery; Hobby includes limited free usage.
- Disadvantages: another provisioned service, secret, billing/usage limits, object lifecycle, and atomic-pointer design; public fetch/caching behavior must be managed; the dataset is far below the scale Blob is intended to solve. It adds operational state without closing an unmet bounty requirement.

## Option D — KV/Redis/Postgres or hosted SQLite

- Sources: Vercel Marketplace products such as Upstash/Redis, Neon/Postgres, Supabase, or a hosted SQLite provider such as Turso.
- Authentication: provider accounts and injected connection credentials.
- Methodology/history: store current values and time-series rows/keys, then expose them through build logic or a serverless endpoint.
- Advantages: transactional writes, queries, concurrency control, and scalable history.
- Disadvantages: database schema/migrations, credentials, service availability/billing, runtime access layer, and a backend/API to turn rows into required static artifacts. Vercel KV itself is no longer available and new Redis is an external Marketplace integration. None of the required bounded data needs database querying.

Local SQLite inside a Vercel Function is specifically unsuitable: Vercel documents function storage as ephemeral and not a shared persistent filesystem. A repository SQLite file would merely be a harder-to-review binary artifact and would still require regeneration/commit/deployment.

## Option E — Build cache, Actions cache/artifacts, or live-site scraping as state

- Sources: CI caches/artifacts, Vercel build cache, or fetching the previous production `/data.json` during a new run.
- Authentication: platform-specific.
- Advantages: avoids source commits in some workflows.
- Disadvantages: caches are evictable and not durable source-of-truth storage; artifacts expire and are not naturally public; using the live site creates a circular dependency and makes disaster recovery harder. These may optimize a build but cannot own last-known-good state.

## Recommended candidate

Option A: one bounded, schema-versioned `data.json` as the canonical durable snapshot and one deterministic `report.md` derived from it, both committed atomically by the scheduled updater. The static dashboard fetches `/data.json`; it never calls upstream providers.

Do not add JSONL, a database, Vercel Blob, a Vercel Function, or a separate state file. The single canonical snapshot already holds the small histories and last-known-good source states needed for the next run.

Important representation rules:

- exact lamport/stake/slot/height integer values that can exceed JavaScript's safe integer range are decimal strings;
- monetary/rate calculations use finite JSON numbers only after explicit range checks;
- history arrays are chronological, deduplicated, and bounded;
- source and metric timestamps are ISO 8601 UTC strings;
- missing source data is represented by status/error metadata, never a fabricated numeric zero;
- schema version and methodology version are top-level fields;
- no raw provider payload is embedded.

## Dependencies

- Research 13 for atomic file/commit publication, stale rules, validation, and critical-failure boundaries.
- Research 12 for scheduler concurrency and Vercel Git deployment behavior.
- Phase 3 canonical schema design after all research has been synthesized.
- Dashboard technology that can load a sub-2 MB static JSON file without a server.

## Produced data

`scalar`, `time series`, `table`, `distribution`, `status`

## Update characteristics

- Reasonable writer count: exactly one serialized scheduled pipeline plus manual `workflow_dispatch` using the same concurrency group.
- Write unit: one repository commit containing the validated `data.json` and `report.md` pair.
- Dashboard read path: one cacheable static JSON request per page load.
- Growth in the working tree is bounded; Git object history still grows with commits and is a known maintenance consideration.
- A 2 MB hard output ceiling, 30-day hourly own histories, 90-day provider histories, and 365 daily RWA points keep browser parsing/deployment trivial relative to Vercel's 100 MB Hobby static-upload limit.

## Risks / Open Questions

- Frequent scheduled commits grow `.git` even though the working snapshot is bounded. Minified deterministic output and exclusion of raw payloads/full historic validator tables reduce deltas. Research 12 must choose a useful cadence below Vercel's 100 deployments/day Hobby limit.
- GitHub scheduled workflows can overlap or be delayed; concurrency and pull/rebase/retry rules are required.
- Vercel deployment is downstream of the commit. If it fails, repository data can be newer than the live dashboard until a retry; the dashboard still honestly shows its deployed snapshot timestamp.
- A partial collector failure may still produce a valid mixed-freshness snapshot. A missing/invalid previous snapshot makes retention impossible and can turn that same failure critical.
- The final schema is intentionally not frozen in this research. It is designed only after Research 1–13 synthesis, as required by the master protocol.
- If real measured `data.json` approaches the 2 MB ceiling, reduce retained display history or fields before introducing storage infrastructure. Backend/storage expansion requires a new explicit necessity proof.

## Sources

- GitHub repository limits and recommendations: https://docs.github.com/en/repositories/creating-and-managing-repositories/repository-limits
- GitHub Actions limits: https://docs.github.com/en/actions/reference/limits
- Vercel limits (including Hobby deployments and static upload): https://vercel.com/docs/limits
- Vercel Git-triggered builds: https://vercel.com/docs/builds
- Vercel static build-output files: https://vercel.com/docs/build-output-api/primitives
- Vercel storage overview: https://vercel.com/docs/storage
- Vercel Blob usage/pricing: https://vercel.com/docs/vercel-blob/usage-and-pricing
- Vercel KV sunset / Redis Marketplace: https://vercel.com/docs/redis
- Vercel SQLite/serverless filesystem guidance: https://vercel.com/kb/guide/is-sqlite-supported-in-vercel
