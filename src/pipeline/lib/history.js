import { PipelineError } from "./errors.js";

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function uniqueByKey(points, key, label = "data") {
  const byKey = new Map();
  for (const point of points) {
    const pointKey = key(point);
    if (typeof pointKey !== "string" || pointKey.length === 0) {
      throw new PipelineError("INVALID_HISTORY_KEY", `${label} point has no canonical key`);
    }
    if (byKey.has(pointKey) && !sameValue(byKey.get(pointKey), point)) {
      throw new PipelineError("CONFLICTING_DUPLICATE", `${label} contains conflicting duplicate ${pointKey}`);
    }
    byKey.set(pointKey, point);
  }
  return [...byKey.values()];
}

export function normalizeHistory(points, options) {
  const { key, limit } = options;
  if (!Array.isArray(points)) {
    throw new PipelineError("INVALID_HISTORY", "History must be an array");
  }
  if (!Number.isInteger(limit) || limit < 1) {
    throw new PipelineError("INVALID_HISTORY_LIMIT", "History limit must be a positive integer");
  }

  return uniqueByKey(points, key, "History")
    .sort((left, right) => key(left) < key(right) ? -1 : key(left) > key(right) ? 1 : 0)
    .slice(-limit);
}

export function appendHistory(previous, nextPoint, options) {
  return normalizeHistory([...(previous || []), nextPoint], options);
}
