import assert from "node:assert/strict";
import test from "node:test";
import { LIVE_OBSERVATION_GAP_MS } from "../../src/dashboard/charts.js";
import { splitSparklinePoints } from "../../src/dashboard/sparkline.js";

test("live charts join delayed successful samples but preserve the collection outage", () => {
  const points = [
    { time: Date.parse("2026-08-26T12:23:44.334Z"), value: 1 },
    { time: Date.parse("2026-08-26T16:57:44.334Z"), value: 2 },
    { time: Date.parse("2026-08-29T15:10:55.812Z"), value: 3 }
  ];

  const segments = splitSparklinePoints(points, LIVE_OBSERVATION_GAP_MS);
  assert.deepEqual(segments.map((segment) => segment.map((point) => point.value)), [[1, 2], [3]]);
  assert.equal(splitSparklinePoints(points, undefined).length, 1);
});
