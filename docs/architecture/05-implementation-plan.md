# Phase 5 — Implementation Plan

Status: complete; production implementation may begin  
Planned: 2026-08-20  
Runtime target: Node.js 24 LTS, static Vite/Vercel

## Implementation objective

Implement the accepted zero-backend architecture without reopening product scope. The code must make every data/source/methodology choice explicit, fixture-test every brittle public contract, and keep collection independent from rendering.

## Repository structure

```text
.
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── update.yml
├── docs/
│   ├── research/
│   ├── architecture/
│   ├── methodology.md
│   └── verification.md
├── public/
│   ├── data.json                 # canonical generated snapshot
│   └── report.md                 # generated human-readable report
├── src/
│   ├── dashboard/
│   │   ├── main.js
│   │   ├── styles.css
│   │   ├── charts.js
│   │   ├── format.js
│   │   └── render.js
│   └── pipeline/
│       ├── update.js             # only pipeline entry point
│       ├── validate-output.js
│       ├── config.js
│       ├── contracts/
│       │   ├── canonical.js
│       │   └── providers.js
│       ├── lib/
│       │   ├── errors.js
│       │   ├── http.js
│       │   ├── rpc.js
│       │   ├── numbers.js
│       │   ├── statistics.js
│       │   ├── time.js
│       │   └── history.js
│       ├── collectors/
│       │   ├── solana-core.js
│       │   ├── median-fee.js
│       │   ├── defi-price.js
│       │   ├── defi-tvl.js
│       │   ├── defi-stablecoins.js
│       │   ├── defi-dex.js
│       │   ├── solana-data.js
│       │   ├── jito.js
│       │   ├── rwa.js
│       │   ├── news.js
│       │   └── upgrades.js
│       ├── metrics/
│       │   ├── network.js
│       │   ├── validators.js
│       │   ├── rev.js
│       │   ├── active-addresses.js
│       │   └── alerts.js
│       └── outputs/
│           ├── snapshot.js
│           ├── report.js
│           └── publish.js
├── tests/
│   ├── fixtures/
│   │   ├── rpc/
│   │   ├── defillama/
│   │   ├── solana-data/
│   │   ├── jito/
│   │   ├── rwa/
│   │   └── content/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── index.html
├── package.json
├── package-lock.json
├── playwright.config.js
├── vercel.json
├── README.md
└── LICENSE
```

Files may be consolidated when a module is trivial, but architectural layers must not be collapsed in a way that lets collectors write outputs or dashboard code know provider shapes.

## Exact dependency budget

### Runtime dependencies

- `zod` — provider and canonical runtime contracts;
- `cheerio` — safe structured parsing of required RWA/upgrades HTML;
- `fast-xml-parser` — official RSS parsing;
- `lossless-json` — preserve RPC `u64` values such as activated stake before normalization;
- `chart.js` — all interactive dashboard charts.

### Development dependencies

- `vite` — static bundling/development server;
- `@playwright/test` — required browser-level tooltip/table/responsive verification.

### Explicitly absent

No Solana SDK, React, Next.js, TypeScript runtime, date library, HTTP client, concurrency library, database client, CSS framework, icon pack, analytics SDK, sanitizer library, logger, or monitoring SDK. Node 24 supplies `fetch`, `AbortSignal`, `BigInt`, filesystem, and its test runner. The narrowly scoped lossless parser is required because JSON-RPC serializes `u64` stake as JSON numbers that ordinary `JSON.parse` rounds before `BigInt` can recover them. HTML-derived descriptions are converted to bounded plain text rather than sanitized-and-reinjected HTML.

Exact package versions are pinned by `package-lock.json`; `package.json` sets `engines.node` to `24.x`.

## Core interfaces

JavaScript modules use ESM and JSDoc for editor/type intent; Zod provides runtime truth.

### Request context

```text
CollectionContext
  now: Date
  runId: string
  config: frozen configuration
  previous: validated canonical snapshot | undefined
  http: bounded HTTP client
  rpc: bounded JSON-RPC client
  log: structured console facade
```

Time is injected so tests never depend on wall-clock behavior.

### Source outcome

```text
SourceOutcome<T>
  success:
    ok: true
    value: T
    attemptedAt, succeededAt
    optional dataThrough

  failure:
    ok: false
    error: { code, message, retryable, sourceId }
    attemptedAt
```

Provider collectors return normalized source data only. They do not merge previous state, append history, calculate unrelated metrics, or write files.

