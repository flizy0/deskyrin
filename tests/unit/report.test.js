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
    id: "collection-gap-2026-08-26",
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
  assert.match(source, /No missing live observations are interpolated/);
  assert.match(source, /without claiming that Solana itself was unavailable/);
  assert.match(source, /previousObservedAt/);
  assert.match(source, /never claims the exact on-chain change time/);
  assert.match(source, /Tokens\.xyz's public curated Solana lists/);
  assert.match(source, /retired RWA\.xyz trailing-30-day transfer-volume history/);
});
