#!/usr/bin/env node
import { appendFile, readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { SCHEMA_VERSION } from "../src/pipeline/config.js";

const GRACE_MS = 5 * 60 * 1_000;
const SAFETY_AGE_MS = 75 * 60 * 1_000;

export function evaluateUpdateDue(snapshot, {
  eventName = "schedule",
  now = new Date(),
  expectedSchemaVersion = SCHEMA_VERSION
} = {}) {
  if (eventName === "workflow_dispatch") return { due: true, reason: "manual_dispatch" };
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
  if (!Number.isFinite(nowMs)) throw new TypeError("Update due check requires a valid clock");
  if (!snapshot || typeof snapshot !== "object" || snapshot.schemaVersion !== expectedSchemaVersion) {
    return { due: true, reason: "schema_migration" };
  }

  const updatedAt = Date.parse(snapshot.updatedAt);
  if (!Number.isFinite(updatedAt) || nowMs - updatedAt >= SAFETY_AGE_MS) {
    return { due: true, reason: "snapshot_age" };
  }
  const nextDueTimes = Object.values(snapshot.sources || {})
    .map((source) => Date.parse(source?.nextDueAt))
    .filter(Number.isFinite);
  if (nextDueTimes.length === 0) return { due: true, reason: "missing_source_schedule" };
  const nextDueAt = Math.min(...nextDueTimes);
  return nowMs >= nextDueAt - GRACE_MS
    ? { due: true, reason: "source_due", nextDueAt: new Date(nextDueAt).toISOString() }
    : { due: false, reason: "not_due", nextDueAt: new Date(nextDueAt).toISOString() };
}

async function main() {
  let snapshot;
  try {
    snapshot = JSON.parse(await readFile("public/data.json", "utf8"));
  } catch {
    snapshot = undefined;
  }
  const result = evaluateUpdateDue(snapshot, { eventName: process.env.GITHUB_EVENT_NAME });
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, `due=${result.due}\nreason=${result.reason}\n`, "utf8");
  }
  console.log(JSON.stringify(result));
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  try {
    await main();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
