#!/usr/bin/env node

import { pathToFileURL } from "node:url";
import { SCHEMA_VERSION } from "../src/pipeline/config.js";

const MINUTE_MS = 60_000;
const DEFAULT_MAX_AGE_MINUTES = 180;
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const FUTURE_TOLERANCE_MS = 5 * MINUTE_MS;

export class FreshnessCheckError extends Error {
  constructor(code, message, options) {
    super(message, options);
    this.name = "FreshnessCheckError";
    this.code = code;
  }
}

function fail(code, message, options) {
  throw new FreshnessCheckError(code, message, options);
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function positiveInteger(value, fallback, label, maximum) {
  if (value === undefined || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > maximum) {
    fail("INVALID_CONFIGURATION", `${label} must be an integer between 1 and ${maximum}`);
  }
  return parsed;
}

function publicHttpsUrl(value) {
  if (!value) fail("MISSING_URL", "Set PUBLIC_DATA_URL to the deployed /data.json URL");
  let parsed;
  try {
    parsed = new URL(value);
  } catch (error) {
    fail("INVALID_URL", "PUBLIC_DATA_URL must be a valid URL", { cause: error });
  }
  if (parsed.protocol !== "https:") fail("INVALID_URL", "PUBLIC_DATA_URL must use HTTPS");
  return parsed.toString();
}

function canonicalIsoTime(value) {
  if (typeof value !== "string") return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
}

export function validatePublicSnapshot(snapshot, options = {}) {
  const expectedSchemaVersion = options.expectedSchemaVersion ?? SCHEMA_VERSION;
  const maxAgeMinutes = positiveInteger(options.maxAgeMinutes, DEFAULT_MAX_AGE_MINUTES, "MAX_DATA_AGE_MINUTES", 10_080);
  const nowMs = options.nowMs ?? Date.now();

  if (!isRecord(snapshot)) fail("INVALID_SCHEMA", "Public data must be a JSON object");
  if (snapshot.schemaVersion !== expectedSchemaVersion) {
    fail("SCHEMA_MISMATCH", `Expected schema ${expectedSchemaVersion}, received ${String(snapshot.schemaVersion)}`);
  }
  if (typeof snapshot.methodologyVersion !== "string" || snapshot.methodologyVersion.length === 0) {
    fail("INVALID_SCHEMA", "methodologyVersion is missing");
  }
  if (!canonicalIsoTime(snapshot.updatedAt)) fail("INVALID_UPDATED_AT", "updatedAt must be a canonical ISO timestamp");
  if (!new Set(["complete", "partial"]).has(snapshot.updateStatus)) {
    fail("INVALID_SCHEMA", "updateStatus must be complete or partial");
  }

  for (const field of ["sources", "network", "validators", "economics", "ecosystem"]) {
    if (!isRecord(snapshot[field])) fail("INVALID_SCHEMA", `${field} must be an object`);
  }
  if (Object.keys(snapshot.sources).length === 0) fail("INVALID_SCHEMA", "sources must not be empty");
  if (!Array.isArray(snapshot.alertChecks) || !Array.isArray(snapshot.alerts)) {
    fail("INVALID_SCHEMA", "alertChecks and alerts must be arrays");
  }

  const updatedAtMs = Date.parse(snapshot.updatedAt);
  const ageMs = nowMs - updatedAtMs;
  if (ageMs < -FUTURE_TOLERANCE_MS) {
    fail("FUTURE_DATA", `updatedAt is ${Math.ceil(Math.abs(ageMs) / MINUTE_MS)} minutes in the future`);
  }
  if (ageMs > maxAgeMinutes * MINUTE_MS) {
    fail("STALE_DATA", `Public data is ${Math.floor(ageMs / MINUTE_MS)} minutes old; limit is ${maxAgeMinutes}`);
  }

  return {
    schemaVersion: snapshot.schemaVersion,
    methodologyVersion: snapshot.methodologyVersion,
    updatedAt: snapshot.updatedAt,
    updateStatus: snapshot.updateStatus,
    ageMinutes: Math.max(0, Math.floor(ageMs / MINUTE_MS))
  };
}

export async function checkPublicFreshness(options = {}) {
  const url = publicHttpsUrl(options.url);
  const timeoutMs = positiveInteger(options.timeoutMs, DEFAULT_TIMEOUT_MS, "PUBLIC_DATA_TIMEOUT_MS", 60_000);
  const fetchImpl = options.fetchImpl ?? fetch;
  let response;
  try {
    response = await fetchImpl(url, {
      headers: { accept: "application/json", "cache-control": "no-cache" },
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch (error) {
    fail("FETCH_FAILED", `Could not fetch public data: ${error.message}`, { cause: error });
  }

  if (!response?.ok) fail("HTTP_ERROR", `Public data returned HTTP ${response?.status ?? "unknown"}`);
  const contentType = response.headers?.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("json")) {
    fail("INVALID_CONTENT_TYPE", `Expected JSON content type, received ${contentType || "none"}`);
  }

  const declaredLength = Number(response.headers?.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
    fail("RESPONSE_TOO_LARGE", `Public data exceeds ${MAX_RESPONSE_BYTES} bytes`);
  }

  const body = await response.text();
  if (Buffer.byteLength(body, "utf8") > MAX_RESPONSE_BYTES) {
    fail("RESPONSE_TOO_LARGE", `Public data exceeds ${MAX_RESPONSE_BYTES} bytes`);
  }

  let snapshot;
  try {
    snapshot = JSON.parse(body);
  } catch (error) {
    fail("INVALID_JSON", "Public data is not valid JSON", { cause: error });
  }

  return {
    ok: true,
    url,
    ...validatePublicSnapshot(snapshot, options)
  };
}

async function main() {
  try {
    const result = await checkPublicFreshness({
      url: process.env.PUBLIC_DATA_URL || process.argv[2],
      maxAgeMinutes: process.env.MAX_DATA_AGE_MINUTES,
      timeoutMs: process.env.PUBLIC_DATA_TIMEOUT_MS,
      expectedSchemaVersion: process.env.EXPECTED_SCHEMA_VERSION || SCHEMA_VERSION
    });
    console.log(JSON.stringify(result));
  } catch (error) {
    const code = error instanceof FreshnessCheckError ? error.code : "WATCHDOG_FAILED";
    console.error(`[freshness] ${code}: ${error.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
