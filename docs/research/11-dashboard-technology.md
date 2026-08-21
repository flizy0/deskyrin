# Research 11 — Dashboard Technology

Status: complete (local candidate only; no global architecture decision)  
Researched: 2026-08-20

## Requirement

Choose the minimum frontend stack for one dark, interactive, static Vercel dashboard containing:

- Network Performance;
- Validator Status;
- Economic Indicators;
- Ecosystem Growth;
- Ecosystem and Community News;
- Upcoming Upgrades / Developments;
- Alerts / Notable Changes;
- last-updated and per-metric freshness information.

Temporal data needs interactive charts with hover/touch tooltips. Approximately 700 validator rows need a readable table. No wallet, authentication, settings, admin surface, extra analytics, complex animation, or custom design system is permitted.

## Meaning

The researched data shape is modest:

- roughly eight to ten bounded time-series charts, generally 90 daily points or at most 720 hourly points;
- scalar metric cards and deterministic status/alert callouts;
- one current validator table of roughly 700 rows and a top-by-stake view;
- one small stake distribution;
- fewer than ten news items and fewer than a dozen upgrade cards;
- one static `data.json`, expected below 1 MB and hard-limited to 2 MB.

The browser does not need routing, server rendering, a global state library, streaming, authentication, or an application backend. “Interactive” is satisfied by genuine data-point hover/touch tooltips and readable table sorting; it does not justify product controls beyond the bounty.

## Option A — Vanilla HTML/CSS/JavaScript with Chart.js, bundled by Vite

- Frontend: semantic HTML, one project stylesheet, small ES modules, no UI framework.
- Charting: Chart.js imported from a pinned npm dependency and bundled locally; no runtime CDN.
- Build: Vite's vanilla mode produces static assets in `dist` for Vercel.
- Data access: one same-origin `fetch('/data.json')`; all upstream calls happen in the scheduled collector, never the browser.
- Methodology:
  - reusable view functions render status cards, source timestamps, news/upgrades, and tables;
  - one chart factory applies dark colors, consistent number/date formatters, `interaction.mode: 'index'`, `intersect: false`, hover/touch events, and tooltips;
  - animations are disabled globally;
  - time axes use prepared ISO labels/category points, avoiding an extra date-adapter dependency;
  - current scalar values remain visible outside canvas charts;
  - validator rows are rendered into a native table inside an overflow container with sticky headers, tab-focusable sortable column buttons, deterministic initial stake-descending order, and status text plus color;
  - an inline SVG/CSS bar is sufficient for the small top-stake distribution rather than another visualization library.
- Advantages: no framework runtime; one chart dependency; good canvas performance for the researched point counts; built-in responsive charts, tooltips, mouse/touch interactions, line/bar/doughnut support; direct Vercel static deployment; small conceptual surface.
- Disadvantages: manual DOM rendering and cleanup; Chart.js canvas needs explicit accessibility alternatives; Vite is a build dependency even though the app is simple.

## Option B — Pure vanilla HTML/CSS/JavaScript with native SVG/canvas charts

- Frontend/build: static files can be served directly with no build step.
- Charting: custom SVG paths/axes/points and custom HTML tooltips, or a hand-written canvas renderer.
- Advantages: zero runtime dependencies, maximum control, potentially very small output.
- Disadvantages: scales, tick selection, responsive resizing, hit testing, touch interaction, tooltip positioning, gaps/stale points, dual datasets, and accessibility all become project code. Implementing and testing these correctly across eight-plus charts is more code and risk than one maintained chart library.

## Option C — React + Vite with Chart.js or a React chart wrapper

- Frontend: React components/hooks and optionally `react-chartjs-2`.
- Build: Vite static bundle.
- Advantages: declarative rendering, component lifecycle, convenient state for sorting/ranges, familiar ecosystem.
- Disadvantages: React and a wrapper add runtime/dependency surface without a complex state graph. The dashboard renders one snapshot once and has no multi-page workflow. A wrapper adds another compatibility layer while Chart.js can be used directly.

## Option D — Next.js static export

