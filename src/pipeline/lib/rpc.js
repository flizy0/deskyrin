import { PipelineError, asPipelineError } from "./errors.js";
import { sleep } from "./time.js";

function rpcError(value, sourceId) {
  if (!value || typeof value !== "object" || !Number.isInteger(value.code) || typeof value.message !== "string") {
    return new PipelineError("INVALID_RPC_ERROR", "RPC returned a malformed error object", { sourceId });
  }
  const nonRetryable = new Set([-32700, -32600, -32601, -32602]);
  return new PipelineError(`RPC_${value.code}`, `RPC error ${value.code}: ${value.message}`, {
    sourceId,
    retryable: !nonRetryable.has(value.code) && (value.code === -32603 || (value.code <= -32000 && value.code >= -32099))
  });
}

function parseEnvelope(envelope, id, sourceId) {
  if (!envelope || typeof envelope !== "object" || envelope.jsonrpc !== "2.0" || envelope.id !== id) {
    throw new PipelineError("INVALID_RPC_ENVELOPE", "RPC returned an invalid response envelope", { sourceId });
  }
  if (Object.hasOwn(envelope, "error")) throw rpcError(envelope.error, sourceId);
  if (!Object.hasOwn(envelope, "result")) {
    throw new PipelineError("MISSING_RPC_RESULT", "RPC response has neither result nor error", { sourceId });
  }
  return envelope.result;
}

export function createRpcClient(options) {
  const { url, http, sourceId = "solanaRpc" } = options;
  const defaultRetryDelaysMs = options.retryDelaysMs || [1_000, 3_000];
  let sequence = 0;

  async function post(body, requestOptions = {}) {
    return http.request(url, {
      sourceId,
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      responseType: "json",
      expectedContentTypes: ["application/json"],
      attempts: 1,
      timeoutMs: requestOptions.timeoutMs,
      maxBytes: requestOptions.maxBytes
    });
  }

  async function call(method, params = [], requestOptions = {}) {
    const maxAttempts = requestOptions.attempts ?? 3;
    let finalError;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const id = `${method}-${++sequence}`;
      try {
        const envelope = await post({ jsonrpc: "2.0", id, method, params }, requestOptions);
        return parseEnvelope(envelope, id, sourceId);
      } catch (error) {
        finalError = asPipelineError(error, { sourceId });
        if (!finalError.retryable || attempt >= maxAttempts) break;
        await sleep(requestOptions.retryDelaysMs?.[attempt - 1] ?? defaultRetryDelaysMs[attempt - 1] ?? attempt * 1_000);
      }
    }
    throw finalError;
  }

  async function batchWithRetry(requests, requestOptions, retryIndex) {
    if (!Array.isArray(requests) || requests.length === 0) {
      throw new PipelineError("EMPTY_RPC_BATCH", "RPC batch must not be empty", { sourceId });
    }
    const keys = new Set();
    const idToKey = new Map();
    const payload = requests.map((request) => {
      if (!request || typeof request.key !== "string" || keys.has(request.key)) {
        throw new PipelineError("INVALID_RPC_BATCH_KEY", "RPC batch keys must be unique strings", { sourceId });
      }
      keys.add(request.key);
      const id = `${request.key}-${++sequence}`;
      idToKey.set(id, request.key);
      return { jsonrpc: "2.0", id, method: request.method, params: request.params || [] };
    });

    let raw;
    try {
      raw = await post(payload, requestOptions);
    } catch (error) {
      const normalized = asPipelineError(error, { sourceId });
      const remainingAttempts = requestOptions.attempts ?? 3;
      if (normalized.retryable && remainingAttempts > 1) {
        const delays = requestOptions.retryDelaysMs || defaultRetryDelaysMs;
        await sleep(delays[Math.min(retryIndex, delays.length - 1)] ?? (retryIndex + 1) * 1_000);
        return batchWithRetry(requests, { ...requestOptions, attempts: remainingAttempts - 1 }, retryIndex + 1);
      }
      throw normalized;
    }
    if (!Array.isArray(raw)) {
      throw new PipelineError("INVALID_RPC_BATCH", "RPC batch response must be an array", { sourceId });
    }
    const outcomes = {};
    const seenIds = new Set();
    for (const envelope of raw) {
      const id = envelope?.id;
      if (typeof id !== "string" || !idToKey.has(id) || seenIds.has(id)) {
        throw new PipelineError("INVALID_RPC_BATCH_ID", "RPC batch returned an unknown or duplicate ID", { sourceId });
      }
      seenIds.add(id);
      const key = idToKey.get(id);
      try {
        outcomes[key] = { ok: true, value: parseEnvelope(envelope, id, sourceId) };
      } catch (error) {
        outcomes[key] = { ok: false, error: asPipelineError(error, { sourceId }) };
      }
    }
    for (const [id, key] of idToKey) {
      if (!seenIds.has(id)) {
        outcomes[key] = {
          ok: false,
          error: new PipelineError("MISSING_RPC_BATCH_ITEM", `RPC batch omitted ${key}`, { sourceId, retryable: true })
        };
      }
    }
    const retryableItem = Object.values(outcomes).find((outcome) => !outcome.ok && outcome.error.retryable);
    const remainingAttempts = requestOptions.attempts ?? 3;
    if (retryableItem && remainingAttempts > 1) {
      const delays = requestOptions.retryDelaysMs || defaultRetryDelaysMs;
      await sleep(delays[Math.min(retryIndex, delays.length - 1)] ?? (retryIndex + 1) * 1_000);
      return batchWithRetry(requests, { ...requestOptions, attempts: remainingAttempts - 1 }, retryIndex + 1);
    }
    return outcomes;
  }

  async function batch(requests, requestOptions = {}) {
    return batchWithRetry(requests, requestOptions, 0);
  }

  return Object.freeze({ call, batch });
}
