# Frozen Master Scope

Status: frozen after verification against the complete Superteam Earn listing  
Verified: 2026-08-20  
Listing: https://superteam.fun/earn/listing/develop-solana-ecosystem-auto-updating-report-and-interactive-dashboard  
Listing ID: `676a10c9-d5c7-49ce-9877-a91c647c0e8b`  
Submission deadline: 2026-09-01T03:59:59Z  
Winner announcement: 2026-09-15T03:59:59.999Z  
Eligibility: Canada regional listing

## Scope rule

The listing says the report should be comprehensive and uses “including but not limited to”. For this project, that phrase is bounded by the user's explicit instruction not to invent additional product metrics. The implementation will cover every item explicitly named in the listing, plus only the values strictly required to calculate or explain those items.

No production implementation starts until Research 1–13, synthesis, global architecture, architecture stress testing, and implementation planning are complete.

## Required data collection behavior

- Fetch current data automatically at a configurable interval.
- Prefer Solana RPC for facts directly available from the network.
- Use public, documented, machine-readable sources where RPC is insufficient.
- Require no paid data service and no mandatory third-party API key.
- Record the observation/source time and pipeline update time.
- Keep the system low-maintenance.
- Validate fetched data and never publish fabricated replacement values after a source failure.

The listing identifies these source families as desirable: Dune dashboards, Solana ecosystem reports/websites, relevant social accounts, Solana JSON-RPC, DeFiLlama, and CoinGecko. These are candidate sources, not a requirement to integrate every family. Source selection remains open until research synthesis.

## Required subject matter

### Network performance

- TPS.
- Slot time.
- Block height.
- Epoch progress.

### Validator status

- Active validator count.
- Delinquent validator count.
- Stake distribution.
- Top validators by stake.
- Validator commission and commission tracking.
- Per-validator active/delinquent status.
- Delinquency alerting.

### Ecosystem and community news

- Automatically collected ecosystem/community news.
- Deterministic presentation of source metadata and excerpts/titles; no AI-generated analysis or summaries.

### Economic indicators

- SOL price movement.
- Stablecoin supply.
- DEX volume.
- Real Economic Value (REV), using an accepted REV definition rather than substituting protocol revenue.
- Median transaction fees.

### Ecosystem growth

This is the complete ecosystem-growth metric list in the listing; no extra ecosystem metric may be added without new listing evidence.

- Tokenized asset volumes, with particular attention to tokenized equities.
- Daily active addresses.

### Upcoming upgrades and developments

- Automatically maintained upcoming Solana upgrades/developments.
- The listing names Alpenglow and SIMD-525 as examples, not as the permanent exhaustive set.
- Present source-backed facts and status only; do not generate AI analysis.

## Anomaly detection and notable changes

Anomaly detection is optional in the listing but explicitly described as highly valued. It is therefore included, limited to the anomaly classes named by the listing:

- Significant TPS drops or spikes.
- Slow slot times.
- High validator delinquency.
- Large TVL changes.
- Large SOL price moves.

Alerts exist only in generated data, the Markdown report, and the dashboard. There are no Telegram, Discord, email, mobile, browser-push, or webhook notifications.

Thresholds and comparison windows are unresolved until Research 9. Every threshold must be documented and deterministic.

TVL is an alert input explicitly named by the listing, but it is not frozen as an additional standalone key metric. Whether a supporting TVL series is visible outside the alert explanation will be decided only if transparency requires it.

## Required outputs

### Interactive HTML dashboard

One hosted dashboard must expose:

- Network Performance.
- Validator Status.
- Ecosystem and Community News.
- Economic Indicators.
- Ecosystem Growth.
- Upcoming Upgrades/Developments.
- Alerts / Notable Changes.
- Last-updated and freshness information.

Minimum interaction:

- Interactive charts for temporal data.
- Hover/tooltips.
- Readable, scrollable validator and other data tables.
- Dark theme, because it is the listing's preferred presentation.

### Human-readable Markdown

