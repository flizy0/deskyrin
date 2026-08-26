import { PipelineError } from "./errors.js";

export const LAMPORTS_PER_SOL = 1_000_000_000n;

export function finiteNumber(value, label, options = {}) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new PipelineError("INVALID_NUMBER", `${label} must be a finite number`);
  }
  if (options.integer && !Number.isInteger(value)) {
    throw new PipelineError("INVALID_INTEGER", `${label} must be an integer`);
  }
  if (options.min !== undefined && value < options.min) {
    throw new PipelineError("NUMBER_OUT_OF_RANGE", `${label} must be at least ${options.min}`);
  }
  if (options.max !== undefined && value > options.max) {
    throw new PipelineError("NUMBER_OUT_OF_RANGE", `${label} must be at most ${options.max}`);
  }
  return value;
}

export function decimalBigInt(value, label, options = {}) {
  const text = typeof value === "bigint" ? value.toString() : String(value);
  if (!/^(0|[1-9]\d*)$/.test(text)) {
    throw new PipelineError("INVALID_DECIMAL_INTEGER", `${label} must be an unsigned decimal integer`);
  }
  const parsed = BigInt(text);
  if (options.positive && parsed <= 0n) {
    throw new PipelineError("INTEGER_OUT_OF_RANGE", `${label} must be positive`);
  }
  return parsed;
}

export function lamportsToSolNumber(value) {
  const lamports = decimalBigInt(value, "lamports");
  const whole = lamports / LAMPORTS_PER_SOL;
  const fraction = lamports % LAMPORTS_PER_SOL;
  return Number(whole) + Number(fraction) / Number(LAMPORTS_PER_SOL);
}

export function nearlyEqual(left, right, tolerance = 1e-9) {
  if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
  return Math.abs(left - right) <= tolerance * Math.max(1, Math.abs(left), Math.abs(right));
}
