import assert from "node:assert/strict";
import test from "node:test";
import {
  imputeBoundedHistory,
  NETWORK_RECOVERY_SOURCE,
  repairSnapshotHistoryGaps
} from "../../src/pipeline/history-imputation.js";
import { canonicalFixture } from "../helpers/canonical-fixture.js";

const HOUR_MS = 3_600_000;

test("bounded imputation inserts evenly spaced labelled points without extrapolation", () => {
  const history = [
    { observedAt: "2026-08-20T00:00:00.000Z", value: 10 },
    { observedAt: "2026-08-20T03:00:00.000Z", value: 40 }
  ];
  const repaired = imputeBoundedHistory(history, {
    cadenceMs: HOUR_MS,
    interpolate: (left, right, numerator, denominator) => ({
      value: (left.value * (denominator - numerator) + right.value * numerator) / denominator
    }),
    label: "test",
    limit: 10
  });

  assert.deepEqual(repaired, [
    history[0],
    { observedAt: "2026-08-20T01:00:00.000Z", value: 20, imputed: true },
    { observedAt: "2026-08-20T02:00:00.000Z", value: 30, imputed: true },
    history[1]
  ]);
  assert.equal(repaired[0].imputed, undefined);
  assert.equal(repaired.at(-1).imputed, undefined);
});

test("a visual-gap threshold removes obsolete estimates from already connected history", () => {
  const history = [
    { observedAt: "2026-08-20T00:00:00.000Z", value: 10 },
    { observedAt: "2026-08-20T01:00:00.000Z", value: 12, imputed: true },
    { observedAt: "2026-08-20T05:00:00.000Z", value: 20 }
  ];
  const repaired = imputeBoundedHistory(history, {
    cadenceMs: HOUR_MS,
    interpolate: (left, right, numerator, denominator) => ({
      value: (left.value * (denominator - numerator) + right.value * numerator) / denominator
    }),
    label: "test",
    limit: 10,
    minimumGapMs: 6 * HOUR_MS
  });

  assert.deepEqual(repaired, [history[0], history[2]]);
});

test("snapshot repair is deterministic and preserves current observations", () => {
  const fixture = canonicalFixture();
  const later = "2026-08-20T07:00:00.000Z";
  fixture.network.performance.history.push({ observedAt: later, totalTps: 3_300, nonVoteTps: 2_300, slotTimeMs: 390 });
  fixture.validators.history.push({ ...fixture.validators.history[0], observedAt: later, activeCount: 4, delinquentCount: 2 });
  fixture.economics.medianTransactionFee.history.push({ observedAt: later, medianLamports: 5_300, transactionCount: 10_300, selectedBlockCount: 16 });

  const first = repairSnapshotHistoryGaps(fixture);
  const second = repairSnapshotHistoryGaps(first.snapshot);
  assert.deepEqual(second, first);
  assert.equal(first.summary.networkPerformance.imputed, 6);
  assert.equal(first.summary.validators.imputed, 6);
  assert.equal(first.summary.medianTransactionFee.imputed, 6);
  assert.deepEqual(first.snapshot.network.performance.history.at(-1), fixture.network.performance.history.at(-1));
});

test("available RPC performance evidence is recovered before interpolation", () => {
  const fixture = canonicalFixture();
  fixture.network.performance.history.push({
    observedAt: "2026-08-20T07:00:00.000Z",
    totalTps: 3_300,
    nonVoteTps: 2_300,
    slotTimeMs: 390
  });
  const recovered = {
    observedAt: "2026-08-20T01:00:00.000Z",
    totalTps: 3_100,
    nonVoteTps: 2_100,
    slotTimeMs: 400
  };
  const result = repairSnapshotHistoryGaps(fixture, { recoveredNetworkPoints: [recovered] });
  const repeated = repairSnapshotHistoryGaps(result.snapshot, { recoveredNetworkPoints: [recovered] });

  assert.equal(result.summary.networkPerformance.recovered, 1);
  assert.equal(result.summary.networkPerformance.imputed, 0);
  assert.equal(result.snapshot.network.performance.history[1].recoveredFrom, NETWORK_RECOVERY_SOURCE);
  assert.equal(result.snapshot.network.performance.history[2].imputed, undefined);
  assert.deepEqual(repeated, result);
});