Generate `report.md` automatically from the same canonical snapshot as the dashboard and JSON. It must contain the update time and all required subject sections. It must not contain AI-generated analysis.

### Machine-readable JSON

Generate `data.json` automatically. The final schema is intentionally deferred until all data requirements and actual provider response shapes have been researched.

### Submission artifacts

- Public GitHub repository containing original work and all source code.
- Setup and interpretation instructions.
- Clear `README.md`.
- Sample generated Markdown and JSON reports.
- Data-source and integration methodology.
- Automation strategy.
- Anomaly methodology.
- Local run instructions.
- Hosted/live dashboard, because the listing gives it higher consideration.

## Automation and deployment constraints

- One unattended update pipeline fetches, validates, calculates, preserves required history, and regenerates JSON and Markdown.
- The static dashboard consumes generated data automatically.
- Target deployment is Vercel.
- Architecture is static-first: scheduled collection → prepared static artifacts → static dashboard → Vercel.
- No continuously running backend.
- No database or serverless component unless later research proves it is necessary for a frozen requirement and documents why a simpler scheduled/static option cannot satisfy it.

## Minimum reliability contract

- Check HTTP and RPC success and validate response shapes/ranges.
- Use bounded timeouts and retries appropriate to each source.
- Mark unavailable or stale observations explicitly.
- Preserve last-known-good noncritical values instead of overwriting them with `0`, `null`, or malformed data.
- Publish generated artifacts atomically.
- Stop the update before publication on a critical failure or invalid canonical snapshot.
- Expose timestamps and provenance without adding a separate monitoring stack.

## README contract

The README must explain:

- What the project does.
- Every metric and content section it presents.
- Data sources.
- Methodology and units/windows.
- Local setup and execution.
- Automatic update behavior.
- Live dashboard URL.
- Known limitations.

## Judging preferences to optimize for

- Comprehensiveness and detail across the explicitly frozen scope.
- Automation and maintainability with minimal intervention.
- Clear, actionable presentation in HTML, Markdown, and JSON.
- Useful deterministic anomaly detection and multi-source correlation, without adding unrelated features.
- Code quality, documentation, and ease of setup.
- Original work.
- No mandatory API keys and minimal dependencies.

## Explicit non-goals

- Wallet connection, signing, or wallet analytics.
- Authentication, accounts, admin panels, or user preferences.
- PostgreSQL, Supabase, Redis, or an unjustified database.
- A persistent backend or custom on-chain program.
- Smart contracts.
- AI insights, AI summaries, or predictions.
- External alert delivery.
- Mobile applications.
- Complex animation or a custom design system.
- NFT, memecoin, or portfolio analytics.
- Any metric or feature not traceable to the frozen listing.

## Frozen ambiguities requiring research

No choice below is silently assumed during Phase 0:

1. Whether TPS includes vote transactions, and which sampling interval represents “current”.
2. Whether slot time means recent average block-production interval, slot duration including skipped slots, or another documented measure.
3. Exact meaning of an active validator and the stake basis used in distributions.
4. Whether commission “tracking” requires retained history or only the current commission table.
5. Time windows for SOL movement, DEX volume, REV, median fees, and alert comparisons.
6. Stablecoin asset/issuer coverage and whether bridged representations are included.
7. Accepted Solana REV methodology, especially base fees, priority fees, MEV, and Jito tips.
8. Exact median transaction-fee population and whether sampling is acceptable.
9. Whether tokenized asset “volume” means outstanding value, transfer/trading volume, or both; tokenized equities must remain identifiable.
10. Definition and deduplication method for daily active addresses.
11. Reliable, no-key sources and deterministic inclusion rules for news and upgrade/development entries.
12. Thresholds and baselines for the five named anomaly classes.
13. Required first-party history versus provider-supplied historical series.
14. Safe configurable refresh frequency within public-source limits.

These ambiguities are inputs to Research 1–13 and will be resolved only during cross-topic synthesis and architecture design.
