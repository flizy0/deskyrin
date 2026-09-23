import assert from "node:assert/strict";
import test from "node:test";
import { evaluateUpdateDue } from "../../scripts/check-update-due.js";
import { canonicalFixture } from "../helpers/canonical-fixture.js";

function scheduledSnapshot() {
  const snapshot = canonicalFixture();
  snapshot.updatedAt = "2026-08-20T00:00:00.000Z";
  for (const source of Object.values(snapshot.sources)) {
    source.nextDueAt = "2026-08-20T01:00:00.000Z";
  }
  return snapshot;
}

test("scheduler preflight skips early attempts and admits the first due window", () => {
  const snapshot = scheduledSnapshot();
  assert.deepEqual(
    evaluateUpdateDue(snapshot, { now: "2026-08-20T00:13:00.000Z" }),
    { due: false, reason: "not_due", nextDueAt: "2026-08-20T01:00:00.000Z" }
  );
  assert.deepEqual(
    evaluateUpdateDue(snapshot, { now: "2026-08-20T00:55:00.000Z" }),
    { due: true, reason: "source_due", nextDueAt: "2026-08-20T01:00:00.000Z" }
  );
});

test("scheduler preflight always admits recovery, stale snapshots, and migrations", () => {
  const snapshot = scheduledSnapshot();
  assert.equal(evaluateUpdateDue(snapshot, { eventName: "workflow_dispatch", now: "2026-08-20T00:01:00.000Z" }).reason, "manual_dispatch");
  assert.equal(evaluateUpdateDue(snapshot, { now: "2026-08-20T01:16:00.000Z" }).reason, "snapshot_age");
  snapshot.schemaVersion = "1.4.0";
  assert.equal(evaluateUpdateDue(snapshot, { now: "2026-08-20T00:01:00.000Z" }).reason, "schema_migration");
  snapshot.schemaVersion = "1.5.0";
  snapshot.methodologyVersion = "1.5.0";
  assert.equal(evaluateUpdateDue(snapshot, { now: "2026-08-20T00:01:00.000Z" }).reason, "schema_migration");
});
