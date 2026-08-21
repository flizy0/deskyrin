# Phase 4 — Architecture Stress Test

Status: complete; architecture accepted with corrections below  
Tested: 2026-08-20  
Target: Phase 3 Global Architecture v1

## Purpose

This phase attempts to invalidate the architecture before any production code exists. A scenario passes only if the design has a deterministic behavior that preserves truthful output without adding an unjustified service.

## Required break tests

### 1. What if Solana RPC is unavailable?

**Failure path:** light batch, vote accounts, and fee sampling can fail together because they share an endpoint.

**Behavior:** each previously valid atomic domain is retained with original `observedAt` and marked stale. Network/validator/fee alert checks whose evidence is not fresh become unavailable. Other providers can still refresh and a partial snapshot can publish. On bootstrap, any required RPC domain without last-known-good state makes the run critical and no production snapshot is published.

**Result:** pass. Shared client does not mean shared replacement transaction.

### 2. What if the public RPC rate-limits block calls?

**Failure path:** median-fee collection is much heavier than the three light calls.

**Behavior:** block calls remain batches of at most eight, honor `Retry-After`, and have a separate deadline/domain. All 16 selected blocks are required; otherwise only the fee metric is stale. The updater never responds by exhaustive retries or by reducing the sample silently.

**Result:** pass. The expensive path cannot poison cheap metrics.

### 3. What if a JSON-RPC batch response is partial or reordered?

**Failure path:** HTTP is 200 but one item is missing/errored, and result order differs from request order.

**Behavior:** map by unique JSON-RPC ID, reject missing/duplicate/unknown IDs, and normalize successful independent domains only. Never map by array index.

**Result:** pass.

### 4. What if DefiLlama changes a response shape?

**Failure path:** JSON parses but field names/units/history order change.

**Behavior:** endpoint-specific runtime schema and semantic assertions fail without retrying a contract error. Only that DefiLlama atomic domain retains LKG stale. No protocol sum or zero is substituted.

**Result:** pass.

### 5. What if one DefiLlama endpoint fails while others work?

**Failure path:** same provider family creates temptation to mark the whole economics section unavailable.

**Behavior:** price, TVL, stablecoins, and DEX are distinct source/domain IDs. Each replaces independently. Only price has the researched CoinGecko fallback, which must replace the complete price domain rather than splice one field/series.

**Result:** pass.

### 6. What if provider daily history is revised?

**Failure path:** a 90-day series differs from yesterday even for old dates.

**Behavior:** provider-supplied histories are replaced from the newest validated provider response; the repository does not claim immutability for provider history. Project-owned histories append only new observations and are not rewritten except deterministic trim/deduplication.

**Result:** pass. README must state that provider backfills can revise charts.

### 7. What if the latest DEX or daily point is the current partial UTC day?

**Failure path:** a partial value appears as a dramatic collapse and triggers a false change.

**Behavior:** daily adapters exclude the current UTC date and require completed/adjacent dates for daily alerts. DEX headline uses the last strictly completed point.

**Result:** pass.

### 8. What if Solana Data supplies one fee/active-address provider but not the other?

**Failure path:** calculating a “median” from one provider silently changes methodology.

**Behavior:** both Allium and Dune are required for each consensus date. `Fees` and `Fee Payers` normalize independently, but each needs both selected providers. One missing fee provider prevents REV refresh; one missing fee-payer provider prevents active-address refresh.

**Result:** pass. Minimum consensus membership is a versioned contract.

### 9. What if Jito and Solana fee dates do not overlap at the newest day?

**Failure path:** adding values from different UTC dates creates fake REV.

**Behavior:** inner-join completed daily dates and select the newest common date. If the common date exceeds the three-day freshness budget, retain joined REV stale. Fees alone are never relabelled REV.

**Result:** pass.

### 10. What if RWA.xyz changes its Next.js page contract?

**Failure path:** the Solana network page no longer embeds the expected typed dataset.

**Correction:** parse only the `__NEXT_DATA__` embedded in the same canonical HTML response, validate the build ID and Solana taxonomy, and never store or fetch a hard-coded build-specific URL. If the embedded contract disappears, fail this atomic domain and preserve LKG; a second build-specific request would add a race without improving semantic coverage.

**Result:** pass with the documented public-page-contract limitation.

### 11. What if RWA taxonomy changes or `Stocks` disappears?

**Failure path:** a positional parser selects the wrong class or total.

**Behavior:** assert network/measure/category semantic labels and units. Missing/renamed `Stocks` fails the tokenized domain and preserves LKG; xStocks DEX volume is not equivalent and is not substituted.

**Result:** pass.

### 12. What if the upgrade hub introduces a new status?

**Failure path:** unknown status might be incorrectly considered upcoming or live.

**Behavior:** recognized deployment-stage allowlist only. Unknown stage fails the whole curated-upgrades domain, preserving LKG. This forces a reviewed adapter update.

**Result:** pass.

### 13. What if Alpenglow or SIMD-0525 disappears because it becomes live?

