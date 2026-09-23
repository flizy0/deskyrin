import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_CONFIG } from "../../src/pipeline/config.js";
import { notifyUnhandledPipelineIssue } from "../../src/pipeline/notifications.js";
import { postProcessSnapshot } from "../../src/pipeline/post-process.js";
import { canonicalFixture } from "../helpers/canonical-fixture.js";

const EARLIER = "2026-08-19T17:00:00.000Z";

function postProcessConfig() {
  return {
    ...DEFAULT_CONFIG,
    history: {
      ...DEFAULT_CONFIG.history,
      snapshotStartAt: "2026-08-19T00:00:00.000Z"
    }
  };
}

function repairableFixture() {
  const snapshot = canonicalFixture();
  snapshot.network.performance.history.unshift({
    observedAt: EARLIER,
    totalTps: 2_900,
    nonVoteTps: 1_900,
    slotTimeMs: 410
  });
  snapshot.validators.history.unshift({
    ...snapshot.validators.history[0],
    observedAt: EARLIER
  });
  snapshot.economics.medianTransactionFee.history.unshift({
    ...snapshot.economics.medianTransactionFee.history[0],
    observedAt: EARLIER
  });
  return snapshot;
}

test("snapshot post-process repairs known visible gaps and becomes a no-op", async () => {
  const original = repairableFixture();
  const processed = await postProcessSnapshot(original, {
    config: postProcessConfig(),
    context: "test"
  });

  assert.equal(processed.autoRepair.applied, true);
  assert.deepEqual(
    processed.autoRepair.repairs.map((repair) => repair.history),
    [
      "network.performance.history",
      "validators.history",
      "economics.medianTransactionFee.history"
    ]
  );
  assert.ok(processed.autoRepair.repairs.every((repair) => repair.reasons.includes("VISIBLE_HISTORY_GAP")));
  assert.equal(processed.autoRepair.summary.networkPerformance.imputed, 6);
  assert.equal(processed.autoRepair.summary.validators.imputed, 6);
  assert.equal(processed.autoRepair.summary.medianTransactionFee.imputed, 6);
  assert.equal(original.network.performance.history.some((point) => point.imputed), false);

  const repeated = await postProcessSnapshot(processed.snapshot, {
    config: postProcessConfig(),
    context: "test"
  });
  assert.equal(repeated.autoRepair.applied, false);
  assert.deepEqual(repeated.snapshot, processed.snapshot);
});

test("snapshot post-process removes stale estimates that no longer bridge a visible gap", async () => {
  const snapshot = canonicalFixture();
  snapshot.network.performance.history.unshift(
    {
      observedAt: "2026-08-19T19:00:00.000Z",
      totalTps: 2_900,
      nonVoteTps: 1_900,
      slotTimeMs: 410
    },
    {
      observedAt: "2026-08-19T22:00:00.000Z",
      totalTps: 2_950,
      nonVoteTps: 1_950,
      slotTimeMs: 407,
      imputed: true
    }
  );

  const processed = await postProcessSnapshot(snapshot, {
    config: postProcessConfig(),
    context: "test_stale"
  });
  assert.equal(processed.autoRepair.applied, true);
  assert.deepEqual(processed.autoRepair.repairs[0].reasons, ["STALE_HISTORY_ESTIMATES"]);
  assert.equal(processed.snapshot.network.performance.history.length, 2);
  assert.equal(processed.snapshot.network.performance.history.some((point) => point.imputed), false);
});

test("unknown post-process failures reach the reserved notifier and still block publication", async () => {
  const snapshot = repairableFixture();
  snapshot.validators.history.reverse();
  const notifications = [];

  await assert.rejects(
    postProcessSnapshot(snapshot, {
      config: postProcessConfig(),
      context: "test_unknown",
      notify: async (issue) => notifications.push(issue)
    }),
    (error) => error.code === "INVALID_IMPUTATION_HISTORY"
  );
  assert.deepEqual(notifications, [{
    kind: "unhandled_snapshot_issue",
    context: "test_unknown",
    error: {
      code: "INVALID_IMPUTATION_HISTORY",
      message: "validator must be strictly chronological",
      retryable: false
    }
  }]);
});

test("default notification delivery is intentionally a no-op", async () => {
  await assert.doesNotReject(notifyUnhandledPipelineIssue({ kind: "test" }));
});
