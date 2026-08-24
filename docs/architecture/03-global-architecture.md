# Phase 3 — Global Architecture Design

Status: complete  
Designed: 2026-08-20  
Basis: Frozen Master Scope, Research 1–13, Phase 2 synthesis

## Architecture decision

The project is a static Vite site whose complete data and last-known-good state live in one generated `public/data.json`. An hourly GitHub Actions job is the only updater. It executes keyless collectors, validation, calculations, bounded-history merging, alert evaluation, JSON/Markdown generation, tests, and a production build; it then commits `public/data.json` and `public/report.md` together. Vercel's Git integration turns that commit into an immutable static deployment.

There are no Vercel Functions, API routes, databases, KV stores, Blob stores, queues, wallets, authentication, or persistent processes.

```text
GitHub Actions (hourly, serialized)
        │
        ├── official Solana RPC
        ├── DefiLlama public APIs
        ├── Solana Foundation public data/content
        ├── Jito public data
        └── RWA.xyz public page data
        │
        ▼
collect → validate → normalize → derive → merge bounded history
        │
        ▼
candidate canonical snapshot → alerts → global validation
        │                         │
        ├── public/data.json      └── deterministic templates only
        └── public/report.md
        │
        ▼
unit/integration tests → Vite production build → atomic Git commit
        │
        ▼
Vercel Git deployment → static dashboard + JSON + Markdown
```

## Backend necessity proof

1. **What concrete bounty requirement would a backend close?** Scheduled collection, persistence, or dynamic delivery.
2. **Why cannot static/build-time/scheduled close it?** GitHub Actions provides scheduling and the required JSON provides tiny durable state; Vercel serves immutable static outputs.
3. **Why is a simpler option worse?** It is not. A backend would add credentials, runtime limits, failure modes, and maintenance.
4. **How would it be maintained?** It would require runtime/security/storage ownership that the selected design avoids entirely.

Decision: backend rejected.

## Data Sources Matrix

| Metric/output | Primary source and endpoint | Final methodology | Refresh | Fallback |
| --- | --- | --- | --- | --- |
| TPS | Solana RPC `getRecentPerformanceSamples(80)` | Duration-weighted total TPS over newest 5 complete samples | 1h | LKG stale |
| Slot time | Same RPC response | `sum(seconds)/sum(slots)*1000` over same 5 samples | 1h | LKG stale |
| TPS/slot alert baseline | Same RPC response | Two 5m bins vs next ~60m baseline | 1h | evaluation unavailable |
| Block height | Solana RPC `getEpochInfo`, finalized | Exact returned block height | 1h | LKG stale |
| Epoch progress | Same `getEpochInfo` | `slotIndex/slotsInEpoch*100` | 1h | LKG stale |
| Validators/status/commission/stake/top | Solana RPC `getVoteAccounts`, finalized, default 128-slot delinquency, exclude unstaked | One positive-activated-stake table and derived aggregates | 1h | whole validator LKG stale |
| Median transaction fee | Solana RPC `getSlot`, `getBlocks`, 16 stratified `getBlock` calls in batches ≤8 | Median of every actual `meta.fee` in sample, all transaction types | 1h | fee LKG stale |
| SOL current/24h/history | DefiLlama Coins current, historical timestamp, and chart endpoints for `coingecko:solana` | Current USD, exact ~24h same-provider reference, 90-day chart | 1h | CoinGecko keyless complete price domain, else LKG |
| TVL alert input | `api.llama.fi/v2/historicalChainTvl/Solana` | Latest two adjacent completed UTC days; 90-day evidence | 6h | LKG stale |
| Stablecoin supply | `stablecoins.llama.fi/stablecoincharts/Solana` | Latest completed-day `totalCirculatingUSD`, unreleased excluded | 6h | LKG stale |
| DEX volume | `api.llama.fi/overview/dexs/Solana?excludeTotalDataChart=false&excludeTotalDataChartBreakdown=true` | Latest strictly completed UTC-day direct-DEX aggregate | 6h | LKG stale |
| REV fee component | `solana.com/api/databricks/data?days=120` | Median of required Allium+Dune `Fees`, SOL, per completed date | 6h | joined REV LKG stale |
| REV Jito tips | `kobe.mainnet.jito.network/api/v1/daily_mev_rewards` | `jito_tips + validator_tips`, inner-join fee date | 6h | joined REV LKG stale |
| Daily active addresses | Same Solana Data response | Median of required Allium+Dune `Fee Payers` per completed date | 6h | LKG stale |
| Tokenized assets/equities | `app.rwa.xyz/networks/solana`, current Next data resolved from page | RWA and `Stocks` trailing-30d transfer volume USD | 6h | LKG stale |
| News | `solana.com/news/rss.xml` | Newest 8 valid source-authored items | 6h | LKG stale |
| Upcoming upgrades | `solana.com/upgrades` and linked official detail pages | Current non-live official cards; extract official SIMD links | 6h | LKG stale |