- Frontend/build: Next.js with `output: 'export'`, usually React.
- Advantages: file routing, component conventions, Vercel-native recognition, and future ability to add server capabilities.
- Disadvantages: the project needs one page and explicitly avoids backend features. Static export excludes API routes, server-side props, ISR, and other runtime features; Next/React add build time, output, dependency upgrades, and accidental server temptation without closing a requirement.

## Option E — Larger chart/dashboard libraries

- Candidates: Apache ECharts, Plotly, D3, or a component/dashboard suite.
- Advantages: rich interactions, specialized visualizations, large ecosystems.
- Disadvantages: Plotly/ECharts bundles are much larger than needed; D3 is low-level and would still require custom chart composition; dashboard suites introduce styling and product controls. The data requires conventional line/bar charts and a table only.

## Recommended candidate

Option A: vanilla HTML/CSS/JavaScript, Vite, and Chart.js as the only runtime frontend library. Pin exact dependency versions and commit the lockfile. Do not load code, fonts, icons, or chart assets from a CDN.

The dashboard remains a static document:

```text
index.html + bundled CSS/JS
             ↓ one same-origin request
          /data.json
```

No framework, router, backend endpoint, SSR, ISR, database client, or client-side upstream fetch is justified.

Minimum interaction and readability contract:

- pointer and touch tooltips on every temporal chart;
- keyboard-focusable chart region with a descriptive label and visible current value;
- no animation, with `prefers-reduced-motion` respected by CSS;
- chart gaps remain gaps for unavailable observations rather than becoming zero;
- visible metric/source timestamps and stale/unavailable badges;
- native table semantics, sticky headers, horizontal containment on narrow screens, and sortable Stake / Commission / Status / Rank columns;
- all ~700 validator rows may be in one bounded scroll region because the DOM/data volume is small; no pagination service or virtualization dependency;
- mobile layout stacks cards and charts without hiding required fields;
- status is never communicated by color alone.

## Dependencies

- Final canonical schema from Phase 3.
- One generated static `data.json` from Research 10.
- Vite and Chart.js pinned in the shared package manifest/lockfile.
- Unit tests for formatters/data adapters and browser end-to-end checks for tooltips/table behavior.
- Vercel configured with the Vite preset or explicit `npm run build` and `dist` output.

## Produced data

`static HTML`, `static CSS`, `static JavaScript`, `interactive charts`, `table`, `status`

## Update characteristics

- The dashboard bundle changes only when code/design changes.
- Every successful data commit triggers a small static rebuild/deployment; no runtime computation is needed on Vercel.
- Browser cost: one bounded JSON request and local rendering. Chart datasets are at most hundreds, not millions, of points.
- Chart instances are created once after validation and destroyed/replaced only if a reload path is deliberately invoked; no polling is required because each deployment embeds the latest static snapshot URL.

## Risks / Open Questions

- Canvas chart pixels are not inherently accessible. Every chart needs an `aria-label`, adjacent current value, units, and link/reference to the machine-readable/report data; tooltips alone are insufficient.
- Chart.js defaults must be overridden for dark contrast, locale-neutral UTC dates, units, and zero-suppression behavior.
- A category axis is sufficient for regular daily/hourly points, but missing intervals must retain explicit labels/gaps so spacing is not misleading. If exact irregular spacing becomes material during implementation tests, use Chart.js's linear numeric timestamp axis without adding a date adapter.
- Rendering 700 rows is feasible, but long public keys require monospace truncation with the complete value available via copy/select/title; never remove the canonical key.
- A generated snapshot with an unknown schema version must show a clear fatal data error instead of partially rendering mismatched fields.
- External links from news/upgrades must be safely rendered with fixed attributes; source HTML is never injected.

## Sources

- Chart.js interaction configuration: https://www.chartjs.org/docs/latest/configuration/interactions.html
- Chart.js tooltip configuration: https://www.chartjs.org/docs/latest/configuration/tooltip.html
- Chart.js accessibility notes: https://www.chartjs.org/docs/latest/general/accessibility.html
- Vite on Vercel: https://vercel.com/docs/frameworks/frontend/vite
- Vercel build configuration: https://vercel.com/docs/builds/configure-a-build
- Vercel static files: https://vercel.com/docs/build-output-api/primitives
- Next.js static exports and unsupported runtime features: https://nextjs.org/docs/pages/guides/static-exports
