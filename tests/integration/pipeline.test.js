import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { DEFAULT_CONFIG } from "../../src/pipeline/config.js";
import { parseCanonicalSnapshot } from "../../src/pipeline/contracts/canonical.js";
import { PipelineError } from "../../src/pipeline/lib/errors.js";
import { runUpdate } from "../../src/pipeline/update.js";

const unavailable = new PipelineError("FIXTURE_DOWN", "fixture source unavailable", { retryable: false });
const failingHttp = { request: async () => { throw unavailable; } };
const failingRpc = {
  call: async () => { throw unavailable; },
  batch: async () => { throw unavailable; }
};

function afterEverySourceIsDue(previous) {
  const latestDue = Math.max(...Object.values(previous.sources).map((source) => Date.parse(source.nextDueAt)));
  return new Date(latestDue + 1_000);
}

function beforeAnySourceIsDue(previous) {
  const earliestDue = Math.min(...Object.values(previous.sources).map((source) => Date.parse(source.nextDueAt)));
  const candidate = Date.parse(previous.updatedAt) + 1_000;
  assert.ok(candidate < earliestDue - DEFAULT_CONFIG.intervals.schedulerGrace, "checked-in fixture must leave a not-due window");
  return new Date(candidate);
}

test("full updater preserves LKG domains and publishes a partial dry-run candidate", async () => {
  const previous = parseCanonicalSnapshot(JSON.parse(await readFile("public/data.json", "utf8")), DEFAULT_CONFIG.history);
  const result = await runUpdate({
    previous,
    now: afterEverySourceIsDue(previous),
    config: DEFAULT_CONFIG,
    http: failingHttp,
    rpc: failingRpc,
    dryRun: true
  });
  assert.equal(result.published.written, false);
  assert.equal(result.snapshot.updateStatus, "partial");
  assert.equal(result.snapshot.network.performance.status, "stale");
  assert.equal(result.snapshot.network.performance.tps.total, previous.network.performance.tps.total);
  assert.equal(result.snapshot.economics.solPrice.currentUsd, previous.economics.solPrice.currentUsd);
  assert.equal(result.snapshot.sources.solanaRpc.status, "stale");
  assert.equal(result.snapshot.alertChecks.find((check) => check.id === "tps-change").status, "unavailable");
});

test("not-due updater runs are deterministic for an injected clock", async () => {
  const previous = parseCanonicalSnapshot(JSON.parse(await readFile("public/data.json", "utf8")), DEFAULT_CONFIG.history);
  const options = {
    now: beforeAnySourceIsDue(previous),
    config: DEFAULT_CONFIG,
    http: failingHttp,
    rpc: failingRpc,
    dryRun: true
  };
  const first = await runUpdate({ ...options, previous });
  const second = await runUpdate({ ...options, previous: first.snapshot });
  assert.deepEqual(second.snapshot, first.snapshot);
  assert.equal(second.report, first.report);
});

test("full updater stops a bootstrap when required sources are unavailable", async () => {
  await assert.rejects(
    runUpdate({
      previous: null,
      now: new Date("2026-08-20T12:00:00.000Z"),
      config: DEFAULT_CONFIG,
      http: failingHttp,
      rpc: failingRpc,
      dryRun: true
    }),
    (error) => error.code === "BOOTSTRAP_DOMAIN_FAILED"
  );
});