The default Solana RPC URL is `https://api.mainnet-beta.solana.com`/the current official mainnet endpoint documented by Solana and is configurable via `SOLANA_RPC_URL`. The project works with the default and does not require a credential. An operator may supply an equivalent endpoint URL, but this is not necessary for the submission.

## Collection groups and atomic domains

One provider response may feed multiple outputs, but replacement boundaries prevent contradictions:

| Domain ID | Replaced together |
| --- | --- |
| `network.performance` | TPS, non-vote provenance, slot time, performance history point, TPS/slot alert inputs |
| `network.chain` | finalized slot, block height, epoch raw fields/progress |
| `validators` | full table, counts, stake totals/distribution, top 10, current commissions, bounded commission-change log, validator history point, delinquency input |
| `economics.solPrice` | current/reference/movement and coherent source-specific chart |
| `economics.tvlAlertInput` | latest/previous/change and bounded history |
| `economics.stablecoinSupply` | current completed-day supply and history |
| `economics.dexVolume` | current completed-day volume and history |
| `economics.rev` | fees, Jito tips, total, date, provider consensus, joined history |
| `economics.medianTransactionFee` | median, sample metadata, history point |
| `ecosystem.tokenizedAssets` | total/equity rolling values and own history point |
| `ecosystem.dailyActiveAddresses` | consensus/provider values and history |
| `ecosystem.news` | feed metadata and bounded items |
| `ecosystem.upgrades` | normalized non-live cards and extracted SIMD links |

A source response can partially normalize only where the output domains are semantically independent. For example, Solana Data `Fees` can succeed while `Fee Payers` fails, but REV still also requires Jito. Validator counts cannot update without the table from which they were derived.

## Storage Model

### Stored

- one current normalized snapshot for every frozen requirement;
- bounded histories defined in synthesis;
- raw exact integer representations needed for auditability;
- active alerts plus the five current alert evaluations;
- source/domain status, timestamps, next-due times, and safe error codes;
- news/upgrades current bounded lists.

### Not stored

- raw provider bodies;
- transaction/block sample payloads;
- all historical validator tables;
- old news/upgrades archives;
- alert event log;
- debug traces or monitoring telemetry;
- API credentials.

### Live versus scheduled

Nothing is fetched live in the browser. “Current” means newest successfully scheduled observation, with its visible timestamp. All upstream traffic occurs in GitHub Actions.

### Canonical source of truth

`public/data.json` is both:

- the required machine-readable output served as `/data.json`; and
- the durable last-known-good input to the next updater run.

`public/report.md` is derived and never read back as state. Git is the durability/audit mechanism; Vercel is delivery, not canonical storage.

## Canonical schema v1

The following is the fixed top-level contract. Formal runtime schemas mirror it during implementation.

```json
{
  "schemaVersion": "1.0.0",
  "methodologyVersion": "1.0.0",
  "updatedAt": "2026-08-20T00:00:00.000Z",
  "updateStatus": "complete",
  "sources": {},
  "network": {},
  "validators": {},
  "economics": {},
  "ecosystem": {},
  "alertChecks": [],
  "alerts": []
}
```

### Common source record

`sources` is keyed by stable source ID. Every used source has:

```json
{
  "name": "Solana RPC",
  "url": "https://api.mainnet-beta.solana.com",
  "status": "fresh",
  "lastAttemptAt": "...",
  "lastSuccessAt": "...",
  "nextDueAt": "...",
  "dataThrough": "...",
  "error": {
    "code": "HTTP_TIMEOUT",
    "message": "Source request timed out"
  }
}
```

- `status`: `fresh | stale | unavailable`.
- `dataThrough` and `error` are optional, not `null` placeholders.
- URLs are canonical source pages/endpoints without secrets.
- Messages are deterministic/sanitized; raw provider bodies/stacks stay in CI logs.

