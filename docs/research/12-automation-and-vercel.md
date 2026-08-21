# Research 12 — Automation and Vercel

Status: complete (local candidate only; no global architecture decision)  
Researched: 2026-08-20

## Requirement

One unattended update pipeline must fetch fresh data, recalculate metrics/alerts, preserve bounded history and last-known-good values, generate `data.json` and `report.md`, verify the static dashboard, and cause the production Vercel dashboard to use the new data.

The target is Vercel and the architectural default is static-first. The solution must avoid a continuously running backend, a database, paid data APIs, and mandatory data-provider keys.

## Meaning

Scheduling, durable state, generation, validation, and deployment have to form one operational chain:

```text
scheduler
  → checkout last valid snapshot
  → collect / validate / calculate
  → generate JSON + Markdown
  → test static build
  → atomic repository commit
  → Vercel Git deployment
```

A scheduled job being “successful” means it published a fully validated repository snapshot pair. A Vercel deployment is a subsequent immutable build; the previous production deployment remains the live fallback if the new build fails. The deployed dashboard's own timestamp is the authority for what visitors are seeing.

## Option A — GitHub Actions updates the production branch; Vercel Git deploys it

- Scheduler: GitHub Actions `schedule` plus `workflow_dispatch` for an identical manual recovery run.
- Authentication:
  - all selected data sources are keyless;
  - repository writes use the automatically scoped `GITHUB_TOKEN` with explicit `contents: write` permission;
  - Vercel is connected once through its GitHub integration; the workflow needs no `VERCEL_TOKEN`, deploy hook, or storage credential.
- Candidate cadence: hourly at minute 17 (`17 * * * *`, UTC), away from the start-of-hour load peak documented by GitHub.
- Pipeline:
  1. Checkout the latest production branch with full ability to push that branch.
  2. Install exact locked dependencies with `npm ci`.
  3. Run the single update command. It reads the current canonical `data.json`, collects sources with bounded retry/timeouts, validates, computes metrics/alerts/history, and writes candidate outputs only after global validation.
  4. Run unit/schema/report consistency tests and the production static build.
  5. Commit only the intended generated `data.json` and `report.md` when validation succeeds and content changed; push normally, never force.
  6. Vercel for GitHub sees the production-branch push, runs the small Vite build, and promotes the successful immutable deployment.
- Concurrency: one workflow-level concurrency group, `cancel-in-progress: false`, a short job timeout, and one pending run maximum. A second schedule cannot write against the same previous state concurrently.
- Failure behavior: any critical collector/schema/generation/build failure exits non-zero before commit. A noncritical source failure can publish retained stale data only under the rules from Research 13. Push conflicts fail rather than force-overwrite human changes and can be retried manually/at the next schedule.
- Advantages:
  - scheduling, durable state, audit trail, generation, and deployment trigger all use the required public repository;
  - no custom secret for data collection or deployment;
  - standard hosted runners are free for public repositories;
  - no Vercel Function/database/object store;
  - local and scheduled commands are identical;
  - hourly 24 deployments/day is below Vercel Hobby's 100/day limit.
- Disadvantages:
  - scheduled workflows can be delayed or, under sufficiently high load, dropped;
  - public-repository schedules disable after 60 days without repository activity;
  - every successful refresh adds a commit and Vercel deployment;
  - a commit pushed with `GITHUB_TOKEN` does not trigger another GitHub Actions `push` workflow, so the update job itself must run all required tests before committing;
  - Vercel deployment success occurs after the update job's commit and is not transactionally acknowledged by GitHub without another integration/check.

## Option B — Vercel Cron invokes a Vercel Function

- Scheduler/runtime: Vercel Cron calls a serverless endpoint.
- Authentication: a `CRON_SECRET` is recommended; durable writes need Blob, Marketplace database/KV, GitHub API credentials, or another service.
- Methodology: function collects data, updates persistent state, and serves or writes outputs.
- Advantages: scheduler and runtime are colocated with hosting; no scheduled commits if paired with Blob.
- Disadvantages:
  - Vercel Cron always invokes a Function, creating the backend the architecture asks us to avoid;
  - Hobby Cron can run only once per day with hourly timing precision, inadequate for current network performance and price alerts;
  - function-local storage is not durable, so another storage dependency/secret remains necessary;
  - block sampling plus multi-provider retries competes with function duration/runtime constraints;
  - updating repository `report.md` still requires GitHub write access or creates two sources of truth.

### Backend necessity test

1. Requirement it would close: scheduled collection.
2. Why static/scheduled cannot close it: it can—GitHub Actions supplies an hourly scheduler and durable repository state.
3. Why the simpler option is worse: it is not; Option A uses fewer services and credentials.
4. Post-deployment maintenance: a Function would require security, secret, runtime-limit, storage, and failure maintenance.

Result: no Vercel backend is justified.

## Option C — Collect at Vercel build time

- Trigger: Git push, deploy hook, or manual deployment starts a build that fetches all sources and writes static outputs into `dist`.
- Authentication: deploy hooks are secret URLs; direct CI deployment requires Vercel project/account tokens.
- Advantages: final files are naturally part of the deployment; failed builds do not replace production.
- Disadvantages: a build is not a scheduler; build filesystem state does not persist to the next build; own history and last-known-good values need another store or circularly fetching the live site; repository `data.json`/`report.md` samples would not auto-update. A deploy hook plus external scheduler is more moving parts than Option A.

