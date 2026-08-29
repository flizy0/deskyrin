import assert from "node:assert/strict";
import test from "node:test";
import { splitSparklinePoints } from "../../src/dashboard/sparkline.js";

test("sparkline segments preserve explicit live-history gaps", () => {
  const points = [
    { time: Date.parse("2026-08-26T16:00:00.000Z"), value: 1 },
    { time: Date.parse("2026-08-26T17:00:00.000Z"), value: 2 },
    { time: Date.parse("2026-08-29T11:00:00.000Z"), value: 3 }
  ];

  const segments = splitSparklinePoints(points, 3 * 60 * 60 * 1_000);
  assert.deepEqual(segments.map((segment) => segment.map((point) => point.value)), [[1, 2], [3]]);
  assert.equal(splitSparklinePoints(points, undefined).length, 1);
});