### Common domain fields

Every independently replaceable domain begins with:

```json
{
  "status": "fresh",
  "observedAt": "...",
  "sourceIds": ["solanaRpc"]
}
```

When stale, the old `observedAt` remains and `staleSince` is added. A never-observed unavailable domain omits value-specific fields.

### `network`

```text
network.performance
  status, observedAt, sourceIds
  sample: count, windowSeconds, endingSlot
  tps: total, nonVote
  slotTimeMs
  history[]: observedAt, totalTps, nonVoteTps, slotTimeMs

network.chain
  status, observedAt, sourceIds, commitment
  slot (decimal string)
  blockHeight (decimal string)
  epoch: number, slotIndex, slotsInEpoch, progressPct
```

History is chronological, deduplicated by `observedAt`, and limited to 720 hourly points.

### `validators`

```text
status, observedAt, sourceIds, delinquencyDistanceSlots
counts: active, delinquent, total
stake:
  activeLamports, delinquentLamports, totalLamports (decimal strings)
  delinquentPct, top10Pct
  distribution[]: label, optional votePubkey, stakeLamports, sharePct, status
top[]: ValidatorRow (10)
table[]: ValidatorRow (all positive-stake rows)
history[]:
  observedAt, activeCount, delinquentCount,
  totalStakeLamports, delinquentStakeLamports, delinquentStakePct

ValidatorRow:
  rank, votePubkey, nodePubkey, status,
  activatedStakeLamports, stakeSharePct, commissionPct
```

Status is exactly `active | delinquent`; distribution's synthetic `Other` row uses `status: "aggregate"`.

### `economics`

```text
economics.solPrice
  status, observedAt, sourceIds, currency: USD
  currentUsd, change24hPct
  reference24h: observedAt, priceUsd, elapsedSeconds
  confidence
  history[]: observedAt, priceUsd

economics.tvlAlertInput
  status, observedAt, sourceIds, currency: USD
  latest: date, valueUsd
  previous: date, valueUsd
  change1dPct
  history[]: date, valueUsd

economics.stablecoinSupply
  status, observedAt, sourceIds, currency: USD
  date, totalCirculatingUsd
  history[]: date, totalCirculatingUsd

economics.dexVolume
  status, observedAt, sourceIds, currency: USD
  date, dailyVolumeUsd
  history[]: date, dailyVolumeUsd

economics.rev
  status, observedAt, sourceIds, unit: SOL
  date, totalSol
  components: transactionFeesSol, grossJitoTipsSol
  feeConsensus:
    method: median, providers[]: name/valueSol, minSol, maxSol
  history[]:
    date, totalSol, transactionFeesSol, grossJitoTipsSol,
    feeProviderCount, feeProviderMinSol, feeProviderMaxSol

economics.medianTransactionFee
  status, observedAt, sourceIds, unit: lamports
  medianLamports
  sample:
    commitment, startSlot, endSlot, producedSlotCount,
    selectedBlockCount, transactionCount, approximateWindowSeconds
  history[]: observedAt, medianLamports, transactionCount, selectedBlockCount
```

Price history can use daily provider points plus the distinct current timestamp. Other provider histories are newest 90 completed daily points. Median-fee history is newest 720 hourly points.

### `ecosystem`

```text
ecosystem.tokenizedAssets
  status, observedAt, sourceIds, currency: USD, windowDays: 30
  totalTransferVolumeUsd, equityTransferVolumeUsd
  history[]: observedAt, totalTransferVolumeUsd, equityTransferVolumeUsd

ecosystem.dailyActiveAddresses
  status, observedAt, sourceIds
  date, value
  consensusMethod: median
  providers[]: name, value
  history[]: date, value, allium, dune

ecosystem.news
  status, observedAt, sourceIds, feedUpdatedAt
  items[]: id, title, url, publishedAt, optional description

ecosystem.upgrades
  status, observedAt, sourceIds
  items[]:
    id, title, subtitle, url, stage, stageLabel,
    releaseId, releaseLabel, optional expected,
    optional publishedAt, metrics[], simds[]

metrics[]: value, label
simds[]: id, title, url
```

Tokenized history is deduplicated by provider `observedAt`/date and capped at 365. Active addresses retain 90 completed days. News caps at 8.

### Alerts and evaluations

`alertChecks` always contains exactly these stable IDs in a fixed order:

```text
tps-change
slow-slot-time
high-validator-delinquency
large-tvl-change
large-sol-price-move
```

