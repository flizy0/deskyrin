import assert from "node:assert/strict";
import test from "node:test";
import { appendHistory, normalizeHistory } from "../../src/pipeline/lib/history.js";
import { decimalBigInt, lamportsToSolNumber } from "../../src/pipeline/lib/numbers.js";
import { durationWeightedRate, median, percentageChange, slotIntervalMs } from "../../src/pipeline/lib/statistics.js";
import { areAdjacentUtcDates, isCompletedUtcDate, isDue, utcDateKey } from "../../src/pipeline/lib/time.js";

test("statistics use exact documented aggregation", () => {
  assert.equal(median([9, 1, 7, 3]), 5);
  assert.ok(Math.abs(percentageChange(110, 100) - 10) < 1e-12);
  assert.deepEqual(durationWeightedRate([
    { count: 120, samplePeriodSecs: 60 },
    { count: 180, samplePeriodSecs: 60 }
  ], "count"), { value: 2.5, numerator: 300, duration: 120 });
  assert.equal(slotIntervalMs([{ numSlots: 300, samplePeriodSecs: 120 }]).value, 400);
});

test("BigInt helpers preserve unsafe provider integers", () => {
  assert.equal(decimalBigInt(194864041290723n, "stake"), 194864041290723n);
  assert.equal(lamportsToSolNumber(1_500_000_000n), 1.5);
  assert.throws(() => decimalBigInt(-1, "stake"), /unsigned decimal integer/);
});

test("history deduplicates, sorts, and trims", () => {
  const points = normalizeHistory([{ at: "b", value: 1 }, { at: "a", value: 2 }, { at: "b", value: 1 }], { key: (point) => point.at, limit: 2 });
  assert.deepEqual(points, [{ at: "a", value: 2 }, { at: "b", value: 1 }]);
  assert.deepEqual(appendHistory(points, { at: "c", value: 4 }, { key: (point) => point.at, limit: 2 }), [{ at: "b", value: 1 }, { at: "c", value: 4 }]);
  assert.throws(
    () => normalizeHistory([{ at: "a", value: 1 }, { at: "a", value: 2 }], { key: (point) => point.at, limit: 2 }),
    (error) => error.code === "CONFLICTING_DUPLICATE"
  );
});

test("UTC helpers reject partial/current days", () => {
  const now = new Date("2026-08-20T12:00:00.000Z");
  assert.equal(utcDateKey(now), "2026-08-20");
  assert.equal(isCompletedUtcDate("2026-08-19", now), true);
  assert.equal(isCompletedUtcDate("2026-08-20", now), false);
  assert.equal(areAdjacentUtcDates("2026-08-18", "2026-08-19"), true);
  assert.equal(isDue("2026-08-20T10:59:59.999Z", 3_600_000, now), true);
});
