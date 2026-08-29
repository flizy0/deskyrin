# Deskyrin

Deskyrin is an auto-updating Solana network and ecosystem report with a dark analytical terminal, generated Markdown, and machine-readable JSON. It runs without a wallet, database, persistent backend, paid API, or mandatory API key.

**Live dashboard:** [deskyrin-gamma.vercel.app](https://deskyrin-gamma.vercel.app)  
**Generated outputs:** [`public/data.json`](public/data.json) · [`public/report.md`](public/report.md)  
**Full methodology:** [`docs/methodology.md`](docs/methodology.md)  
**Frozen bounty scope:** [`docs/research/00-frozen-master-scope.md`](docs/research/00-frozen-master-scope.md)

## What it shows

- Network Performance: TPS, non-vote TPS provenance, slot time, block height, and epoch progress.
- Validator Status: active/delinquent counts, activated-stake distribution, top validators, current commission, bounded commission-change tracking, and row status.
- Economic Indicators: SOL price movement, stablecoin supply, completed-day DEX volume, Real Economic Value, and sampled median transaction fee.
- Ecosystem Growth: tokenized-asset and tokenized-equity trailing-30-day transfer volumes, plus daily active addresses.
- Official ecosystem/community news and upcoming developments, including Alpenglow and Reduced Slot Times/SIMD-0525 while officially upcoming.
- Five fixed notable-change checks: TPS drop/spike, slow slots, validator delinquency, TVL movement, and SOL price movement.

The terminal separates Overview, Network, Validators, Economy, Ecosystem, and Sources into route-lazy views inside one persistent responsive shell. Charts use hover and keyboard tooltips; every temporal chart can open a larger source-history explorer with bounded X-axis zoom, horizontal pan, UTC range presets, reset controls, and a native table of visible canonical observations. The full validator/source tables remain horizontally contained and vertically readable. `report.md` is deterministic template output; there is no AI analysis or summary code.

## Why Deskyrin is different

- **Evidence-first source correlation:** fee observations from Allium and Dune are reconciled on the same completed UTC date, then joined to matching Jito gross tips to derive an auditable REV total. Provider values, ranges, components, dates, and provenance remain visible instead of being collapsed into an unexplained number.
- **Explainable, noise-resistant alerts:** TPS and slot-time checks use duration-weighted samples, two adjacent recent bins, a median prior-hour baseline, and simultaneous relative and absolute thresholds. Validator delinquency is stake-weighted and requires a second fresh confirmation, while stale evidence produces an unavailable check rather than a false alert or false all-clear.
- **Derived on-chain fee sampling:** the median transaction fee is calculated directly from finalized Solana blocks selected through a deterministic 16-block stratified sample across an approximately 9,000-slot window. The sampling frame and transaction counts are published with the result.
- **Failure-aware state without a database:** the previous validated snapshot acts as bounded state. Independent domains can retain explicit stale last-known-good values when a provider fails, while healthy domains continue to update; missing data is never replaced with invented zeroes.
- **Auditable presentation from one canonical snapshot:** the dashboard, interactive source-history tables, generated Markdown, alerts, and machine-readable JSON all derive from the same validated artifact. The browser performs no hidden provider fetches, interpolation, prediction, or synthetic history generation.

These are deterministic, domain-specific engineering choices rather than AI/ML claims: the alert thresholds are fixed and documented, Allium/Dune observations arrive through the Solana Foundation data aggregator, and the sampled fee is an estimate rather than an exact network-wide median.

## Static-first architecture

```text
GitHub Actions (hourly at :17 UTC)
                 │
                 ▼
       keyless collectors
                 │
                 ▼
 schemas → calculations → LKG/freshness → alert checks
                 │
                 ├──────────────┐
                 ▼              ▼
       public/data.json   public/report.md
                 │
                 ▼
          static Vite build
                 │
                 ▼
       Vercel Git deployment
```

There are no Vercel Functions, Cron Functions, API routes, Blob/KV stores, SQL databases, or always-on processes. Git is the small persistent state required for project-originated hourly/RWA histories and last-known-good values. A successful updater commit triggers the normal Vercel Git redeploy.

## Data sources

| Data | Default source | Authentication | Refresh check |
|---|---|---|---|
| Network, validators, median fee | Solana JSON-RPC | None | Hourly |
| SOL price/history | DefiLlama primary; CoinGecko always-on comparison/fallback; Coinbase daily candles | None | Hourly / daily |
| TVL | DefiLlama chain TVL | None | Every 6 hours |
| Stablecoin supply | DefiLlama Stablecoins | None | Every 6 hours |
| DEX volume | DefiLlama Dimensions | None | Every 6 hours |
| Fees, active addresses, and provider comparisons | Solana Foundation public data aggregator | None | Every 6 hours |
| Jito tips | Jito daily MEV rewards | None | Every 6 hours |
| Tokenized assets/equities | RWA.xyz public Solana page data | None | Every 6 hours |
| News | Official Solana RSS | None | Every 6 hours |
| Upgrades | Official Solana upgrades hub/detail pages | None | Every 6 hours |
| Operational status | Official Solana Statuspage | None | Hourly |
| Agave releases | Official `anza-xyz/agave` GitHub releases | None | Every 6 hours |

`SOLANA_RPC_URL` is optional and must be HTTPS; the default is `https://api.mainnet-beta.solana.com`. Collection checks are configurable with `LIVE_REFRESH_MINUTES` (default `60`, range `60–1440`) and `DAILY_REFRESH_HOURS` (default `6`, range `1–48`). The hourly GitHub scheduler is versioned in the workflow, so intervals below one hour are intentionally unsupported. These settings are ordinary repository variables, not secrets; no source requires an environment secret.

## Local use

Requirements: Node.js 24 and npm.

```bash
npm ci
npm run update
npm run dev
```

Open the local URL printed by Vite. Useful commands:

```bash
npm test          # unit and generated-output integration tests
npm run validate  # canonical JSON + Markdown contract
npm run build     # production static bundle
npm run verify    # scope/static architecture/artifact checks
npm run ci        # complete non-browser verification
npm run update:dry
npm run check:freshness
```

`npm run e2e` runs the reproducible Chromium suite after `npx playwright install chromium`. Installing the browser locally is optional because GitHub Actions installs and runs it on every push and pull request; a successful browser job is still required before submission. The browser binary is not required to update, build, or deploy the dashboard.

## Auto-update behavior

`.github/workflows/update.yml` runs hourly and also supports manual dispatch. One invocation:

1. reads and validates the previous canonical snapshot;
2. checks which source groups are due;
3. fetches and validates fresh public data;
4. calculates metrics and bounded histories;
5. retains failed atomic domains as stale last-known-good values;
6. evaluates all five alert checks with freshness guards;
7. validates both artifacts and atomically replaces each file; the later Git commit is the pair-level publication boundary;
8. runs tests/build/verification;
9. commits only the two generated artifacts.

The workflow has a non-cancelling concurrency group, so scheduled runs cannot overlap. A critical bootstrap/contract/publication error exits non-zero before any commit.

### Freshness monitoring and recovery

`.github/workflows/freshness.yml` checks the deployed `/data.json` separately from the updater. It fails on an HTTP/JSON error, an incompatible public schema envelope, an invalid `updatedAt`, or data older than three hours. `PUBLIC_DATA_URL`, `MAX_DATA_AGE_MINUTES`, and `EXPECTED_SCHEMA_VERSION` are configurable repository variables; no secret or API key is required.

For true scheduler independence, run the same dependency-free checker from an external cron or uptime service and alert on its non-zero exit code:

```bash
PUBLIC_DATA_URL=https://deskyrin-gamma.vercel.app/data.json \
MAX_DATA_AGE_MINUTES=180 npm run check:freshness
```

If data is stale, first use **Update public report → Run workflow** in GitHub Actions. Recovery must start from the latest publication branch and its newest validated canonical snapshot—never from a stale feature branch, because that can erase legitimate history points. If scheduled Actions are unavailable, use a clean, up-to-date checkout of `main`, run `npm ci`, `npm run update`, then `npm run ci`; inspect the diff and commit only `public/data.json` and `public/report.md`. Never hand-edit generated values or publish after validation fails. Authoritative historical source data may be recovered normally, while unavailable point-in-time observations remain an explicit gap.

## Deploying to Vercel

1. Push the repository to a public GitHub repository.
2. Import it into Vercel.
3. Keep the detected Vite settings; [`vercel.json`](vercel.json) already fixes the build command and `dist` output.
4. Do not add a database, function, cron, or environment variable unless the default public RPC is replaced intentionally.
5. Enable GitHub Actions write permission if the repository default does not allow workflow commits.

Vercel serves only static build output. `/data.json` and `/report.md` are explicitly revalidated so a new deployment is visible without a long cache delay.

## Reliability model

- HTTPS allowlist, deadlines, bounded response reads, content-type/status checks, and limited retries.
- Lossless parsing of provider integers before exact stake aggregation.
- Endpoint-specific runtime schemas plus strict canonical output and cross-field invariants.
- Atomic-domain last-known-good preservation: failures never become fake `0`/`null` values.
- Explicit `fresh`, `stale`, and `unavailable` source/check states and separate observation/update timestamps.
- Critical stop when a required bootstrap domain is unavailable, history is incompatible, output is malformed/oversized, or publication validation fails.

## Known limitations

- Public keyless endpoints have no SLA and can rate-limit or change response shape. Last-known-good handling preserves truthfulness but cannot make a provider available.
- The default Solana public RPC is appropriate for this bounded hourly pipeline, not high-volume use. An operator may set another HTTPS RPC without changing the schema.
- Median fee is a documented 16-block temporal sample, not a full scan of every block in the hour.
- TVL, stablecoin, DEX, REV, and active-address series can lag by a completed UTC day and inherit provider classification/revision choices.
- “Daily active addresses” means initiating signers/fee payers, not unique people.
- RWA values are rolling 30-day transfer volumes from a public website data representation; classification or page-contract changes can make the domain stale.
- Official news is intentionally not an exhaustive independent-community feed.
- Static Git/Vercel delivery means a successful data commit is followed by normal deployment latency.
- Chart exploration changes only the visible range of the checked-in snapshot; it does not interpolate points, poll providers, or make daily/hourly data real-time.

## Research and verification

No production code was written until the complete listing scope, 13 independent research topics, synthesis, architecture, stress test, and implementation plan were frozen. Those artifacts are preserved under [`docs/research`](docs/research/) and [`docs/architecture`](docs/architecture/). The final requirement mapping is in [`docs/verification.md`](docs/verification.md).

MIT licensed.
