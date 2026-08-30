# Requirement Verification Matrix

Generated artifact checked: `public/data.json` / `public/report.md`  
Automated commands: `npm test`, `npm run validate`, `npm run build`, `npm run verify`

| Requirement | Implementation | Source/data | Dashboard/report evidence | Verification |
|---|---|---|---|---|
| Automatic current data | Single `src/pipeline/update.js` entry point | Public RPC and keyless HTTPS sources | Exact update/source timestamps | Live full pipeline + output contract |
| TPS / slot time / block height / epoch | Solana core collector + network metrics | RPC performance samples and epoch info | Network cards and interactive charts | Unit calculations + live snapshot |
| Validator status | Validator metric module | RPC vote accounts, exact stake strings, bounded commission-change log | Counts, top-stake chart, sortable full table, current commission/status, recent commission changes | Count/stake/order/commission invariants |
| SOL movement | DefiLlama primary, CoinGecko fallback | Current, historical reference, chart | Price card/chart and alert evidence | Provider + canonical schemas |
| Stablecoin supply | Completed-day peg-map aggregation | DefiLlama stablecoin chart | Card/chart/report | Completed-day and positive-history checks |
| DEX volume | Completed direct-DEX buckets | DefiLlama dimensions | Card/chart/report | Provider schema and bounded history |
| REV | Same-date fees/tips join | Solana Data Allium+Dune + Jito | Total/components/chart/report | Pure metric test + sum invariant |
| Median transaction fee | 16-block stratified sample | Finalized RPC blocks | Card/chart/sample provenance/report | Complete-sample enforcement + tests |
| Tokenized assets/equities | Provenance-filtered 30d spot-volume sum, disjoint category snapshot, and top covered assets | Tokens.xyz curated RWA/stocks/ETF/metals lists | Snapshot cards/category breakdown/top-assets table; timeline after 8 genuine observations; retired RWA evidence report-only | Coverage/provenance, category reconciliation, ranking, and subset invariants |
| Daily active addresses | Two-provider median | Solana Data Fee Payers | Card/chart/report | Pure metric test |
| News / upgrades | Official RSS and upgrades pages | Solana Foundation content | Bounded lists; SIMD links | Non-empty contracts; 0326/0525 assertions |
| Required alerts | Five fixed checks | Underlying fresh metrics | Active warnings and all check states | Pure alert tests + fixed-order canonical invariant |
| JSON / Markdown | Canonical serializer and pure report renderer | Validated snapshot only | `/data.json`, `/report.md` | `npm run validate` |
| Interactive static terminal | Vite + Chart.js; hash routing, native dialog, and pointer controls | One fetch of `/data.json` | Route-lazy hover/keyboard-accessible charts, expanded temporal explorers, canonical visible-point tables, and contained sortable tables | Range unit tests; desktop/mobile route Playwright suite; production build |
| Auto-update / deployment | Hourly GitHub Action; configurable 1h/6h source checks; Vercel Git deploy | Committed static artifacts | New deployment reads updated files | Workflow/schema/static-only checks |
| Necessary error handling | Retry, deadlines, response limits, LKG, atomic publish | Per-source status | Stale/unavailable UI/report labels | Reliability unit tests |
| README/methodology | Repository documentation | Source links and limitations | Public repository | `npm run verify` required-file check |

No implementation exists for wallet connection, authentication, user accounts, database servers, persistent backend, AI analysis, predictions, outbound notifications, portfolio/NFT/memecoin analytics, or any metric outside the frozen listing scope.