Each check contains:

```text
id, kind
status: normal | triggered | unavailable
metricPath, unit, window, threshold
optional direction: up | down
optional observedAt, currentValue, referenceValue, changePct
optional reasonCode
```

`threshold` is a JSON object appropriate to the rule and contains every versioned constant/persistence requirement. `alerts` contains only checks with `triggered` status, normalized to:

```text
id, kind, severity: warning, title, message, observedAt, checkId
```

Messages come from fixed templates. The UI/report renders the associated check evidence. If a check is unavailable, the alert section explicitly says evaluation is unavailable; absence from `alerts` never alone means healthy.

## Precision and normalization rules

- Lamports, stake, slots, and block height are computed as `BigInt` and serialized as base-10 strings where exactness can exceed JavaScript safe integers.
- Counts that are demonstrably bounded below `Number.MAX_SAFE_INTEGER` remain JSON integers.
- Rates, percentages, prices, and USD/SOL aggregates are finite JSON numbers; no NaN/infinity.
- UTC timestamps use full ISO 8601; completed-day keys use `YYYY-MM-DD`.
- Histories are ascending; incoming reverse Jito/RPC order is normalized.
- Values are not rounded in canonical JSON beyond source precision; display formatting is frontend/report only.
- All text/URLs from sources are length-bounded and sanitized before entering the snapshot.

## Update Model

```text
GitHub schedule / manual dispatch
  ↓
load config + validate previous schema
  ↓
compute due collectors (bootstrap forces all)
  ↓
parallel safe source groups
  ├─ RPC light batch
  ├─ RPC fee sampling (depends on finalized slot)
  ├─ DefiLlama domains
  ├─ Solana Data + Jito
  ├─ RWA page/data
  └─ RSS + upgrades/details
  ↓
validate source contracts
  ↓
normalize atomic domains
  ↓
merge fresh domains / preserve LKG stale / retain not-due fresh
  ↓
append+trim project histories
  ↓
derive five alert checks and active alerts
  ↓
validate canonical snapshot + invariants + size
  ↓
render deterministic Markdown from snapshot
  ↓
cross-output verify → tests → Vite build
  ↓
commit exactly public/data.json + public/report.md
  ↓
Vercel production deployment
```

Parallelism is bounded. RPC block batches are sequential/bounded enough to respect public limits; unrelated HTTP sources can run concurrently with a small cap. No asynchronous work is allowed to outlive a collector deadline.

## Frontend Architecture

### Stack

- Vite vanilla build;
- semantic `index.html`;
- modular browser JavaScript;
- one stylesheet;
- Chart.js only;
- no framework/router/state library/component kit.

### Page structure

```text
Header: title, update status, last updated
Alerts / Notable Changes
Network Performance
Validator Status
Economic Indicators
Ecosystem Growth
Ecosystem and Community News
Upcoming Upgrades / Developments
Methodology/source links + report/data links
```

This ordering surfaces current issues without creating a separate notification product. Every frozen section exists once.

### Rendering

- Fetch `/data.json`, reject unknown schema versions, then render.
- Metric cards show value, unit, observation date/time, and freshness.
- Temporal series use Chart.js line/bar charts with hover/touch tooltips and animation disabled.
- Each temporal chart can lazily create one expanded native-dialog chart over the same in-memory snapshot. Its X-only zoom/pan is clamped to canonical timestamps, its Y scale follows visible source points, and closing it destroys the extra chart instance.
- The expanded view exposes the visible canonical rows in a native table. It performs no second fetch, polling, interpolation, persistence, or upstream browser request.
- Current values are present as text outside canvas.
- Validator table defaults to stake descending and provides only essential client-side column sorting; it remains a native semantic table in a bounded scroll container.
- Vote-account public keys remain fully visible and selectable in the bounded table.
- Stale/unavailable is text plus icon/color, never color alone.
- No polling: a static deployment represents one immutable snapshot.

## Markdown report architecture

The report is a pure template over the canonical snapshot. It contains:

1. update date/time and overall complete/partial state;
2. Alerts / Notable Changes and all unavailable alert checks;
3. Network Performance;
4. Validator Status, stake distribution summary, and top-ten table;
5. Economic Indicators;
6. Ecosystem Growth;
7. Ecosystem and Community News;
8. Upcoming Upgrades / Developments;
9. source freshness/status table and methodology links.