### Domain outcome

```text
DomainOutcome<T>
  fresh: validated complete replacement T
  failed: structured failure
  notDue: previous domain remains eligible under freshness policy
```

The snapshot assembler owns LKG merging and status transitions. This ensures all domains follow one policy.

### Collector signatures

```text
collectSolanaCore(context)       → performance/epoch/vote source outcomes
collectMedianFee(context)        → normalized fee sample
collectDefiPrice(context)        → complete DefiLlama or CoinGecko price domain input
collectTvl(context)              → normalized completed daily series
collectStablecoins(context)      → normalized completed daily series
collectDexVolume(context)        → normalized completed daily series
collectSolanaData(context)       → normalized fee rows + fee-payer rows
collectJito(context)             → normalized daily tip rows
collectRwa(context)              → normalized total/stocks rolling values
collectNews(context)             → normalized feed metadata/items
collectUpgrades(context)         → normalized hub/cards/detail SIMD links
```

### Pure metric functions

All calculations accept normalized inputs and return new immutable values:

- performance aggregation and alert bins;
- validator filtering/ranking/distribution/history;
- median and exact BigInt arithmetic helpers;
- REV same-date join and provider median;
- active-address provider median;
- alert checks/templates;
- history append/deduplicate/trim.

No pure metric function performs network or filesystem I/O.

## Data contracts

### Provider contracts

Each external response has a minimal Zod schema that accepts only fields used by normalization while preserving explicit semantic refinements. Contract tests use trimmed real-shape fixtures and negative mutations.

Contracts include:

- JSON-RPC envelope/result/error and exact method results;
- DefiLlama price/current/history/TVL/stablecoin/DEX shapes;
- Solana Data row envelope and selected metric rows;
- Jito daily reward rows;
- RWA embedded/Next data semantic selectors;
- RSS channel/item result after XML parsing;
- upgrade hub/detail result after HTML parsing.

Unknown extra provider fields are ignored; missing/retyped required fields fail. Canonical output is strict and rejects unknown fields to prevent accidental raw-data leakage.

### Canonical contract

`src/pipeline/contracts/canonical.js` exports:

- schema/methodology version constants;
- per-domain schemas;
- the strict top-level schema;
- `parseCanonicalSnapshot(value)`;
- `serializeCanonicalSnapshot(value)` with deterministic key/array order and final newline;
- invariant checks that Zod shape validation cannot express.

Canonical schemas mirror Phase 3 exactly. A checked-in JSON Schema export is not necessary because runtime and tests use the executable contract; README documents the public shape and `schemaVersion`.

### Deterministic ordering

- source map uses configured source order;
- validator table uses stake descending then vote pubkey;
- history uses UTC ascending;
- alerts/checks use fixed kind order;
- news uses publication descending;
- upgrades use release order then card order from the official hub;
- object serialization uses construction order consistently and two-space formatting unless measured size requires minification. The 2 MB ceiling applies to actual bytes.

## Configuration contract

`config.js` is frozen at process start and exposes only reviewed constants:

```text
schema/methodology versions
source endpoints and hostname allowlists
RPC commitment and 128-slot delinquency distance
80 performance samples, 5-sample headline
9000 fee-window slots, 16 strata, block batch size 8
history limits: 720 hourly / 90 daily / 365 RWA
top validators: 10; news: 8
source due intervals: 1h or 6h
freshness limits from Research 13
five alert thresholds from Research 9
HTTP/RPC timeouts, retries, response-size bounds
2 MB output ceiling
```

Only `SOLANA_RPC_URL` may override a default endpoint. It must parse as HTTPS and is redacted to origin in logs/provenance if it contains credentials/query parameters.

## Pipeline execution order

1. Parse CLI (`--dry-run`, optional `--now` only for tests).
2. Freeze config and capture one UTC `now`/run ID.
3. Read/validate existing `public/data.json`; bootstrap explicitly if absent.
4. Calculate due source groups from validated `lastSuccessAt/nextDueAt`.
5. Start bounded independent collector groups concurrently:
   - Solana core light batch;
   - median fee after finalized-slot discovery, independent failure result;
   - DefiLlama adapters;
   - Solana Data and Jito;
   - RWA;
   - RSS/upgrades.
