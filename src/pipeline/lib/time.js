import { PipelineError } from "./errors.js";

const DAY_MS = 86_400_000;

export function isoTimestamp(value, label = "timestamp") {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new PipelineError("INVALID_TIMESTAMP", `${label} must be a valid timestamp`);
  }
  return date.toISOString();
}

export function epochSecondsToIso(value, label = "epoch seconds") {
  if (!Number.isInteger(value) || value < 0) {
    throw new PipelineError("INVALID_TIMESTAMP", `${label} must be a non-negative integer`);
  }
  return isoTimestamp(value * 1_000, label);
}

export function utcDateKey(value) {
  return isoTimestamp(value).slice(0, 10);
}

export function parseUtcDateKey(value, label = "date") {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new PipelineError("INVALID_DATE", `${label} must use YYYY-MM-DD`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new PipelineError("INVALID_DATE", `${label} must be a real UTC calendar date`);
  }
  return date;
}

export function isCompletedUtcDate(dateKey, now) {
  return parseUtcDateKey(dateKey).getTime() < parseUtcDateKey(utcDateKey(now)).getTime();
}

export function areAdjacentUtcDates(previous, current) {
  return parseUtcDateKey(current).getTime() - parseUtcDateKey(previous).getTime() === DAY_MS;
}

export function ageMs(observedAt, now) {
  const age = new Date(now).getTime() - new Date(observedAt).getTime();
  if (!Number.isFinite(age)) {
    throw new PipelineError("INVALID_TIMESTAMP", "Cannot calculate timestamp age");
  }
  return age;
}

export function assertFreshObservation(observedAt, now, maxAgeMs, label = "observation") {
  const age = ageMs(observedAt, now);
  if (age < -5 * 60_000) throw new PipelineError("FUTURE_OBSERVATION", `${label} is unexpectedly in the future`);
  if (age > maxAgeMs) throw new PipelineError("STALE_PROVIDER_DATA", `${label} exceeds its freshness budget`);
  return observedAt;
}

export function addMs(value, milliseconds) {
  return isoTimestamp(new Date(value).getTime() + milliseconds);
}

export function isDue(lastSuccessAt, intervalMs, now) {
  if (!lastSuccessAt) return true;
  return ageMs(lastSuccessAt, now) >= intervalMs;
}

export function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
