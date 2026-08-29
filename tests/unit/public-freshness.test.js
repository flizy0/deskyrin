import assert from "node:assert/strict";
import test from "node:test";
import {
  FreshnessCheckError,
  checkPublicFreshness,
  validatePublicSnapshot
} from "../../scripts/check-public-freshness.js";
import { METHODOLOGY_VERSION, SCHEMA_VERSION } from "../../src/pipeline/config.js";

const NOW = Date.parse("2026-08-29T12:00:00.000Z");

function publicSnapshot(overrides = {}) {
  return {
    schemaVersion: SCHEMA_VERSION,
    methodologyVersion: METHODOLOGY_VERSION,
    updatedAt: "2026-08-29T11:00:00.000Z",
    updateStatus: "partial",
    sources: { solanaRpc: {} },
    network: {},
    validators: {},
    economics: {},
    ecosystem: {},
    alertChecks: [],
    alerts: [],
    ...overrides
  };
}

function jsonResponse(body, init = {}) {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json", ...init.headers },
    ...init
  });
}

function hasCode(code) {
  return (error) => error instanceof FreshnessCheckError && error.code === code;
}

test("public snapshot envelope accepts fresh partial data", () => {
  const result = validatePublicSnapshot(publicSnapshot(), { nowMs: NOW, maxAgeMinutes: 180 });
  assert.equal(result.ageMinutes, 60);
  assert.equal(result.updateStatus, "partial");
});

test("public snapshot envelope rejects stale and future timestamps", () => {
  assert.throws(
    () => validatePublicSnapshot(publicSnapshot({ updatedAt: "2026-08-29T08:59:59.000Z" }), { nowMs: NOW, maxAgeMinutes: 180 }),
    hasCode("STALE_DATA")
  );
  assert.throws(
    () => validatePublicSnapshot(publicSnapshot({ updatedAt: "2026-08-29T12:05:01.000Z" }), { nowMs: NOW }),
    hasCode("FUTURE_DATA")
  );
});

test("public snapshot envelope rejects schema drift", () => {
  assert.throws(
    () => validatePublicSnapshot(publicSnapshot({ schemaVersion: "999.0.0" }), { nowMs: NOW }),
    hasCode("SCHEMA_MISMATCH")
  );
  assert.throws(
    () => validatePublicSnapshot(publicSnapshot({ network: null }), { nowMs: NOW }),
    hasCode("INVALID_SCHEMA")
  );
});

test("watchdog reports a valid deployed response", async () => {
  const result = await checkPublicFreshness({
    url: "https://deskyrin.example/data.json",
    nowMs: NOW,
    maxAgeMinutes: 180,
    fetchImpl: async () => jsonResponse(publicSnapshot())
  });
  assert.equal(result.ok, true);
  assert.equal(result.updatedAt, "2026-08-29T11:00:00.000Z");
});

test("watchdog rejects HTTP, content-type, and JSON failures", async () => {
  await assert.rejects(
    checkPublicFreshness({ url: "https://deskyrin.example/data.json", fetchImpl: async () => new Response("down", { status: 503 }) }),
    hasCode("HTTP_ERROR")
  );
  await assert.rejects(
    checkPublicFreshness({ url: "https://deskyrin.example/data.json", fetchImpl: async () => new Response("{}", { headers: { "content-type": "text/html" } }) }),
    hasCode("INVALID_CONTENT_TYPE")
  );
  await assert.rejects(
    checkPublicFreshness({ url: "https://deskyrin.example/data.json", fetchImpl: async () => jsonResponse("{") }),
    hasCode("INVALID_JSON")
  );
});

test("watchdog turns a request timeout into a fetch failure", async () => {
  const fetchImpl = async (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  });

  await assert.rejects(
    checkPublicFreshness({
      url: "https://deskyrin.example/data.json",
      timeoutMs: 1,
      fetchImpl
    }),
    hasCode("FETCH_FAILED")
  );
});

test("watchdog rejects an oversized response body", async () => {
  const oversizedBody = "x".repeat(2 * 1024 * 1024 + 1);
  await assert.rejects(
    checkPublicFreshness({
      url: "https://deskyrin.example/data.json",
      fetchImpl: async () => jsonResponse(oversizedBody)
    }),
    hasCode("RESPONSE_TOO_LARGE")
  );
});

test("watchdog requires a configured HTTPS URL", async () => {
  await assert.rejects(checkPublicFreshness({}), hasCode("MISSING_URL"));
  await assert.rejects(checkPublicFreshness({ url: "http://deskyrin.example/data.json" }), hasCode("INVALID_URL"));
});