6. Normalize source results and compute domain candidates.
7. Merge fresh/not-due/stale domains against previous canonical state.
8. Append only fresh project-originated history points and trim all histories.
9. Compute alert checks/active alert templates from the merged candidate, with freshness gates.
10. Construct source records and overall `complete | partial` status.
11. Run canonical schema and global invariants.
12. Generate Markdown from the validated snapshot.
13. Verify report/JSON required values and byte ceiling.
14. In dry-run mode, print summary and write only under an explicit temp output path; otherwise atomically replace the two public files.
15. Exit non-zero on critical error, with no output replacement.

## HTTP/RPC implementation details

- One wrapper around built-in `fetch` implements deadline, retry classification, `Retry-After`, status/content-type/size checks, JSON/text parsing, and structured errors.
- Size-limited reads consume response streams rather than trusting only `Content-Length`.
- JSON-RPC helper assigns string IDs, maps unordered batch results by ID, and distinguishes protocol errors from HTTP errors.
- No global mutable retry state.
- Ordinary parallel HTTP collection uses a small fixed worker limit implemented locally; block RPC batches remain deliberately sequential.
- Logs contain source/domain IDs, attempt number, elapsed time, and result—not full URLs with credentials or provider bodies.

## Report implementation

`renderReport(snapshot)` is a pure function. It uses:

- fixed section headings matching the listing;
- fixed deterministic alert/status prose;
- UTC dates and stable number formatters;
- top-ten validator Markdown table only, not all ~700 rows;
- source links/status table;
- source-provided news/upgrades text only.

Tests parse/assert every required heading, timestamp, current scalar, alert state, and stale label. No AI service/code exists.

## Dashboard implementation

### DOM contract

`index.html` contains semantic landmarks and empty named section roots. `main.js` validates the schema version/light browser contract, renders a fatal data-contract state if incompatible, and calls focused render functions.

### Charts

- import only needed Chart.js controllers/elements/scales/plugins where practical;
- one chart factory sets dark theme, no animation, responsive resize, UTC labels, tooltip callbacks, and unit-aware formatting;
- never coerce missing/stale history points to zero;
- current metric text and timestamps sit outside canvas;
- required charts: TPS, slot time, SOL price, stablecoin supply, DEX volume, REV with components, median fee, tokenized total/equity, daily active addresses;
- TVL remains alert-check evidence, not an extra headline chart.

### Validator presentation

- top-ten compact stake table/distribution;
- full native table with rank, validator vote key, stake, share, commission, and status; node identity remains machine-readable but is not another dashboard column;
- default stake descending with keyboard-operable sort headers for the essential columns;
- sticky header, bounded vertical/horizontal overflow, status text;
- no search, filtering, pagination settings, identity enrichment, or unrelated columns.

### Content safety

- all text assigned with `textContent`/DOM nodes;
- all URLs parsed and hostname/protocol-validated during collection and again before rendering;
- external links use `rel="noopener noreferrer"`;
- no source HTML or inline third-party scripts.

## Test strategy

### Unit tests (Node built-in test runner)

- median odd/even and BigInt-safe helpers;
- performance duration weighting and exact alert threshold boundaries;
- validator positive-stake filtering, rank ties, distribution sum, commission/status;
- history ordering/deduplication/trim/no-failed append;
- daily complete/current-day exclusion and calendar adjacency;
- REV provider median, exact-date join, component invariant;
- active-address provider allowlist/median;
- all five alert normal/triggered/unavailable/persistence cases;
- number/date/Markdown escaping and deterministic templates.

### Contract fixture tests

For every provider:

- researched success shape;
- HTTP/RPC envelope error;
- missing field/type change;
- stale/future date;
- empty/zero structural response;
- unexpected semantic label/unit;
- reversed/duplicate history where applicable.

Fixtures are trimmed to the minimum representative data and contain no secrets.

### Pipeline integration tests

- clean bootstrap with every fixture succeeds and fills all requirements;
- one source failure with LKG produces partial/stale output;
- same failure without LKG is critical and writes nothing;
- Solana Data fee failure does not block active addresses and vice versa;
- Jito mismatch preserves whole REV;
- fee sample partial preserves only fee;
- not-due domains stay fresh within budget and do not append history;
- unknown schema/methodology stops;
- generated JSON/report cross-check and 2 MB gate;
- repeat same observation is idempotent.

### Browser end-to-end tests (Playwright Chromium)

- page loads built `/data.json` with no console/page errors;
- all seven required content sections plus last updated are visible;
- every temporal chart exists; pointer movement produces a Chart.js tooltip;
- validator table has expected rows/columns and stake/commission/status sort works;
- stale/unavailable fixture renders text labels and unavailable alert check;
- mobile viewport has no page-level horizontal overflow and table remains scrollable;
- links to `/data.json` and `/report.md` resolve.

