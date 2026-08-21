import assert from "node:assert/strict";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { mergeDomain } from "../../src/pipeline/outputs/snapshot.js";
import { sourceIsDue } from "../../src/pipeline/outputs/snapshot.js";
import { DEFAULT_CONFIG } from "../../src/pipeline/config.js";
import { buildPriceSourceResults } from "../../src/pipeline/outputs/snapshot.js";
import { publishOutputs } from "../../src/pipeline/outputs/publish.js";
import { renderReport } from "../../src/pipeline/outputs/report.js";
import { canonicalFixture } from "../helpers/canonical-fixture.js";

const prior = { status: "fresh", observedAt: "2026-08-20T00:00:00.000Z", sourceIds: ["source"], value: 10 };

test("failure preserves last-known-good and marks it stale", () => {
  const result = mergeDomain(prior, { state: "failed", error: { code: "DOWN", message: "down" } }, new Date("2026-08-20T01:00:00.000Z"), 10_000, "metric");
  assert.equal(result.value, 10);
  assert.equal(result.status, "stale");
  assert.equal(result.staleSince, "2026-08-20T01:00:00.000Z");
});

test("not-due never heals a previously stale value", () => {
  const stale = { ...prior, status: "stale", staleSince: "2026-08-20T00:30:00.000Z" };
  const result = mergeDomain(stale, { state: "notDue" }, new Date("2026-08-20T01:00:00.000Z"), 7_200_000, "metric");
  assert.equal(result.status, "stale");
  assert.equal(result.staleSince, stale.staleSince);
});

test("bootstrap failure is critical", () => {
  assert.throws(() => mergeDomain(undefined, { state: "failed", error: { code: "DOWN", message: "down" } }, new Date(), 1, "metric"), (error) => error.code === "BOOTSTRAP_DOMAIN_FAILED");
});

test("due calculation tolerates fixed-cron jitter", () => {
  const previous = { sources: { solanaRpc: { lastSuccessAt: "2026-08-20T00:17:20.000Z", nextDueAt: "2026-08-20T01:17:20.000Z" } } };
  assert.equal(sourceIsDue("solanaRpc", previous, new Date("2026-08-20T01:17:00.000Z"), DEFAULT_CONFIG), true);
  assert.equal(sourceIsDue("solanaRpc", previous, new Date("2026-08-20T01:10:00.000Z"), DEFAULT_CONFIG), false);
});

test("failed price fallback retains the prior CoinGecko source state", () => {
  const previous = {
    sources: { coinGecko: { lastSuccessAt: "2026-08-20T00:00:00.000Z" } },
    economics: { solPrice: { sourceIds: ["coinGecko"] } }
  };
  const failure = { state: "failed", error: { code: "PRICE_SOURCES_FAILED", message: "both failed" } };
  const results = buildPriceSourceResults(failure, previous);
  assert.equal(results.defiLlamaCoins.state, "failed");
  assert.equal(results.coinGecko.state, "failed");
});

test("failed publication removes every settled temporary file", async () => {
  const root = await mkdtemp(join(tmpdir(), "solana-pulse-publish-"));
  try {
    const snapshot = canonicalFixture();
    const config = {
      ...DEFAULT_CONFIG,
      output: { ...DEFAULT_CONFIG.output, dataPath: "out/artifact", reportPath: "out/artifact" }
    };
    await assert.rejects(publishOutputs(snapshot, renderReport(snapshot), config, { root }));
    assert.deepEqual(await readdir(join(root, "out")), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
