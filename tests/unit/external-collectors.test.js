import assert from "node:assert/strict";
import test from "node:test";
import { collectAgaveReleases } from "../../src/pipeline/collectors/agave-releases.js";
import { collectCoinbaseMarket } from "../../src/pipeline/collectors/coinbase-market.js";
import { collectSolanaStatus } from "../../src/pipeline/collectors/solana-status.js";
import { DEFAULT_CONFIG } from "../../src/pipeline/config.js";

const now = new Date("2026-08-29T12:00:00.000Z");
const epoch = (value) => Math.floor(Date.parse(value) / 1_000);
const config = {
  ...DEFAULT_CONFIG,
  endpoints: {
    ...DEFAULT_CONFIG.endpoints,
    coinbaseMarket: "https://api.exchange.coinbase.com/products/SOL-USD/candles",
    solanaStatusSummary: "https://status.solana.com/api/v2/summary.json",
    solanaStatusIncidents: "https://status.solana.com/api/v2/incidents.json",
    agaveReleases: "https://api.github.com/repos/anza-xyz/agave/releases"
  },
  history: { ...DEFAULT_CONFIG.history, dailyPoints: 3 }
};

function context(responder, overrides = {}) {
  return { now, config, http: { request: responder }, ...overrides };
}

test("Coinbase collector retains only sorted completed UTC SOL-USD candles", async () => {
  let requested;
  const result = await collectCoinbaseMarket(context(async (url, options) => {
    requested = { url: new URL(url), options };
    return [
      [epoch("2026-08-29T00:00:00.000Z"), 108, 114, 110, 112, 1_000],
      [epoch("2026-08-27T00:00:00.000Z"), 100, 110, 102, 108, 900],
      [epoch("2026-08-28T00:00:00.000Z"), 106, 112, 108, 110, 950]
    ];
  }));

  assert.equal(requested.url.searchParams.get("granularity"), "86400");
  assert.equal(requested.url.searchParams.get("end"), "2026-08-29T00:00:00.000Z");
  assert.equal(requested.options.sourceId, "coinbaseExchange");
  assert.equal(result.dataThrough, "2026-08-28");
  assert.deepEqual(result.history.map((point) => point.date), ["2026-08-27", "2026-08-28"]);
  assert.equal(result.history[1].closeUsd, 110);
  assert.equal(result.history[1].volumeSol, 950);
});

test("Coinbase collector rejects incoherent OHLC candles", async () => {
  await assert.rejects(collectCoinbaseMarket(context(async () => [
    [epoch("2026-08-27T00:00:00.000Z"), 100, 110, 111, 108, 900],
    [epoch("2026-08-28T00:00:00.000Z"), 106, 112, 108, 110, 950]
  ])), /open must be within the low\/high range/);
});

function statusPage() {
  return {
    id: "solana-status",
    name: "Solana Status",
    url: "https://status.solana.com",
    updated_at: "2026-08-29T11:55:00.000Z"
  };
}

test("Solana Status collector bounds and deterministically sorts components and incidents", async () => {
  const components = Array.from({ length: 55 }, (_, index) => ({
    id: `component-${index}`,
    name: `Component ${String(index).padStart(2, "0")}`,
    status: index === 0 ? "degraded_performance" : "operational",
    updated_at: "2026-08-29T11:50:00.000Z",
    position: 54 - index,
    group: false
  }));
  const incidents = Array.from({ length: 24 }, (_, index) => ({
    id: `incident-${index}`,
    name: `Incident ${index}`,
    status: index === 0 ? "monitoring" : "resolved",
    impact: index === 0 ? "minor" : "none",
    created_at: new Date(Date.parse("2026-08-01T00:00:00.000Z") + index * 86_400_000).toISOString(),
    updated_at: new Date(Date.parse("2026-08-01T01:00:00.000Z") + index * 86_400_000).toISOString(),
    started_at: new Date(Date.parse("2026-08-01T00:30:00.000Z") + index * 86_400_000).toISOString(),
    resolved_at: index === 0 ? null : new Date(Date.parse("2026-08-01T02:00:00.000Z") + index * 86_400_000).toISOString(),
    shortlink: `https://stspg.io/${index}`,
    incident_updates: [{
      id: `update-${index}`,
      status: "resolved",
      body: "Provider-authored incident update",
      created_at: new Date(Date.parse("2026-08-01T00:45:00.000Z") + index * 86_400_000).toISOString(),
      updated_at: new Date(Date.parse("2026-08-01T01:00:00.000Z") + index * 86_400_000).toISOString()
    }]
  }));
  const result = await collectSolanaStatus(context(async (url, options) => {
    assert.equal(options.sourceId, "solanaStatus");
    if (url.endsWith("summary.json")) return { page: statusPage(), status: { indicator: "minor", description: "Degraded performance" }, components };
    if (url.endsWith("incidents.json")) return { page: statusPage(), incidents };
    throw new Error(`Unexpected URL ${url}`);
  }));

  assert.equal(result.status.indicator, "minor");
  assert.equal(result.components.length, 50);
  assert.equal(result.components[0].position, 0);
  assert.equal(result.incidents.length, 20);
  assert.equal(result.incidents[0].id, "incident-23");
  assert.equal(result.dataThrough, now.toISOString());
});

test("Solana Status collector rejects responses for different status pages", async () => {
  await assert.rejects(collectSolanaStatus(context(async (url) => {
    if (url.endsWith("summary.json")) return {
      page: statusPage(), status: { indicator: "none", description: "All Systems Operational" },
      components: [{ id: "rpc", name: "RPC", status: "operational", updated_at: "2026-08-29T11:50:00.000Z", position: 1 }]
    };
    return { page: { ...statusPage(), id: "other-page" }, incidents: [] };
  })), (error) => error.code === "STATUS_PAGE_MISMATCH");
});

function release(index, overrides = {}) {
  const publishedAt = new Date(Date.parse("2026-08-01T00:00:00.000Z") + index * 86_400_000).toISOString();
  return {
    id: 10_000 + index,
    tag_name: `v3.0.${index}`,
    name: index % 2 ? null : `Agave v3.0.${index}`,
    html_url: `https://github.com/anza-xyz/agave/releases/tag/v3.0.${index}`,
    draft: false,
    prerelease: index % 3 === 0,
    created_at: publishedAt,
    published_at: publishedAt,
    body: `Release notes ${index}`,
    ...overrides
  };
}

test("Agave release collector excludes drafts, bounds output, and sorts newest first", async () => {
  const payload = [release(2, { draft: true }), ...Array.from({ length: 23 }, (_, index) => release(index))].reverse();
  const result = await collectAgaveReleases(context(async (url, options) => {
    const parsed = new URL(url);
    assert.equal(parsed.searchParams.get("per_page"), "100");
    assert.equal(options.sourceId, "agaveReleases");
    return payload;
  }));

  assert.equal(result.repository, "anza-xyz/agave");
  assert.equal(result.items.length, 20);
  assert.equal(result.items[0].tagName, "v3.0.22");
  assert.equal(result.items.at(-1).tagName, "v3.0.3");
  assert.ok(result.items.every((item, index, items) => index === 0 || items[index - 1].publishedAt > item.publishedAt));
  assert.equal(result.dataThrough, result.items[0].publishedAt);
});

test("Agave release collector rejects non-official release links", async () => {
  await assert.rejects(collectAgaveReleases(context(async () => [release(1, {
    html_url: "https://github.com/example/agave/releases/tag/v3.0.1"
  })])), (error) => error.code === "INVALID_AGAVE_RELEASE_URL");
});
