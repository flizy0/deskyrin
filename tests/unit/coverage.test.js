import assert from "node:assert/strict";
import test from "node:test";
import { ARCHIVED_COLLECTION_GAP_ID, retainCoverageIncidents } from "../../src/pipeline/coverage.js";

test("coverage retention never seeds the archived August incident", () => {
  assert.deepEqual(retainCoverageIncidents(undefined), []);
  assert.deepEqual(retainCoverageIncidents([]), []);
  assert.deepEqual(retainCoverageIncidents([{ id: ARCHIVED_COLLECTION_GAP_ID }]), []);
});

test("coverage retention preserves unrelated incidents without mutation", () => {
  const previous = [
    { id: ARCHIVED_COLLECTION_GAP_ID, affectedMetrics: ["TPS"] },
    { id: "later-gap", affectedMetrics: ["Sampled median transaction fee"], status: "ongoing" }
  ];
  const original = structuredClone(previous);
  const retained = retainCoverageIncidents(previous);
  assert.deepEqual(retained, [previous[1]]);
  retained[0].affectedMetrics.push("Unexpected metric");
  assert.deepEqual(previous, original);
});
