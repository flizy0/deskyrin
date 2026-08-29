function finiteNumber(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${label} must be a finite number`);
  }
  return value;
}

function timestampList(values) {
  if (!Array.isArray(values)) {
    throw new TypeError("Timestamps must be an array");
  }
  return values.map((value, index) => finiteNumber(value, `Timestamp at index ${index}`));
}

function normalizedRange(range, label) {
  if (!range || typeof range !== "object" || Array.isArray(range)) {
    throw new TypeError(`${label} must be an object with finite min and max values`);
  }

  const first = finiteNumber(range.min, `${label}.min`);
  const second = finiteNumber(range.max, `${label}.max`);
  return first <= second ? { min: first, max: second } : { min: second, max: first };
}

function normalizedBounds(bounds) {
  return bounds === null ? null : normalizedRange(bounds, "Bounds");
}

function optionMinRange(options) {
  if (options === undefined) return 0;
  if (!options || typeof options !== "object" || Array.isArray(options)) {
    throw new TypeError("Options must be an object");
  }

  const minRange = options.minRange ?? 0;
  finiteNumber(minRange, "minRange");
  if (minRange < 0) {
    throw new RangeError("minRange must not be negative");
  }
  return minRange;
}

/**
 * Validate numeric timestamps and return an ascending copy without mutating the input.
 */
export function normalizeTimestamps(values) {
  return timestampList(values).sort((left, right) => left - right);
}

/**
 * Return the inclusive timestamp boundaries, or null when there are no points.
 */
export function timestampBounds(values) {
  const timestamps = normalizeTimestamps(values);
  if (timestamps.length === 0) return null;
  return { min: timestamps[0], max: timestamps[timestamps.length - 1] };
}

function plottedValue(point) {
  return point && typeof point === "object" && !Array.isArray(point) ? point.y : point;
}

/**
 * Return exact boundaries of finite points in visible datasets.
 * Null values remain gaps; hidden datasets cannot enlarge the visible domain.
 */
export function visibleDataTimestampBounds(values, datasets, options = {}) {
  const timestamps = timestampList(values);
  if (!Array.isArray(datasets)) throw new TypeError("Datasets must be an array");
  if (!options || typeof options !== "object" || Array.isArray(options)) {
    throw new TypeError("Options must be an object");
  }
  const isDatasetVisible = options.isDatasetVisible
    ?? ((dataset) => dataset?.hidden !== true);
  if (typeof isDatasetVisible !== "function") throw new TypeError("isDatasetVisible must be a function");

  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  datasets.forEach((dataset, datasetIndex) => {
    if (!dataset || typeof dataset !== "object" || Array.isArray(dataset)) {
      throw new TypeError(`Dataset at index ${datasetIndex} must be an object`);
    }
    if (!Array.isArray(dataset.data) || dataset.data.length !== timestamps.length) {
      throw new TypeError(`Dataset at index ${datasetIndex} must align with its timestamps`);
    }
    if (!isDatasetVisible(dataset, datasetIndex)) return;
    dataset.data.forEach((point, pointIndex) => {
      if (!Number.isFinite(plottedValue(point))) return;
      const timestamp = timestamps[pointIndex];
      min = Math.min(min, timestamp);
      max = Math.max(max, timestamp);
    });
  });

  return Number.isFinite(min) ? { min, max } : null;
}

/**
 * Fit a range inside the data boundaries, shifting it before reducing its width.
 */
export function clampRange(range, bounds, options) {
  const minRange = optionMinRange(options);
  const boundary = normalizedBounds(bounds);
  if (boundary === null) return null;

  const candidate = normalizedRange(range, "Range");
  const availableWidth = boundary.max - boundary.min;
  if (availableWidth === 0) return { ...boundary };

  const requiredWidth = Math.min(minRange, availableWidth);
  const candidateWidth = candidate.max - candidate.min;
  const width = Math.min(availableWidth, Math.max(candidateWidth, requiredWidth));
  if (width >= availableWidth) return { ...boundary };

  let min = candidate.min;
  let max = candidate.max;
  if (candidateWidth !== width) {
    const center = candidate.min + candidateWidth / 2;
    min = center - width / 2;
    max = min + width;
  }

  if (min < boundary.min) {
    min = boundary.min;
    max = min + width;
  }
  if (max > boundary.max) {
    max = boundary.max;
    min = max - width;
  }

  return { min, max };
}

/**
 * Scale a range around an anchor. A scale below 1 zooms in; above 1 zooms out.
 */
export function zoomRange(range, scale, anchor, bounds, options) {
  finiteNumber(scale, "Zoom scale");
  if (scale <= 0) throw new RangeError("Zoom scale must be greater than zero");
  finiteNumber(anchor, "Zoom anchor");

  const minRange = optionMinRange(options);
  const boundary = normalizedBounds(bounds);
  if (boundary === null) return null;

  const current = clampRange(range, boundary, { minRange });
  const availableWidth = boundary.max - boundary.min;
  const currentWidth = current.max - current.min;
  if (availableWidth === 0 || currentWidth === 0) return current;

  const requiredWidth = Math.min(minRange, availableWidth);
  const scaledWidth = currentWidth * scale;
  const width = Math.min(availableWidth, Math.max(requiredWidth, scaledWidth));
  const boundedAnchor = Math.min(current.max, Math.max(current.min, anchor));
  const anchorRatio = (boundedAnchor - current.min) / currentWidth;
  const candidate = {
    min: boundedAnchor - width * anchorRatio,
    max: boundedAnchor + width * (1 - anchorRatio)
  };

  return clampRange(candidate, boundary, { minRange });
}

/**
 * Move a range by a timestamp delta while preserving its width at boundaries.
 */
export function panRange(range, delta, bounds, options) {
  finiteNumber(delta, "Pan delta");

  const minRange = optionMinRange(options);
  const boundary = normalizedBounds(bounds);
  if (boundary === null) return null;

  const current = clampRange(range, boundary, { minRange });
  return clampRange({ min: current.min + delta, max: current.max + delta }, boundary, { minRange });
}

/**
 * Create a duration preset whose right edge is the latest data timestamp.
 */
export function presetRange(bounds, duration, options) {
  finiteNumber(duration, "Preset duration");
  if (duration <= 0) throw new RangeError("Preset duration must be greater than zero");

  const minRange = optionMinRange(options);
  const boundary = normalizedBounds(bounds);
  if (boundary === null) return null;

  const availableWidth = boundary.max - boundary.min;
  const width = Math.min(availableWidth, Math.max(duration, Math.min(minRange, availableWidth)));
  return { min: boundary.max - width, max: boundary.max };
}

/**
 * Return indexes from the original input whose timestamps are inside an inclusive range.
 */
export function visiblePointIndexes(values, range) {
  const timestamps = timestampList(values);
  if (timestamps.length === 0 && range === null) return [];

  const visibleRange = normalizedRange(range, "Range");
  const indexes = [];
  for (let index = 0; index < timestamps.length; index += 1) {
    if (timestamps[index] >= visibleRange.min && timestamps[index] <= visibleRange.max) {
      indexes.push(index);
    }
  }
  return indexes;
}