**Failure path:** a hard assertion could freeze upgrades forever even though reality changed.

**Correction:** bootstrap/current fixtures assert Alpenglow and Reduced Slot Times/SIMD-0525 while their official status is non-live. The collector keys inclusion on official status. A source transition to live is accepted only when the detail page/hub consistently reports it and a reviewed fixture updates the listing-example assertion; it is not silently removed by a missing card. The product remains “upcoming,” not a permanent hand-written list.

**Result:** pass with deliberate status-transition review.

### 14. What if RSS contains markup, a hostile URL, or one malformed item?

**Failure path:** injection or whole-feed loss.

**Behavior:** text extraction/sanitization, HTTPS hostname allowlist, length limits, unique IDs, and strict dates. Individual invalid items can be discarded only if the minimum valid count remains; otherwise LKG feed is stale. Browser never inserts source strings through `innerHTML`.

**Result:** pass.

### 15. What if historical data grows indefinitely?

**Failure path:** static JSON/browser/Git becomes a database by accident.

**Behavior:** 720 hourly points for network/validator/fee, 90 daily provider points, 365 daily RWA points, eight news items, current upgrades only, current validator table only. Global 2 MB minified JSON ceiling stops publication.

**Result:** pass.

### 16. What if the validator response contains thousands of unstaked delinquent accounts?

**Failure path:** counts/table and output size explode.

**Behavior:** use the RPC's default unstaked exclusion and independently enforce `activatedStake > 0` on both partitions. The full table therefore represents economically participating vote accounts only.

**Result:** pass.

### 17. What if a provider returns plausible-looking zero/empty data?

**Failure path:** schema-only validation accepts a destructive empty replacement.

**Correction:** require nonempty/positive populations where Solana mainnet semantics demand them, relational invariants, expected semantic identifiers, newest-date freshness, and bounded change checks against the prior valid domain for large structural arrays. A dramatic but possible economic change is not rejected merely for magnitude; an empty mainnet validator/price/supply dataset is.

**Result:** pass after semantic minimums are included in implementation contracts.

### 18. What if one metric fails and all others succeed?

**Failure path:** all-or-nothing freezes valid data, while best-effort defaults corrupt it.

**Behavior:** publish a `partial` snapshot only when the failed atomic domain has valid LKG; show stale status in JSON/report/dashboard. If it has no LKG, stop critically.

**Result:** pass.

### 19. What if an alert input becomes stale?

**Failure path:** retaining an old active alert implies it is still happening; dropping it silently implies all clear.

**Behavior:** recompute no active alert from stale evidence, set the fixed alert check to `unavailable`, and display that unavailable check explicitly. `alerts` alone is never the health summary.

**Result:** pass.

### 20. What if high delinquency crosses 5% for one run only?

**Failure path:** transient RPC partition triggers noise.

**Correction:** require two consecutive fresh validator history points no more than 2.5 hours apart and both at/above 5%. A stale or overly old prior point does not confirm. Count share remains evidence only.

**Result:** pass after explicit maximum gap.

### 21. What if scheduled history has not bootstrapped?

**Failure path:** high-delinquency confirmation lacks a prior point; charts are sparse.

**Behavior:** current metrics publish; delinquency check is `normal` if below threshold and `unavailable/pending confirmation` if current is above threshold without an eligible prior point. TPS/slot alerts bootstrap from RPC's own recent sample history. Charts honestly start with available points.

**Result:** pass.

### 22. What if two schedulers run simultaneously?

**Failure path:** both read the same snapshot, append conflicting points, and push.

**Behavior:** GitHub workflow concurrency permits one active writer and at most one pending run. Normal Git push rejects a race; no force push. History deduplicates by canonical observation timestamp.

**Result:** pass.

### 23. What if a human pushes while the updater runs?

**Failure path:** bot overwrites code or generated changes.

**Behavior:** updater stages exactly the two generated files, verifies staged paths, and pushes normally. A non-fast-forward push fails and publishes nothing. Next/manual run begins from the newest branch. It never auto-resolves or force-pushes.

**Result:** pass.

### 24. What if GitHub Actions skips/delays the schedule?

**Failure path:** no update commit occurs.

**Behavior:** previous static deployment remains valid and its last-updated/metric ages expose the delay. Minute 17 avoids the documented peak. Manual dispatch uses the exact pipeline. No second scheduler is introduced.

**Result:** pass with accepted platform limitation.

### 25. What if Vercel redeploy does not start or fails?

**Failure path:** repository snapshot is newer than production.

**Behavior:** previous immutable deployment remains on the production domain; visitors see its older `updatedAt`. Local production build already passed before commit. Vercel/GitHub deployment checks/logs provide existing evidence; manual redeploy/retry is documented.

**Result:** pass. Cross-platform atomic promotion would require extra credentials/backend and is not justified.

### 26. What if a deployment is built with empty data?

**Failure path:** static page deploys but all sections are blank.

**Behavior:** production build imports/reads the formal canonical schema fixture and fails on missing required domains, unknown schema, empty bootstrap, invalid status, or output/report mismatch. The updater never commits before this check.

