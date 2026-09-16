import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { DEFAULT_CONFIG } from "../../src/pipeline/config.js";
import { ARCHIVED_COLLECTION_GAP_ID } from "../../src/pipeline/coverage.js";
import { assertSnapshotHistoryRetention } from "../../src/pipeline/history-retention.js";
import { parseCanonicalSnapshot } from "../../src/pipeline/contracts/canonical.js";
import { PipelineError } from "../../src/pipeline/lib/errors.js";
import { needsTokenizedSnapshotMigration, runUpdate } from "../../src/pipeline/update.js";
import { canonicalFixture, legacyCanonicalFixture, previousTokensCanonicalFixture } from "../helpers/canonical-fixture.js";

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

test("schema migration forces a Tokens.xyz refresh even before its next due time", () => {
  assert.equal(needsTokenizedSnapshotMigration(previousTokensCanonicalFixture()), true);
  assert.equal(needsTokenizedSnapshotMigration(canonicalFixture()), false);
  assert.equal(needsTokenizedSnapshotMigration(legacyCanonicalFixture()), false);
});

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

test("repeated not-due and failed updates cannot restore pre-recovery snapshots", async () => {
  const previous = parseCanonicalSnapshot(JSON.parse(await readFile("public/data.json", "utf8")), DEFAULT_CONFIG.history);
  for (const domain of [previous.network.performance, previous.validators, previous.economics.medianTransactionFee]) {
    domain.history.unshift({ ...domain.history[0], observedAt: "2026-08-26T00:00:00.000Z" });
  }
  previous.coverageIncidents.push({ id: ARCHIVED_COLLECTION_GAP_ID });
  previous.ecosystem.tokenizedAssets.legacyTransferVolume = canonicalFixture().ecosystem.tokenizedAssets.legacyTransferVolume;
  const options = { config: DEFAULT_CONFIG, http: failingHttp, rpc: failingRpc, dryRun: true };
  const now = beforeAnySourceIsDue(previous);
  const first = await runUpdate({ ...options, previous, now });
  const second = await runUpdate({ ...options, previous: first.snapshot, now });
  const failed = await runUpdate({ ...options, previous: second.snapshot, now: afterEverySourceIsDue(second.snapshot) });
  for (const result of [first, second, failed]) {
    assert.doesNotThrow(() => assertSnapshotHistoryRetention(result.snapshot));
    assert.equal(result.snapshot.ecosystem.tokenizedAssets.legacyTransferVolume, undefined);
    assert.ok(!result.snapshot.coverageIncidents.some((incident) => incident.id === ARCHIVED_COLLECTION_GAP_ID));
    assert.deepEqual(result.snapshot.economics.solPrice.history, previous.economics.solPrice.history);
    assert.deepEqual(result.snapshot.providerComparisons.metrics, previous.providerComparisons.metrics);
    assert.doesNotMatch(result.report, /collection-gap-2026-08-26|Retired RWA\.xyz/);
  }
  assert.deepEqual(second.snapshot, first.snapshot);
  assert.equal(failed.snapshot.network.performance.status, "stale");
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

test("legacy RWA history cannot substitute for a failed first Tokens.xyz collection", async () => {
  await assert.rejects(
    runUpdate({
      previous: legacyCanonicalFixture(),
      now: new Date("2026-08-21T12:00:00.000Z"),
      config: DEFAULT_CONFIG,
      http: failingHttp,
      rpc: failingRpc,
      dryRun: true
    }),
    (error) => error.code === "BOOTSTRAP_DOMAIN_FAILED" && /tokenized markets/.test(error.message)
  );
});
