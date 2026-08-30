import assert from "node:assert/strict";
import test from "node:test";
import { selectCoverageIncidents } from "../../src/dashboard/coverage-callout.js";
import { sourcePriceReferences } from "../../src/dashboard/pages/economy.js";
import {
  buildProviderComparisonSpec,
  findProviderMetric,
  PROVIDER_COLORS,
  PROVIDER_ORDER
} from "../../src/dashboard/provider-comparison.js";

function providerSnapshot() {
  return {
    updatedAt: "2026-08-29T10:00:00.000Z",
    providerComparisons: {
      status: "fresh",
      observedAt: "2026-08-29T09:00:00.000Z",
      sourceIds: ["solanaData"],
      metrics: [{
        id: "dex-volume",
        name: "DEX Volume",
        unit: "USD",
        description: "Independent daily observations.",
        series: [
          {
            providerName: "Dune",
            dataThrough: "2026-08-29",
            history: [
              { date: "2026-08-27", value: 20 },
              { date: "2026-08-29", value: 22 }
            ]
          },
          {
            providerName: "Allium",
            dataThrough: "2026-08-28",
            history: [
              { date: "2026-08-26", value: 10 },
              { date: "2026-08-28", value: 12 }
            ]
          },
          {
            providerName: "Blockworks",
            dataThrough: "2026-08-29",
            history: [{ date: "2026-08-29", value: 30 }]
          }
        ]
      }]
    }
  };
}

test("provider comparison aligns real source series with explicit gaps and stable colors", () => {
  const snapshot = providerSnapshot();
  const spec = buildProviderComparisonSpec(snapshot, "dex-volume", {
    formatter: String,
    references: [
      {
        label: "Published headline",
        color: "#ffffff",
        history: [
          { date: "2026-08-26", value: 15 },
          { date: "2026-08-29", value: 18 }
        ]
      },
      {
        label: "CoinGecko",
        providerName: "CoinGecko",
        dataThrough: "2026-08-29",
        history: [{ date: "2026-08-29", value: 19 }]
      }
    ]
  });

  assert.deepEqual(spec.labels, [
    "2026-08-26T00:00:00.000Z",
    "2026-08-27T00:00:00.000Z",
    "2026-08-28T00:00:00.000Z",
    "2026-08-29T00:00:00.000Z"
  ]);
  assert.deepEqual(spec.providerSeries.map((series) => series.providerName), ["Allium", "Blockworks", "Dune", "CoinGecko"]);
  assert.deepEqual(spec.datasets.find((series) => series.providerName === "Dune").data, [null, 20, null, 22]);
  assert.deepEqual(spec.datasets.find((series) => series.providerName === "Allium").data, [10, null, 12, null]);
  assert.equal(spec.datasets.find((series) => series.providerName === "Allium").color, PROVIDER_COLORS.Allium);
  assert.equal(spec.datasets.every((series) => series.spanGaps === false), true);
  assert.equal(spec.datasets.every((series) => typeof series.providerName === "string"), true);
  assert.equal(spec.datasets.some((series) => series.label === "Published headline"), false);
  assert.equal(spec.legend, false);
});

test("new provider series have stable colors and deterministic ordering", () => {
  assert.equal(PROVIDER_COLORS["Top Ledger"], "#4f9fa8");
  assert.equal(PROVIDER_COLORS.Uniblock, "#bd7047");
  assert.ok(PROVIDER_ORDER.indexOf("Top Ledger") < PROVIDER_ORDER.indexOf("Uniblock"));
});

test("provider comparison ignores providerless references and preserves provider selection", () => {
  const spec = buildProviderComparisonSpec(providerSnapshot(), "dex-volume", {
    formatter: String,
    selectedProviders: ["Allium"],
    references: [{
      label: "Published headline",
      color: "#ffffff",
      history: [{ date: "2026-08-29", value: 18 }]
    }]
  });

  assert.equal(spec.datasets.some((series) => series.label === "Published headline"), false);
  assert.equal(spec.datasets.find((series) => series.providerName === "Allium").hidden, undefined);
  assert.equal(spec.datasets.find((series) => series.providerName === "Dune").hidden, true);
  assert.equal(findProviderMetric({}, "dex-volume"), null);
  assert.equal(buildProviderComparisonSpec({}, "dex-volume", { formatter: String }), null);
});

test("daily SOL comparison excludes incomplete current-day market observations", () => {
  const references = sourcePriceReferences({
    coinbaseMarket: {
      history: [
        { date: "2026-08-28", closeUsd: 199 },
        { date: "2026-08-29", closeUsd: 200 }
      ]
    },
    coinGeckoPrice: {
      history: [
        { observedAt: "2026-08-28T23:00:00.000Z", priceUsd: 198 },
        { observedAt: "2026-08-29T10:00:00.000Z", priceUsd: 201 }
      ]
    }
  }, "2026-08-29T12:00:00.000Z");

  assert.deepEqual(references.map((reference) => ({
    providerName: reference.providerName,
    dataThrough: reference.dataThrough,
    dates: reference.history.map((point) => point.date)
  })), [
    { providerName: "Coinbase", dataThrough: "2026-08-28", dates: ["2026-08-28"] },
    { providerName: "CoinGecko", dataThrough: "2026-08-28", dates: ["2026-08-28"] }
  ]);
});

test("coverage incident selection is scoped to the affected dashboard domain", () => {
  const snapshot = {
    coverageIncidents: [{
      id: "network-gap",
      affectedMetrics: ["TPS", "Slot time"]
    }, {
      id: "validator-gap",
      affectedMetrics: ["Validator snapshots and commission tracking"]
    }]
  };

  assert.deepEqual(selectCoverageIncidents(snapshot, ["TPS"]).map((incident) => incident.id), ["network-gap"]);
  assert.deepEqual(selectCoverageIncidents(snapshot, ["Sampled median transaction fee"]), []);
  assert.equal(selectCoverageIncidents(snapshot).length, 2);
  assert.deepEqual(selectCoverageIncidents({}, ["TPS"]), []);
});
