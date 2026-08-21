import { PipelineError } from "./errors.js";
import { finiteNumber } from "./numbers.js";

export function median(values, label = "values") {
  if (!Array.isArray(values) || values.length === 0) {
    throw new PipelineError("EMPTY_SAMPLE", `${label} must contain at least one value`);
  }
  const sorted = values.map((value, index) => finiteNumber(value, `${label}[${index}]`)).sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function percentageChange(current, reference) {
  finiteNumber(current, "current");
  finiteNumber(reference, "reference", { min: Number.MIN_VALUE });
  return (current / reference - 1) * 100;
}

export function durationWeightedRate(rows, numeratorKey, durationKey = "samplePeriodSecs") {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new PipelineError("EMPTY_SAMPLE", "Rate rows must not be empty");
  }
  let numerator = 0;
  let duration = 0;
  for (const [index, row] of rows.entries()) {
    numerator += finiteNumber(row[numeratorKey], `rows[${index}].${numeratorKey}`, { min: 0 });
    duration += finiteNumber(row[durationKey], `rows[${index}].${durationKey}`, { min: Number.MIN_VALUE });
  }
  return { value: numerator / duration, numerator, duration };
}

export function slotIntervalMs(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new PipelineError("EMPTY_SAMPLE", "Slot rows must not be empty");
  }
  let seconds = 0;
  let slots = 0;
  for (const [index, row] of rows.entries()) {
    seconds += finiteNumber(row.samplePeriodSecs, `rows[${index}].samplePeriodSecs`, { min: Number.MIN_VALUE });
    slots += finiteNumber(row.numSlots, `rows[${index}].numSlots`, { min: Number.MIN_VALUE });
  }
  return { value: (seconds / slots) * 1_000, seconds, slots };
}

