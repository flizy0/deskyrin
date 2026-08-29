import assert from "node:assert/strict";
import test from "node:test";
import {
  clampRange,
  normalizeTimestamps,
  panRange,
  presetRange,
  timestampBounds,
  visibleDataTimestampBounds,
  visiblePointIndexes,
  zoomRange
} from "../../src/dashboard/chart-range.js";

test("timestamps are validated and sorted without mutating the source", () => {
  const source = [30, 10, 20, 10];
  assert.deepEqual(normalizeTimestamps(source), [10, 10, 20, 30]);
  assert.deepEqual(source, [30, 10, 20, 10]);
  assert.deepEqual(normalizeTimestamps([]), []);

  assert.throws(() => normalizeTimestamps("10"), /array/);
  assert.throws(() => normalizeTimestamps([10, Number.NaN]), /finite number/);
  assert.throws(() => normalizeTimestamps([Number.POSITIVE_INFINITY]), /finite number/);
  assert.throws(() => normalizeTimestamps(["10"]), /finite number/);
});

test("timestamp bounds handle empty, single-point, and irregular input", () => {
  assert.equal(timestampBounds([]), null);
  assert.deepEqual(timestampBounds([42]), { min: 42, max: 42 });
  assert.deepEqual(timestampBounds([70, 10, 55, 30]), { min: 10, max: 70 });
});

test("visible data bounds ignore hidden and null-only chart edges", () => {
  const timestamps = [10, 20, 30, 40];
  const datasets = [
    { data: [null, 2, null, 4], hidden: true },
    { data: [1, null, 3, null] },
    { data: [null, { x: 20, y: 5 }, null, null] }
  ];

  assert.deepEqual(visibleDataTimestampBounds(timestamps, datasets), { min: 10, max: 30 });
  assert.deepEqual(visibleDataTimestampBounds(timestamps, datasets, {
    isDatasetVisible: (_dataset, index) => index === 0
  }), { min: 20, max: 40 });
  assert.equal(visibleDataTimestampBounds(timestamps, datasets, {
    isDatasetVisible: () => false
  }), null);
  assert.deepEqual(datasets[1].data, [1, null, 3, null]);

  assert.throws(() => visibleDataTimestampBounds(timestamps, [{ data: [1] }]), /align/);
  assert.throws(() => visibleDataTimestampBounds(timestamps, "datasets"), /array/);
});

test("clamping shifts ranges at boundaries and constrains overlarge ranges", () => {
  const bounds = { min: 0, max: 100 };
  assert.deepEqual(clampRange({ min: 20, max: 60 }, bounds), { min: 20, max: 60 });
  assert.deepEqual(clampRange({ min: -10, max: 30 }, bounds), { min: 0, max: 40 });
  assert.deepEqual(clampRange({ min: 80, max: 130 }, bounds), { min: 50, max: 100 });
  assert.deepEqual(clampRange({ min: -100, max: 300 }, bounds), bounds);
  assert.deepEqual(clampRange({ min: 80, max: 20 }, bounds), { min: 20, max: 80 });
  assert.equal(clampRange({ min: 1, max: 2 }, null), null);
});

test("clamping enforces minRange without exceeding data boundaries", () => {
  const bounds = { min: 0, max: 100 };
  assert.deepEqual(clampRange({ min: 48, max: 52 }, bounds, { minRange: 20 }), { min: 40, max: 60 });
  assert.deepEqual(clampRange({ min: 0, max: 5 }, bounds, { minRange: 20 }), { min: 0, max: 20 });
  assert.deepEqual(clampRange({ min: 90, max: 95 }, bounds, { minRange: 200 }), bounds);
  assert.deepEqual(clampRange({ min: 40, max: 60 }, { min: 12, max: 12 }, { minRange: 20 }), { min: 12, max: 12 });

  assert.throws(() => clampRange({ min: 1, max: 2 }, bounds, { minRange: -1 }), /negative/);
  assert.throws(() => clampRange({ min: 1, max: Number.NaN }, bounds), /finite number/);
});

test("zoom keeps the anchor position and respects limits", () => {
  const bounds = { min: 0, max: 100 };
  assert.deepEqual(zoomRange({ min: 20, max: 80 }, 0.5, 50, bounds), { min: 35, max: 65 });
  assert.deepEqual(zoomRange({ min: 20, max: 80 }, 0.5, 20, bounds), { min: 20, max: 50 });
  assert.deepEqual(zoomRange({ min: 20, max: 80 }, 2, 50, bounds), bounds);
  assert.deepEqual(zoomRange({ min: 20, max: 80 }, 0.01, 50, bounds, { minRange: 10 }), { min: 45, max: 55 });
  assert.deepEqual(zoomRange({ min: 0, max: 50 }, 0.5, -100, bounds), { min: 0, max: 25 });
  assert.deepEqual(zoomRange({ min: 42, max: 42 }, 0.5, 42, { min: 42, max: 42 }), { min: 42, max: 42 });
  assert.equal(zoomRange({ min: 0, max: 1 }, 0.5, 0, null), null);

  assert.throws(() => zoomRange({ min: 0, max: 1 }, 0, 0, bounds), /greater than zero/);
  assert.throws(() => zoomRange({ min: 0, max: 1 }, 1, Number.NaN, bounds), /finite number/);
});

test("pan preserves the visible width when it reaches either boundary", () => {
  const bounds = { min: 0, max: 100 };
  assert.deepEqual(panRange({ min: 20, max: 60 }, 30, bounds), { min: 50, max: 90 });
  assert.deepEqual(panRange({ min: 20, max: 60 }, 100, bounds), { min: 60, max: 100 });
  assert.deepEqual(panRange({ min: 20, max: 60 }, -100, bounds), { min: 0, max: 40 });
  assert.deepEqual(panRange({ min: 0, max: 100 }, 25, bounds), bounds);
  assert.deepEqual(panRange({ min: 50, max: 50 }, 100, bounds, { minRange: 20 }), { min: 80, max: 100 });
  assert.equal(panRange({ min: 0, max: 1 }, 1, null), null);

  assert.throws(() => panRange({ min: 0, max: 1 }, Number.NEGATIVE_INFINITY, bounds), /finite number/);
});

test("presets end at the latest point and honor duration limits", () => {
  const bounds = { min: 0, max: 100 };
  assert.deepEqual(presetRange(bounds, 30), { min: 70, max: 100 });
  assert.deepEqual(presetRange(bounds, 200), bounds);
  assert.deepEqual(presetRange(bounds, 10, { minRange: 40 }), { min: 60, max: 100 });
  assert.deepEqual(presetRange({ min: 42, max: 42 }, 30), { min: 42, max: 42 });
  assert.equal(presetRange(null, 30), null);

  assert.throws(() => presetRange(bounds, 0), /greater than zero/);
  assert.throws(() => presetRange(bounds, Number.NaN), /finite number/);
});

test("visible point indexes are inclusive and refer to the original array", () => {
  const timestamps = [50, 10, 30, 70, 50];
  assert.deepEqual(visiblePointIndexes(timestamps, { min: 20, max: 50 }), [0, 2, 4]);
  assert.deepEqual(visiblePointIndexes(timestamps, { min: 50, max: 20 }), [0, 2, 4]);
  assert.deepEqual(visiblePointIndexes(timestamps, { min: 80, max: 90 }), []);
  assert.deepEqual(visiblePointIndexes([], null), []);

  assert.throws(() => visiblePointIndexes([10, Number.NaN], { min: 0, max: 20 }), /finite number/);
  assert.throws(() => visiblePointIndexes([10], { min: 0, max: Number.POSITIVE_INFINITY }), /finite number/);
});
