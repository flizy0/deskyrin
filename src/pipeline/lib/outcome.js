import { asPipelineError, safeError } from "./errors.js";
import { isoTimestamp } from "./time.js";

export async function captureOutcome(sourceId, now, operation) {
  const attemptedAt = isoTimestamp(now);
  try {
    const result = await operation();
    return {
      ok: true,
      value: result.value ?? result,
      attemptedAt,
      succeededAt: attemptedAt,
      ...(result.dataThrough ? { dataThrough: result.dataThrough } : {})
    };
  } catch (error) {
    const normalized = asPipelineError(error, { sourceId });
    return { ok: false, error: safeError(normalized), attemptedAt };
  }
}
