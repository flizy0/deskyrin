import assert from "node:assert/strict";
import test from "node:test";
import { validateOutputs } from "../../src/pipeline/validate-output.js";
import { DEFAULT_CONFIG } from "../../src/pipeline/config.js";
import { publishOutputs } from "../../src/pipeline/outputs/publish.js";
import { renderReport } from "../../src/pipeline/outputs/report.js";
import { pruneSnapshotHistory } from "../../scripts/prune-snapshot-history.js";

test("checked-in generated outputs satisfy the public contract", async () => {
  const result = await validateOutputs();
  assert.equal(result.snapshot.validators.table.length, result.snapshot.validators.counts.total);
  assert.ok(result.snapshot.ecosystem.upgrades.items.some((item) => item.id === "alpenglow"));
  assert.ok(result.snapshot.ecosystem.upgrades.items.some((item) => item.simds.some((simd) => simd.id === "0525")));
  assert.ok(result.dataBytes < 2 * 1024 * 1024);
});

test("retention-only rewrites preserve data timestamps and reject unpruned publication", async () => {
  const { snapshot } = await validateOutputs();
  const dirty = structuredClone(snapshot);
  dirty.network.performance.history.unshift({ ...dirty.network.performance.history[0], observedAt: "2026-08-26T00:00:00.000Z" });
  await assert.rejects(
    publishOutputs(dirty, renderReport(dirty), DEFAULT_CONFIG, { dryRun: true }),
    (error) => error.code === "SNAPSHOT_HISTORY_RETENTION_VIOLATION"
  );
  const result = await pruneSnapshotHistory({ snapshot: dirty });
  assert.equal(result.published.written, false);
  assert.equal(result.snapshot.updatedAt, snapshot.updatedAt);
  assert.deepEqual(result.snapshot.sources, snapshot.sources);
  assert.deepEqual(result.snapshot.network.performance, snapshot.network.performance);
  assert.deepEqual(result.snapshot.economics.solPrice.history, snapshot.economics.solPrice.history);
});
