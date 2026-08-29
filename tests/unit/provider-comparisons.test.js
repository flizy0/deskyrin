import assert from "node:assert/strict";
import test from "node:test";
import { collectSolanaData } from "../../src/pipeline/collectors/solana-data.js";
import { DEFAULT_CONFIG } from "../../src/pipeline/config.js";
import { calculateProviderComparisons } from "../../src/pipeline/metrics/provider-comparisons.js";
import { calculateActiveAddresses } from "../../src/pipeline/metrics/rev.js";

const now = new Date("2026-08-29T00:30:00.000Z");
const generatedAt = "2026-08-28T14:50:16.649Z";
const row = (date, metricName, unit, providerName, value) => ({ date, metricName, unit, providerName, value });

test("provider comparisons retain sorted completed-day histories for allowed providers", () => {
  const rows = [
    row("2026-08-27", "SOL Price", "USD", "Blockworks", 105),
    row("2026-08-25", "SOL Price", "USD", "Blockworks", 101),
    row("2026-08-26", "SOL Price", "USD", "Blockworks", 103),
    row("2026-08-27", "SOL Price", "USD", "Blockworks", 105),
    row("2026-08-27", "SOL Price", "USD", "Dune", 104.9),
    row("2026-08-29", "SOL Price", "USD", "Allium", 110),
    row("2026-08-27", "SOL Price", "USD", "Unknown", 999),
    row("2026-08-27", "SOL Price", "SOL", "Birdeye", 1),
    row("2026-08-27", "Fees", "SOL", "Solscan", 10_864),
    row("2026-08-27", "Fee Payers", "Count", "Token Terminal", 2_646_721),
    row("2026-08-27", "DEX Volume", "USD", "DexPaprika", 7_196_703_011)
  ];
  const config = { ...DEFAULT_CONFIG, history: { ...DEFAULT_CONFIG.history, dailyPoints: 2 } };

  const result = calculateProviderComparisons(rows, generatedAt, now, config);

  assert.deepEqual({ status: result.status, observedAt: result.observedAt, sourceIds: result.sourceIds }, {
    status: "fresh",
    observedAt: generatedAt,
    sourceIds: ["solanaData"]
  });
  assert.deepEqual(result.metrics.map(({ id, name, unit }) => ({ id, name, unit })), [
    { id: "sol-price", name: "SOL Price", unit: "USD" },
    { id: "fees", name: "Fees", unit: "SOL" },
    { id: "fee-payers", name: "Fee Payers", unit: "Count" },
    { id: "dex-volume", name: "DEX Volume", unit: "USD" }
  ]);

  const price = result.metrics.find((metric) => metric.id === "sol-price");
  assert.deepEqual(price.series, [
    {
      providerName: "Dune",
      dataThrough: "2026-08-27",
      history: [{ date: "2026-08-27", value: 104.9 }]
    },
    {
      providerName: "Blockworks",
      dataThrough: "2026-08-27",
      history: [
        { date: "2026-08-26", value: 103 },
        { date: "2026-08-27", value: 105 }
      ]
    }
  ]);
  assert.deepEqual(result.metrics.find((metric) => metric.id === "fees").series, [{
    providerName: "Solscan",
    dataThrough: "2026-08-27",
    history: [{ date: "2026-08-27", value: 10_864 }]
  }]);
  assert.deepEqual(result.metrics.find((metric) => metric.id === "fee-payers").series[0].providerName, "Token Terminal");
  assert.deepEqual(result.metrics.find((metric) => metric.id === "dex-volume").series[0].providerName, "DexPaprika");
});

test("provider comparisons reject conflicting rows for the same provider metric and date", () => {
  const rows = [
    row("2026-08-27", "Fees", "SOL", "Allium", 100),
    row("2026-08-27", "Fees", "SOL", "Allium", 101)
  ];

  assert.throws(
    () => calculateProviderComparisons(rows, generatedAt, now, DEFAULT_CONFIG),
    (error) => error.code === "CONFLICTING_DUPLICATE" && error.message.includes("2026-08-27|Fees|SOL|Allium")
  );
});

test("provider comparisons expose all metric definitions when a provider has no rows", () => {
  const result = calculateProviderComparisons([], generatedAt, now, DEFAULT_CONFIG);

  assert.equal(result.metrics.length, 4);
  assert.ok(result.metrics.every((metric) => metric.description.length > 0));
  assert.ok(result.metrics.every((metric) => metric.series.length === 0));
});

test("missing fee-payer consensus does not suppress unrelated Solana Data provider series", async () => {
  const rows = [
    row("2026-08-27", "SOL Price", "USD", "Birdeye", 150),
    row("2026-08-27", "DEX Volume", "USD", "DexPaprika", 2_000_000_000)
  ];
  const collected = await collectSolanaData({
    now,
    config: DEFAULT_CONFIG,
    http: { request: async () => ({ generatedAt, rows }) }
  });

  assert.throws(
    () => calculateActiveAddresses(collected.rows, now, DEFAULT_CONFIG),
    (error) => error.code === "MISSING_ADDRESS_CONSENSUS"
  );

  const comparisons = calculateProviderComparisons(collected.rows, collected.generatedAt, now, DEFAULT_CONFIG);
  assert.equal(comparisons.status, "fresh");
  assert.deepEqual(comparisons.metrics.find((metric) => metric.id === "fee-payers").series, []);
  assert.deepEqual(comparisons.metrics.find((metric) => metric.id === "sol-price").series, [{
    providerName: "Birdeye",
    dataThrough: "2026-08-27",
    history: [{ date: "2026-08-27", value: 150 }]
  }]);
  assert.deepEqual(comparisons.metrics.find((metric) => metric.id === "dex-volume").series, [{
    providerName: "DexPaprika",
    dataThrough: "2026-08-27",
    history: [{ date: "2026-08-27", value: 2_000_000_000 }]
  }]);
});
