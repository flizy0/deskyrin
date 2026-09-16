import assert from "node:assert/strict";
import test from "node:test";
import { SNAPSHOT_HISTORY_START_AT } from "../../src/pipeline/config.js";
import { ARCHIVED_COLLECTION_GAP_ID } from "../../src/pipeline/coverage.js";
import { applySnapshotHistoryRetention, assertSnapshotHistoryRetention } from "../../src/pipeline/history-retention.js";
import { canonicalFixture } from "../helpers/canonical-fixture.js";

const start = SNAPSHOT_HISTORY_START_AT;
const later = "2026-08-30T18:03:43.954Z";
const earlier = "2026-08-29T15:10:55.811Z";

function retentionFixture() {
  const snapshot = canonicalFixture();
  snapshot.updatedAt = "2026-09-01T00:00:00.000Z";
  for (const domain of [snapshot.network.performance, snapshot.validators, snapshot.economics.medianTransactionFee]) {
    const point = domain.history.at(-1);
    domain.observedAt = later;
    domain.history = [earlier, start, later].map((observedAt) => ({ ...point, observedAt }));
  }
  const tokenized = snapshot.ecosystem.tokenizedAssets;
  tokenized.observedAt = later;
  tokenized.history = [{ ...tokenized.history[0], observedAt: later }];
  const event = { votePubkey: snapshot.validators.table[0].votePubkey, previousCommissionPct: 4, commissionPct: 5 };
  snapshot.validators.commissionChanges = [
    { ...event, previousObservedAt: "2026-08-26T00:00:00.000Z", detectedAt: earlier },
    { ...event, previousObservedAt: earlier, detectedAt: start },
    { ...event, previousObservedAt: start, detectedAt: later }
  ];
  snapshot.coverageIncidents = [{ id: ARCHIVED_COLLECTION_GAP_ID }, { id: "later-gap", affectedMetrics: ["TPS"] }];
  snapshot.economics.coinGeckoPrice = structuredClone(snapshot.economics.solPrice);
  snapshot.economics.coinbaseMarket = { history: [{ date: "2026-06-18", closeUsd: 95 }] };
  snapshot.providerComparisons = { metrics: [{ series: [{ history: [{ date: "2026-06-18", value: 1_000 }] }] }] };
  snapshot.observability = { solanaStatus: { incidents: [{ startedAt: "2024-02-06T10:22:42.049Z" }] } };
  return snapshot;
}

test("snapshot retention is inclusive at recovery and never backfills Tokens.xyz", () => {
  const retained = applySnapshotHistoryRetention(retentionFixture());
  for (const domain of [retained.network.performance, retained.validators, retained.economics.medianTransactionFee]) {
    assert.deepEqual(domain.history.map((point) => point.observedAt), [start, later]);
  }
  assert.deepEqual(retained.ecosystem.tokenizedAssets.history.map((point) => point.observedAt), [later]);
});

test("snapshot retention preserves provider histories, calculations, and source timestamps exactly", () => {
  const original = retentionFixture();
  const copy = structuredClone(original);
  const retained = applySnapshotHistoryRetention(original);
  assert.deepEqual(original, copy);
  for (const key of ["solPrice", "coinGeckoPrice", "coinbaseMarket", "tvlAlertInput", "stablecoinSupply", "dexVolume", "rev"]) {
    assert.deepEqual(retained.economics[key], original.economics[key]);
  }
  for (const key of ["dailyActiveAddresses", "news", "upgrades"]) {
    assert.deepEqual(retained.ecosystem[key], original.ecosystem[key]);
  }
  for (const key of ["sources", "updatedAt", "updateStatus", "providerComparisons", "observability", "alerts", "alertChecks"]) {
    assert.deepEqual(retained[key], original[key]);
  }
  assert.deepEqual(retained.network.performance.tps, original.network.performance.tps);
  assert.equal(retained.economics.medianTransactionFee.medianLamports, original.economics.medianTransactionFee.medianLamports);
  assert.equal(retained.ecosystem.tokenizedAssets.totalSpotVolume30dUsd, original.ecosystem.tokenizedAssets.totalSpotVolume30dUsd);
});

test("snapshot retention removes archived coverage and RWA and keeps commission bounds truthful", () => {
  const retained = applySnapshotHistoryRetention(retentionFixture());
  assert.equal(retained.ecosystem.tokenizedAssets.legacyTransferVolume, undefined);
  assert.deepEqual(retained.coverageIncidents.map((incident) => incident.id), ["later-gap"]);
  assert.equal(retained.validators.commissionChanges.length, 2);
  assert.equal(retained.validators.commissionChanges[0].previousObservedAt, null);
  assert.equal(retained.validators.commissionChanges[0].detectedAt, start);
  assert.equal(retained.validators.commissionChanges[1].previousObservedAt, start);
});

test("snapshot retention is idempotent and its publication guard rejects old data", () => {
  const dirty = retentionFixture();
  assert.throws(() => assertSnapshotHistoryRetention(dirty), (error) => error.code === "SNAPSHOT_HISTORY_RETENTION_VIOLATION");
  const retained = applySnapshotHistoryRetention(dirty);
  assert.doesNotThrow(() => assertSnapshotHistoryRetention(retained));
  assert.deepEqual(applySnapshotHistoryRetention(retained), retained);
});

test("snapshot retention refuses to invent a point when no retained observation exists", () => {
  const snapshot = retentionFixture();
  snapshot.network.performance.history = [{ ...snapshot.network.performance.history[0], observedAt: earlier }];
  assert.throws(() => applySnapshotHistoryRetention(snapshot), (error) => error.code === "EMPTY_RETAINED_SNAPSHOT_HISTORY");
});

test("archived pre-boundary publications keep their original contract", () => {
  const snapshot = canonicalFixture();
  assert.equal(applySnapshotHistoryRetention(snapshot), snapshot);
  assert.doesNotThrow(() => assertSnapshotHistoryRetention(snapshot));
});
