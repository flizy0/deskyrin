export class PipelineError extends Error {
  constructor(code, message, options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = "PipelineError";
    this.code = code;
    this.sourceId = options.sourceId;
    this.retryable = options.retryable ?? false;
    this.details = options.details;
  }
}

export function asPipelineError(error, fallback = {}) {
  if (error instanceof PipelineError) {
    return error;
  }
  return new PipelineError(
    fallback.code || "UNEXPECTED_ERROR",
    fallback.message || "Unexpected pipeline error",
    {
      sourceId: fallback.sourceId,
      retryable: fallback.retryable ?? false,
      cause: error
    }
  );
}

export function safeError(error) {
  const normalized = asPipelineError(error);
  return {
    code: normalized.code,
    message: normalized.message,
    retryable: normalized.retryable,
    ...(normalized.sourceId ? { sourceId: normalized.sourceId } : {})
  };
}

