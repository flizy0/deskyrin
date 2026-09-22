import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { renderReport } from "../../src/pipeline/outputs/report.js";
import { canonicalFixture } from "../helpers/canonical-fixture.js";

function supplementalReportFixture() {
  const snapshot = canonicalFixture();
  snapshot.validators.commissionChanges = [{
    previousObservedAt: "2026-08-25T10:57:48.814Z",
    detectedAt: "2026-08-29T11:13:49.269Z",
    votePubkey: snapshot.validators.table[0].votePubkey,
    previousCommissionPct: 4,
    commissionPct: 5
  }];
  snapshot.coverageIncidents = [{
    id: "example-collection-gap",
    status: "resolved",
    startedAt: "2026-08-26T16:57:53.898Z",
    endedAt: "2026-08-29T12:00:00.000Z",
    affectedMetrics: ["TPS", "Validator snapshots", "Sampled median transaction fee"],
    reason: "A scheduled collection did not publish and the next candidate failed validation.",
    disclosure: "No values were interpolated."
  }];
  snapshot.economics.coinGeckoPrice = {
    status: "fresh",
    observedAt: "2026-08-29T12:00:00.000Z",
    currentUsd: 101
  };
  snapshot.economics.coinbaseMarket = {
    status: "fresh",
    productId: "SOL-USD",
    dataThrough: "2026-08-28",
    history: [{ closeUsd: 105 }]
  };
  snapshot.providerComparisons = {
    status: "fresh",
    metrics: [{
      name: "DEX Volume",
      unit: "USD",
      series: [{
        providerName: "DexPaprika",
        dataThrough: "2026-08-28",
        history: [{ date: "2026-08-28", value: 7_000_000_000 }]
      }]
    }]
  };
  snapshot.observability = {
    solanaStatus: {
      status: "fresh",
      observedAt: "2026-08-29T12:00:00.000Z",
      page: { updatedAt: "2026-08-29T11:55:00.000Z" },
      condition: { indicator: "none", description: "All systems operational" },
      components: [{ name: "Solana Mainnet Beta", status: "operational", updatedAt: "2026-08-29T11:55:00.000Z" }],
      incidents: []
    },
    agaveReleases: {
      status: "fresh",
      items: [{
        tagName: "v3.0.0",
        title: "Agave v3.0.0",
        url: "https://github.com/anza-xyz/agave/releases/tag/v3.0.0",
        publishedAt: "2026-08-27T11:00:00.000Z",
        prerelease: false
      }]
    }
  };
  return snapshot;
}

test("report discloses gaps and keeps supplemental evidence separate", () => {
  const snapshot = supplementalReportFixture();
  const report = renderReport(snapshot);

  assert.match(report, /## Data Coverage/);
  assert.match(report, /No values were interpolated\./);
  assert.match(report, /CoinGecko keyless comparison/);
  assert.match(report, /Coinbase Exchange SOL-USD daily close/);
  assert.match(report, /not averaged into the headline SOL price/);
  assert.match(report, /delivered through the Solana Foundation Data endpoint/);
  assert.match(report, /DexPaprika/);
  assert.match(report, /Official Solana Status/);
  assert.match(report, /Recent Agave releases/);
  assert.match(report, /Possible change window/);
  assert.match(report, /2026-08-25T10:57:48\.814Z → 2026-08-29T11:13:49\.269Z/);
  assert.match(report, /not an exact change timestamp/);
  assert.equal(renderReport(snapshot), report);
});

test("baseline report omits unavailable supplemental sections", () => {
  const report = renderReport(canonicalFixture());
  assert.doesNotMatch(report, /## Data Coverage/);
  assert.doesNotMatch(report, /## Provider Comparison Evidence/);
  assert.doesNotMatch(report, /## Network Observability/);
});

test("report presents the current tokenized snapshot without retired RWA evidence", () => {
  const snapshot = canonicalFixture();
  snapshot.ecosystem.tokenizedAssets.categoryBreakdown = [
    { id: "equities", indexedAssetCount: 4, coveredAssetCount: 3, spotVolume30dUsd: 2_000 },
    { id: "funds", indexedAssetCount: 2, coveredAssetCount: 2, spotVolume30dUsd: 500 },
    { id: "commodities", indexedAssetCount: 2, coveredAssetCount: 2, spotVolume30dUsd: 300 },
    { id: "other-rwa", indexedAssetCount: 2, coveredAssetCount: 1, spotVolume30dUsd: 200 }
  ];
  snapshot.ecosystem.tokenizedAssets.topAssets = [{
    rank: 1,
    assetId: "test-asset",
    name: "Test Equity",
    symbol: "TEST",
    categoryGroup: "equities",
    spotVolume30dUsd: 1_500,
    metricsSource: "birdeye"
  }];

  const report = renderReport(snapshot);
  assert.match(report, /### Tokenized market category breakdown/);
  assert.match(report, /\| ETFs \| 2 \| 2 \| \$500 \|/);
  assert.match(report, /### Leading covered tokenized assets/);
  assert.match(report, /TEST — Test Equity/);
  assert.doesNotMatch(report, /Retired RWA\.xyz transfer-volume evidence|Final retained values/);
});

test("published methodology matches its source and documents evidence boundaries", async () => {
  const [source, published] = await Promise.all([
    readFile("docs/methodology.md", "utf8"),
    readFile("public/methodology.md", "utf8")
  ]);

  assert.equal(published, source);
  assert.match(source, /CoinGecko always-on comparison and fallback/);
  assert.match(source, /Coinbase market evidence/);
  assert.match(source, /Provider comparison evidence/);
  assert.match(source, /Solana Status is evidence/);
  assert.match(source, /Agave releases come independently/);
  assert.match(source, /Live collection never substitutes an estimate for a current value/);
  assert.match(source, /2026-08-29T15:10:55\.812Z/);
  assert.match(source, /Provider-dated histories retain their existing/);
  assert.match(source, /previousObservedAt/);
  assert.match(source, /never claims the exact on-chain change time/);
  assert.match(source, /Tokens\.xyz's public curated Solana lists/);
  assert.doesNotMatch(source, /A persistent `coverageIncidents` record discloses the collection gap/);
  assert.match(source, /eight non-imputed observations/);
  assert.match(source, /Every estimated row carries `imputed: true`/);
  assert.match(source, /never extrapolates/);
});

test("report discloses recovered and imputed history without changing current values", () => {
  const snapshot = canonicalFixture();
  snapshot.network.performance.history.unshift(
    { observedAt: "2026-08-19T22:00:00.000Z", totalTps: 2_800, nonVoteTps: 1_800, slotTimeMs: 410, imputed: true },
    { observedAt: "2026-08-19T23:00:00.000Z", totalTps: 2_900, nonVoteTps: 1_900, slotTimeMs: 408, recoveredFrom: "solana_rpc_performance_samples" }
  );
  const report = renderReport(snapshot);
  assert.match(report, /## Historical Continuity Repairs/);
  assert.match(report, /Current values, source freshness, and alerts use direct observations only/);
  assert.match(report, /\| Network performance \| 1 \| 1 \| 1 \|/);
});
