import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  applyMedianFeeRepairs,
  MEDIAN_FEE_REPAIR_TARGETS
} from "../../scripts/repair-median-fee-history.js";

test("median-fee repair anchors are sorted, unique, and backed by commits", () => {
  assert.equal(MEDIAN_FEE_REPAIR_TARGETS.length, 8);
  assert.deepEqual(
    MEDIAN_FEE_REPAIR_TARGETS.map((target) => target.observedAt),
    [...MEDIAN_FEE_REPAIR_TARGETS].map((target) => target.observedAt).sort()
  );
  assert.equal(new Set(MEDIAN_FEE_REPAIR_TARGETS.map((target) => target.observedAt)).size, 8);
  assert.ok(MEDIAN_FEE_REPAIR_TARGETS.every((target) => /^[0-9a-f]{40}$/.test(target.evidenceCommit)));
});

test("checked-in on-chain repair results cover every target", async () => {
  const value = JSON.parse(await readFile(
    new URL("../../scripts/median-fee-repair-results.json", import.meta.url),
    "utf8"
  ));

  assert.deepEqual(
    value.repairs.map((repair) => repair.target),
    MEDIAN_FEE_REPAIR_TARGETS
  );
  for (const repair of value.repairs) {
    assert.equal(repair.point.observedAt, repair.target.observedAt);
    assert.equal(repair.point.selectedBlockCount, 16);
    assert.equal(repair.sample.endSlot, String(repair.target.endSlot));
    assert.equal(BigInt(repair.sample.endSlot) - BigInt(repair.sample.startSlot), 9_000n);
    assert.equal(repair.sample.transactionCount, repair.point.transactionCount);
  }
});

test("median-fee repair merges real points and removes the resolved placeholder", () => {
  const snapshot = {
    updatedAt: "2026-09-11T00:00:00.000Z",
    coverageIncidents: [
      { id: "older-gap", affectedMetrics: ["TPS"] },
      { id: "median-fee-gap-2026-09-02", affectedMetrics: ["Sampled median transaction fee"] }
    ],
    economics: {
      medianTransactionFee: {
        history: [
          { observedAt: "2026-09-02T00:34:05.253Z", medianLamports: 5000, transactionCount: 19820, selectedBlockCount: 16 },
          { observedAt: "2026-09-02T12:31:57.796Z", medianLamports: 5000, transactionCount: 17270, selectedBlockCount: 16 }
        ]
      }
    }
  };
  const original = structuredClone(snapshot);
  const repairs = [{
    point: { observedAt: "2026-09-02T02:37:45.476Z", medianLamports: 5000, transactionCount: 18000, selectedBlockCount: 16 }
  }];
  const repaired = applyMedianFeeRepairs(snapshot, repairs, "2026-09-11T12:00:00.000Z");

  assert.deepEqual(snapshot, original);
  assert.deepEqual(repaired.economics.medianTransactionFee.history.map((point) => point.observedAt), [
    "2026-09-02T00:34:05.253Z",
    "2026-09-02T02:37:45.476Z",
    "2026-09-02T12:31:57.796Z"
  ]);
  assert.deepEqual(repaired.coverageIncidents.map((incident) => incident.id), ["older-gap"]);
  assert.equal(repaired.updatedAt, "2026-09-11T12:00:00.000Z");
});
