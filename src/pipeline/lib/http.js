import { PipelineError, asPipelineError } from "./errors.js";
import { sleep } from "./time.js";
import { isInteger, isSafeNumber, parse as parseLosslessJson } from "lossless-json";

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

export function parseJsonPreservingIntegers(text) {
  return parseLosslessJson(text, null, {
    parseNumber: (token) => isInteger(token) && !isSafeNumber(token) ? BigInt(token) : Number(token)
  });
}

function retryAfterMs(value, now = Date.now()) {
  if (!value) return undefined;
  if (/^\d+$/.test(value.trim())) return Number(value.trim()) * 1_000;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? Math.max(0, timestamp - now) : undefined;
}

async function readLimitedBody(response, maxBytes) {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new PipelineError("RESPONSE_TOO_LARGE", `Response exceeds ${maxBytes} bytes`);
  }
  if (!response.body) return Buffer.alloc(0);

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new PipelineError("RESPONSE_TOO_LARGE", `Response exceeds ${maxBytes} bytes`);
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, total);
}

function assertAllowedUrl(input, allowedHosts) {
  let url;
  try {
    url = new URL(input);
  } catch (error) {
    throw new PipelineError("INVALID_URL", "Source URL is invalid", { cause: error });
  }
  if (url.protocol !== "https:") {
    throw new PipelineError("INSECURE_URL", "Source URL must use HTTPS");
  }
  if (allowedHosts && !allowedHosts.includes(url.hostname)) {
    throw new PipelineError("UNAPPROVED_HOST", `Source host ${url.hostname} is not approved`);
  }
  return url;
}

export function createHttpClient(options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const attempts = options.attempts ?? 3;
  const retryDelaysMs = options.retryDelaysMs || [1_000, 3_000];
  const maxRetryAfterMs = options.maxRetryAfterMs ?? 10_000;
  const allowedHosts = options.allowedHosts;
  const userAgent = options.userAgent || "deskyrin/1.0 (+https://github.com/flizy0/deskyrin)";

  async function request(input, requestOptions = {}) {
    const url = assertAllowedUrl(input, requestOptions.allowedHosts || allowedHosts);
    const maxAttempts = requestOptions.attempts ?? attempts;
    const timeoutMs = requestOptions.timeoutMs ?? 15_000;
    const maxBytes = requestOptions.maxBytes ?? 10 * 1024 * 1024;
    const responseType = requestOptions.responseType || "json";
    const sourceId = requestOptions.sourceId;
    const expectedContentTypes = requestOptions.expectedContentTypes || [];
    let finalError;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const response = await fetchImpl(url, {
          method: requestOptions.method || "GET",
          headers: {
            accept: responseType === "json" ? "application/json" : "text/html, application/xml, text/xml, text/plain",
            "accept-language": "en",
            "user-agent": userAgent,
            ...(requestOptions.headers || {})
          },
          body: requestOptions.body,
          signal: AbortSignal.timeout(timeoutMs),
          redirect: "follow"
        });

        if (response.url) {
          assertAllowedUrl(response.url, requestOptions.allowedHosts || allowedHosts);
        }

        if (!response.ok) {
          const retryable = RETRYABLE_STATUS.has(response.status);
          throw new PipelineError(
            `HTTP_${response.status}`,
            `Source returned HTTP ${response.status}`,
            {
              sourceId,
              retryable,
              details: { retryAfter: response.headers.get("retry-after") }
            }
          );
        }

        const contentType = (response.headers.get("content-type") || "").toLowerCase();
        if (expectedContentTypes.length > 0 && !expectedContentTypes.some((type) => contentType.includes(type))) {
          throw new PipelineError("UNEXPECTED_CONTENT_TYPE", "Source returned an unexpected content type", { sourceId });
        }

        const buffer = await readLimitedBody(response, maxBytes);
        const text = buffer.toString("utf8");
        if (responseType === "text") return text;
        try {
          return parseJsonPreservingIntegers(text);
        } catch (error) {
          throw new PipelineError("INVALID_JSON", "Source returned invalid JSON", { sourceId, cause: error });
        }
      } catch (error) {
        let normalized;
        if (error?.name === "TimeoutError" || error?.name === "AbortError") {
          normalized = new PipelineError("HTTP_TIMEOUT", "Source request timed out", {
            sourceId,
            retryable: true,
            cause: error
          });
        } else if (error instanceof TypeError) {
          const causeMessage = error.cause?.message || error.message;
          normalized = new PipelineError("HTTP_NETWORK_ERROR", `Source network request failed: ${causeMessage}`, {
            sourceId,
            retryable: true,
            cause: error
          });
        } else {
          normalized = asPipelineError(error, { sourceId });
        }
        finalError = normalized;

        if (!normalized.retryable || attempt >= maxAttempts) break;
        const headerDelay = retryAfterMs(normalized.details?.retryAfter);
        const defaultDelay = retryDelaysMs[Math.min(attempt - 1, retryDelaysMs.length - 1)] || 0;
        await sleep(Math.min(headerDelay ?? defaultDelay, maxRetryAfterMs));
      }
    }

    throw finalError;
  }

  return Object.freeze({ request });
}