**Result:** pass.

### 27. What if `data.json` is browser-cached across a new deployment?

**Failure path:** HTML bundle updates but browser retains old path response.

**Correction:** configure static response headers for `/data.json` and `/report.md` with revalidation (`max-age=0, must-revalidate`) and fetch data with normal revalidation rather than a permanent cache mode. Vercel deployment URLs remain immutable, but the production alias can change.

**Result:** pass after header requirement.

### 28. What if an endpoint disappears permanently?

**Failure path:** LKG ages indefinitely.

**Behavior:** value stays visibly stale with original observation and growing age; alert evaluation is unavailable. Adapter repair/replacement requires a researched semantically equivalent source. Partial sums and mandatory paid/keyed providers are not accepted automatically.

**Result:** pass as an honest degraded mode; no architecture can manufacture fresh equivalent data.

### 29. What if history methodology changes under schema v1?

**Failure path:** old/new points become incomparable.

**Correction:** methodology constants participate in `methodologyVersion`. A semantic change requires a deliberate migration that either transforms or clears only incompatible histories; a version mismatch without migration is a critical stop. Threshold-only changes also bump methodology version even when metric history remains compatible.

**Result:** pass after explicit migration rule.

### 30. What if source polling is intentionally skipped as not due?

**Failure path:** Research 13's simple “fresh only if fetched this run” rule would mark healthy daily data stale every hour.

**Correction:** architecture-level status semantics are authoritative: a not-due domain remains `fresh` while its valid observation/last-success is within its source-specific freshness budget. Source metadata exposes `lastAttemptAt`, `lastSuccessAt`, and `nextDueAt`. Once outside budget, it becomes stale even if no request has yet failed.

**Result:** pass after clarification.

### 31. What if the static validator table is slow on mobile?

**Failure path:** ~700 rows plus charts degrade rendering.

**Behavior:** rows contain only required fields, charts contain bounded points, animations are disabled, and the table is one native DOM fragment in a contained scroll area. End-to-end tests measure usability. If measured performance fails, simple client-side paging is allowed as table presentation—not a backend feature—before considering virtualization dependency.

**Result:** provisionally pass; implementation benchmark required.

### 32. Can a dependency be removed?

Evaluated:

- Solana SDK: removed; raw JSON-RPC is sufficient.
- React/Next/router/state library: removed.
- Date adapter: removed; prepared UTC labels/numeric times suffice.
- Runtime schema validator: retained because unversioned public contracts and LKG safety require it.
- HTML parser: retained for two required public-page sources; regex is less reliable.
- XML parser: retained for required RSS; hand parsing is not justified.
- Chart.js: retained for eight-plus tooltip charts; custom hit-testing/scales would be more code.
- Vite: retained to bundle Chart.js/modules and produce a verified static artifact.

**Result:** pass; dependency set is minimal for the chosen contracts.

### 33. Can a provider be removed?

- Jito cannot be removed without turning REV into ordinary fees.
- RWA.xyz cannot be removed without losing broad tokenized assets/equity transfer volume.
- Solana Foundation cannot be removed without keyed/less authoritative replacements for active addresses/fees/news/upgrades.
- DefiLlama cannot be removed without replacing four aggregate histories with several providers/indexers.
- Solana RPC cannot be removed without violating the on-chain-source preference.
- CoinGecko is optional fallback and never a healthy-run dependency; keeping it improves only price continuity.

**Result:** five primary provider families are the irreducible researched set.

### 34. Can storage be removed?

External storage is already absent. Removing repository state would lose own history and LKG behavior. Splitting it into DB/Blob/JSONL is strictly more complex.

**Result:** one canonical JSON is minimal.

### 35. Does anything truly require a backend?

No. Scheduling is CI, state is the required static JSON, presentation is static, and alerts are derived at update time. A backend closes no remaining requirement.

**Result:** zero-backend decision confirmed.

## Corrections incorporated into the implementation contract

1. RWA resolution prefers same-page embedded data, retries page resolution once on build mismatch, and never hard-codes build ID.
2. Upgrade example assertions permit only reviewed source-backed transitions to live.
3. Semantic minimums supplement shape validation for empty/plausible garbage.
4. Delinquency confirmation requires two fresh points no more than 2.5 hours apart.
5. `/data.json` and `/report.md` require revalidation headers.
6. Methodology version changes require explicit history compatibility/migration behavior.
7. Not-due daily domains remain fresh only inside explicit freshness budgets.
8. Production build must reject empty/unknown canonical data.
9. RPC/provider JSON is parsed losslessly so unsafe integer tokens become `BigInt` before normalization; ordinary `JSON.parse` is forbidden for on-chain `u64` responses.

## Stress-test conclusion

The corrected architecture closes every frozen requirement without a backend, database, paid API, or mandatory data key. Its unresolved risks are external availability and GitHub→Vercel asynchronous promotion; both degrade visibly to older static data and do not justify additional infrastructure.

The architecture is accepted for Phase 5 implementation planning. No production code was written during Phases 0–4.