## Option D — GitHub Actions deploys directly with Vercel CLI

- Scheduler: GitHub Actions.
- Deployment: generate/build in Actions, then `vercel deploy --prebuilt --prod`.
- Authentication: requires stored `VERCEL_TOKEN`, project ID, and organization/account ID or OIDC-compatible setup.
- Advantages: one job can know the CLI deployment result; repository need not trigger a second build.
- Disadvantages: adds Vercel credentials and CLI coupling; durable own history still needs commits or another store; a failed deployment after uncommitted state complicates the next run. Git integration already deploys every production-branch push and is simpler.

## Option E — External scheduler or repository dispatch service

- Candidates: cron-job.org, cloud scheduler, personal server cron, or another automation platform calling a deploy hook/API.
- Advantages: potentially more precise scheduling and independent retries.
- Disadvantages: another account/service, secret URL/token, ownership and availability concerns, and no inherent durable state. It is unnecessary while the required public GitHub repository offers a scheduler.

## Recommended candidate

Option A: one hourly GitHub Actions workflow that performs the complete update/test/generate operation, commits both generated outputs, and relies on Vercel's standard Git integration for static production deployment.

Operational constants:

```text
schedule:          17 * * * * (UTC)
manual trigger:    workflow_dispatch
concurrency:       one update group, do not cancel the active writer
job timeout:       15 minutes
deployment budget: normally 24/day (< Hobby 100/day)
writer:            built-in GITHUB_TOKEN, contents: write
runtime backend:   none
database/blob:     none
```

The workflow should pin third-party Actions to immutable major/version references chosen during implementation, use the repository lockfile, and expose a concise step summary. Existing GitHub/Vercel run logs are sufficient; no monitoring infrastructure is added.

## Dependencies

- Bounded repository state model from Research 10.
- Critical/partial-failure rules from Research 13.
- One deterministic local command for collection/generation and one for full verification.
- A public GitHub repository with Actions enabled and workflow write permission.
- One-time Vercel Git project connection, production branch selection, Vite preset/output, and public URL.

## Produced data

`scheduled pipeline`, `static deployment`, `status`, `logs`

## Update characteristics

- Normal cadence: hourly; provider-daily metrics deduplicate by their source date while current network/price metrics update each run.
- Expected job duration: dominated by the sampled median-fee block RPC calls (normally tens of seconds), comfortably below a 15-minute job timeout.
- Expected deployments: at most 24 scheduled deployments/day, plus explicit manual/code deployments, below Vercel Hobby's 100/day limit.
- No artifacts/cache are required for correctness. Dependency caching may be used only as an optimization.
- A delayed/dropped GitHub schedule leaves the previous static deployment correct but older; the visible freshness timestamps expose this.

## Risks / Open Questions

- Vercel auto-deploy must remain enabled for the production branch. Project setup is a documented one-time deployment step, not hidden runtime infrastructure.
- Repository branch protection may reject direct bot pushes. The submission repository must grant the workflow narrowly scoped contents write access or exempt this workflow; hourly automated PRs are not a reasonable alternative.
- Human and scheduled changes can race. Normal push failure is safer than rebasing/force-pushing automatically; a retry starts from the newest branch.
- GitHub states schedules may be delayed/dropped at high load and disables inactive public schedules after 60 days. Minute 17 reduces peak risk; `workflow_dispatch` is the recovery path.
- A `GITHUB_TOKEN` push does not recursively trigger GitHub workflows, but Vercel's GitHub app receives branch pushes independently. All prepublication tests therefore live in the updater workflow itself.
- The workflow can prove the local production build, not synchronously guarantee Vercel promotion without adding token/API coupling. A failed Vercel build keeps the previous production deployment; platform build logs and the visible old timestamp are adequate for the bounty's minimal reliability requirement.
- Hourly commits create Git history. If measured growth becomes excessive, reduce cadence/fields before adding services; do not silently introduce Blob or a backend.

## Sources

- GitHub scheduled workflow semantics and limitations: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule
- GitHub Actions concurrency: https://docs.github.com/en/actions/reference/workflow-syntax-for-github-actions#concurrency
- GitHub `GITHUB_TOKEN` behavior: https://docs.github.com/en/actions/concepts/security/github_token#when-github_token-triggers-workflow-runs
- GitHub automatic token authentication: https://docs.github.com/en/actions/tutorials/authenticate-with-github_token
- GitHub Actions billing (public standard runners free): https://docs.github.com/en/billing/concepts/product-billing/github-actions
- Vercel Git deployments: https://vercel.com/docs/git
- Vercel for GitHub: https://vercel.com/docs/git/vercel-for-github
- Vercel deployment limits: https://vercel.com/docs/limits
- Vercel Cron usage/limits: https://vercel.com/docs/cron-jobs/usage-and-pricing
- Vercel Cron management/security: https://vercel.com/docs/cron-jobs/manage-cron-jobs
- Vercel deployment methods: https://vercel.com/docs/deployments/overview
- Vercel CLI deployment: https://vercel.com/docs/cli/deploy