It includes no prose inference, AI analysis, prediction, or causal explanation. Every sentence outside static methodology labels is a fixed template populated from data.

## Failure Model

| Failure | Behavior |
| --- | --- |
| Solana RPC light batch fails | Preserve affected network/chain/validator domains independently where possible; no fee coupling |
| Median-fee block sample incomplete | Preserve only median-fee domain stale; other RPC metrics can publish |
| DefiLlama one endpoint fails | Preserve that endpoint's atomic domain; other DefiLlama domains remain eligible |
| DefiLlama price fails | Try full CoinGecko price domain once; record source switch; otherwise LKG stale |
| Solana Data `Fees` invalid | REV cannot refresh even if Jito succeeds; preserve joined REV |
| Solana Data `Fee Payers` invalid | Active addresses stale; REV may still refresh |
| Jito invalid/missing common date | Preserve joined REV; never publish fees alone as REV |
| RWA public shape changes | Preserve tokenized domain stale; do not substitute xStocks DEX volume |
| RSS item malformed | Drop only that item if at least configured minimum valid items remain; otherwise preserve feed domain |
| Upgrade stage unknown | Preserve entire upgrades domain; do not guess live/upcoming |
| Not-due source | Carry forward as fresh only inside its freshness budget; no fake history point |
| Stale alert input | Check becomes unavailable; old alert not copied as current |
| Previous canonical snapshot invalid | Critical stop; no merge/publication |
| Required bootstrap domain has neither current nor LKG | Critical stop |
| Candidate/report/build invariant fails | Critical stop before commit |
| Git push conflict | Fail normally; never force; next/manual run retries from newest branch |
| Vercel build/deploy fails | Previous immutable production deployment remains; repo may be newer until retry |

## Deployment Architecture

### Repository

- public GitHub repository, production branch `main`;
- Actions enabled with `contents: write` for the update workflow;
- exact lockfile committed;
- generated outputs committed and reviewable.

### Vercel

- connect the GitHub repository once;
- Framework Preset: Vite;
- Build Command: `npm run build`;
- Output Directory: `dist`;
- no Functions/Cron/Storage products/environment secrets required for default operation;
- production branch `main`;
- static headers for `/data.json` and `/report.md` require revalidation rather than long browser caching;
- security headers disallow external script/style origins because dependencies are bundled locally.

### Scheduler

- `.github/workflows/update.yml`;
- `schedule: 17 * * * *` UTC plus `workflow_dispatch`;
- one concurrency group, active run not canceled;
- 15-minute job timeout;
- install, update, full verification, build, staged-diff check, normal commit/push.

## Configuration

Version-controlled configuration contains only methodology constants:

- RPC default URL and commitment;
- source endpoints/IDs;
- collector due/freshness intervals;
- performance/fee sample sizes;
- history retention lengths;
- alert thresholds/windows;
- news/top-validator limits;
- output size ceiling.

Environment configuration is limited to optional `SOLANA_RPC_URL`. No default feature depends on it being set. Secrets are never serialized or logged.

## Architecture invariants

1. Every frozen requirement maps to exactly one canonical field/domain and one dashboard/report representation.
2. No active alert exists without a triggered alert check and fresh comparable evidence.
3. No current scalar differs from the last point when the provider defines them as the same completed observation.
4. Validator counts/table/top/distribution derive from the same positive-stake set.
5. REV total equals fee consensus plus gross Jito tips for the same date within numeric tolerance.
6. Histories are unique, ascending, bounded, and never receive a point from a failed/not-due run.
7. Stale values retain original observation time.
8. `updatedAt` changes only for a candidate that passed global validation.
9. Report timestamp/status/current values match JSON.
10. Dashboard makes zero upstream/provider requests.
11. `public/data.json` is ≤2 MB.
12. Default operation uses zero data-provider keys and zero runtime backend components.

## Architecture limitations accepted

- Hourly updates are scheduled, not real-time.
- GitHub schedules can be delayed/dropped.
- Daily provider metrics can lag one to three days and can be revised.
- Median fee is a disclosed deterministic sample, not a population census.
- Daily active addresses are initiating-signer/fee-payer estimates, not people.
- RWA keyless page data is an unversioned public representation.
- Official RSS is not exhaustive independent-community media coverage.
- Vercel promotion follows, rather than participates in, the Git commit transaction.

These are documented limitations, not reasons to add a backend or paid provider.