### Live smoke tests

The scheduled updater itself is the live source-contract smoke test. Before initial deployment, run one complete live dry run and one real generation. Deterministic CI never depends on live public endpoints except the scheduled update job.

## Workflow files

### `ci.yml`

- triggers on pull requests and human pushes;
- Node 24, `npm ci`, unit/fixture/integration validation, production build, Playwright Chromium E2E;
- read-only permissions;
- no secrets/live provider calls.

### `update.yml`

- schedule `17 * * * *` UTC and manual dispatch;
- `contents: write`, no other write permission;
- serialized concurrency, 15-minute timeout;
- Node 24, `npm ci`, live update, full deterministic verification/build;
- `git diff --check`, stage exactly two generated files, inspect staged path allowlist;
- commit only when changed, normal push, no force/rebase automation;
- concise GitHub step summary of fresh/stale/unavailable domains.

Official GitHub Actions are pinned during implementation. No deploy token exists; Vercel receives the normal branch push.

## Vercel configuration

`vercel.json` contains only static configuration:

- framework `vite`;
- build/output defaults or explicit `dist`;
- revalidation headers for `/data.json` and `/report.md`;
- security headers compatible with locally bundled assets;
- no `functions`, `crons`, rewrites to APIs, or storage integrations.

## Dependency graph

```text
Config + contracts + HTTP/RPC primitives
                 │
       ┌─────────┴─────────┐
       ▼                   ▼
  Provider collectors   Previous canonical snapshot
       │                   │
       └─────────┬─────────┘
                 ▼
       Normalization + pure metrics
                 │
                 ▼
          Domain/LKG merge
                 │
       History ──┤
                 ▼
          Alert evaluation
                 │
                 ▼
        Canonical snapshot v1
          ├────────┴────────┐
          ▼                 ▼
      data.json          report.md
          │                 │
          └────────┬────────┘
                   ▼
          validation + tests
                   │
             ┌─────┴─────┐
             ▼           ▼
       Vite dashboard   Git commit
             └─────┬─────┘
                   ▼
             Vercel static deploy
```

## Coding waves

### Wave 1 — Shared primitives and contracts

- package/build/test scaffolding;
- config, error model, time/number/statistics/history utilities;
- bounded HTTP and JSON-RPC clients;
- canonical/provider schemas and fixtures.

Verification gate: primitives/contract negative tests pass; no collector writes files.

### Wave 2 — All collectors

- Solana core/validators;
- median fee;
- DefiLlama price/TVL/stablecoin/DEX;
- Solana Data/Jito;
- RWA;
- news/upgrades.

Verification gate: every collector passes success/schema-drift/stale/error fixture tests; live dry-run source shapes are captured/confirmed.

### Wave 3 — Metrics, histories, alerts, snapshot assembly

- network/validator calculations;
- REV/active-address consensus;
- all five alerts;
- due/LKG/freshness merging;
- canonical global invariants.

Verification gate: full fixture bootstrap, partial failure, critical failure, idempotency tests.

### Wave 4 — Outputs

- deterministic canonical serialization/publication;
- Markdown report;
- output validation/cross-check.

Verification gate: required headings/values/statuses and byte ceiling pass.

### Wave 5 — Dashboard

- semantic structure/dark responsive CSS;
- cards/charts/tooltips;
- validator tables;
- news/upgrades/alerts/freshness.

Verification gate: production build and Playwright requirements pass.

### Wave 6 — Automation/deployment

- CI/update workflows;
- Vercel static config/headers;
- local commands and documentation.

Verification gate: workflow syntax, clean `npm ci`, update dry-run/live run, build, and local static E2E pass.

## Integration and completion gates

Production coding is complete only when:

1. a live full update generates every required current domain;
2. `public/data.json` and `public/report.md` validate and agree;
3. dashboard E2E verifies every frozen section/interaction;
4. partial-source simulations preserve LKG and mark stale;
5. critical simulations publish nothing;
6. scheduled workflow uses no data-provider secret;
7. Vercel project contains no runtime function;
8. Phase 8 traceability maps every requirement to source, code, JSON, report, dashboard, and test;
9. README includes deployment URL and known limitations;
10. the production URL is verified after deployment.

No production code existed before this plan was completed.
