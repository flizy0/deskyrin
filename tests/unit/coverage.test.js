import assert from "node:assert/strict";
import test from "node:test";
import { buildCoverageIncidents } from "../../src/pipeline/coverage.js";

const recoveryAt = "2026-08-29T01:02:03.456Z";

test("coverage incident is absent before its known start", () => {
  assert.deepEqual(buildCoverageIncidents(undefined, false, "2026-08-20T12:00:00.000Z"), []);
});

test("coverage incident is seeded as ongoing before recovery", () => {
  const incidents = buildCoverageIncidents(undefined, false, recoveryAt);

  assert.deepEqual(incidents, [{
    id: "collection-gap-2026-08-26",
    status: "ongoing",
    startedAt: "2026-08-26T17:57:44.334Z",
    endedAt: null,
    affectedMetrics: [
      "TPS",
      "Non-vote TPS",
      "Slot time",
      "Validator snapshots and commission tracking",
      "Sampled median transaction fee"
    ],
    reason: "Scheduled collection did not publish during part of this interval, and the first subsequent publication was rejected by canonical commission-history ordering validation.",
    disclosure: "No values were interpolated. Provider-dated histories may be retrieved after recovery."
  }]);
});

test("coverage incident starts at the first missed due observation when supplied", () => {
  const firstMissedAt = "2026-08-26T18:17:00.000Z";
  const incidents = buildCoverageIncidents(undefined, false, recoveryAt, firstMissedAt);

  assert.equal(incidents[0].startedAt, firstMissedAt);
});

test("coverage incident closes at the first recovery observation", () => {
  const incidents = buildCoverageIncidents([], true, recoveryAt);

  assert.equal(incidents[0].status, "resolved");
  assert.equal(incidents[0].endedAt, recoveryAt);
});

test("coverage incident preserves its first recovery timestamp thereafter", () => {
  const closed = buildCoverageIncidents([], true, recoveryAt);
  const later = buildCoverageIncidents(closed, true, "2026-08-30T12:00:00.000Z");
  const afterNonRecoveryRun = buildCoverageIncidents(later, false, "2026-08-31T12:00:00.000Z");

  assert.equal(later[0].endedAt, recoveryAt);
  assert.equal(afterNonRecoveryRun[0].endedAt, recoveryAt);
  assert.equal(afterNonRecoveryRun[0].status, "resolved");
});

test("coverage incident construction does not mutate previous data", () => {
  const previous = [{
    id: "older-gap",
    status: "resolved",
    startedAt: "2026-08-01T00:00:00.000Z",
    endedAt: "2026-08-01T01:00:00.000Z",
    affectedMetrics: ["Example"],
    reason: "Previous incident",
    disclosure: "No interpolation."
  }, ...buildCoverageIncidents([], true, recoveryAt)];
  const original = structuredClone(previous);
  const next = buildCoverageIncidents(previous, false, "2026-08-30T00:00:00.000Z");

  next[0].affectedMetrics.push("Unexpected metric");
  assert.deepEqual(previous, original);
  assert.equal(next[0].id, "older-gap");
});
