import assert from "node:assert/strict";
import test from "node:test";
import { migrateCanonicalSnapshot, parseCanonicalSnapshot, serializeCanonicalSnapshot } from "../../src/pipeline/contracts/canonical.js";
import { blockSlotsSchema, performanceSamplesSchema, voteAccountsSchema } from "../../src/pipeline/contracts/providers.js";
import { canonicalFixture } from "../helpers/canonical-fixture.js";

test("provider contracts accept real RPC shape and BigInt stake", () => {
  assert.equal(performanceSamplesSchema.parse([{ numNonVoteTransactions: 10, numSlots: 150, numTransactions: 20, samplePeriodSecs: 60, slot: 50 }]).length, 1);
  const parsed = voteAccountsSchema.parse({ current: [{ activatedStake: 194864041290723n, commission: 2, epochVoteAccount: true, lastVote: 10, nodePubkey: "11111111111111111111111111111111", rootSlot: 9, votePubkey: "22222222222222222222222222222222" }], delinquent: [] });
  assert.equal(parsed.current[0].activatedStake, 194864041290723n);
});

test("provider contracts reject incoherent performance and block ordering", () => {
  assert.throws(() => performanceSamplesSchema.parse([
    { numNonVoteTransactions: 21, numSlots: 150, numTransactions: 20, samplePeriodSecs: 60, slot: 50 }
  ]));
  assert.throws(() => performanceSamplesSchema.parse([
    { numNonVoteTransactions: 10, numSlots: 150, numTransactions: 20, samplePeriodSecs: 60, slot: 49 },
    { numNonVoteTransactions: 10, numSlots: 150, numTransactions: 20, samplePeriodSecs: 60, slot: 50 }
  ]));
  assert.throws(() => blockSlotsSchema.parse([10, 10, 11]));
});

test("canonical snapshot validates and serializes deterministically", () => {
  const fixture = canonicalFixture();
  assert.equal(parseCanonicalSnapshot(fixture).updatedAt, fixture.updatedAt);
  assert.equal(serializeCanonicalSnapshot(fixture), `${JSON.stringify(fixture, null, 2)}\n`);
});

test("canonical snapshot migrates version 1.0.0 without mutating its input", () => {
  const legacy = canonicalFixture();
  legacy.schemaVersion = "1.0.0";
  legacy.methodologyVersion = "1.0.0";
  const original = structuredClone(legacy);

  const migrated = migrateCanonicalSnapshot(legacy);
  assert.equal(migrated.schemaVersion, "1.2.0");
  assert.equal(migrated.methodologyVersion, "1.2.0");
  assert.deepEqual(legacy, original);
  assert.equal(parseCanonicalSnapshot(legacy).schemaVersion, "1.2.0");
});

test("canonical migration turns legacy commission detections into truthful intervals", () => {
  const legacy = canonicalFixture();
  legacy.schemaVersion = "1.1.0";
  legacy.methodologyVersion = "1.1.0";
  legacy.updatedAt = "2026-08-29T11:13:49.269Z";
  legacy.validators.observedAt = legacy.updatedAt;
  legacy.validators.history.push({
    ...legacy.validators.history[0],
    observedAt: legacy.updatedAt
  });
  legacy.validators.commissionChanges = [
    {
      observedAt: "2026-08-19T00:00:00.000Z",
      votePubkey: legacy.validators.table[0].votePubkey,
      previousCommissionPct: 4,
      commissionPct: 5
    },
    {
      observedAt: legacy.updatedAt,
      votePubkey: legacy.validators.table[1].votePubkey,
      previousCommissionPct: 9,
      commissionPct: 10
    }
  ];
  const original = structuredClone(legacy);

  const migrated = migrateCanonicalSnapshot(legacy);

  assert.deepEqual(migrated.validators.commissionChanges, [
    {
      previousObservedAt: null,
      detectedAt: "2026-08-19T00:00:00.000Z",
      votePubkey: legacy.validators.table[0].votePubkey,
      previousCommissionPct: 4,
      commissionPct: 5
    },
    {
      previousObservedAt: "2026-08-20T00:00:00.000Z",
      detectedAt: legacy.updatedAt,
      votePubkey: legacy.validators.table[1].votePubkey,
      previousCommissionPct: 9,
      commissionPct: 10
    }
  ]);
  assert.deepEqual(legacy, original);
  assert.deepEqual(parseCanonicalSnapshot(legacy).validators.commissionChanges, migrated.validators.commissionChanges);
});

test("canonical invariants reject impossible commission intervals", () => {
  const fixture = canonicalFixture();
  fixture.validators.commissionChanges = [{
    previousObservedAt: fixture.updatedAt,
    detectedAt: fixture.updatedAt,
    votePubkey: fixture.validators.table[0].votePubkey,
    previousCommissionPct: 4,
    commissionPct: 5
  }];

  assert.throws(() => parseCanonicalSnapshot(fixture), (error) => error.code === "INVALID_COMMISSION_TIMELINE");
});

function supplementalFixture() {
  const fixture = canonicalFixture();
  const observedAt = "2026-08-29T12:00:00.000Z";
  fixture.updatedAt = observedAt;
  const source = (name, url) => ({
    name,
    url,
    status: "fresh",
    lastAttemptAt: observedAt,
    lastSuccessAt: observedAt,
    nextDueAt: "2026-08-29T13:00:00.000Z",
    dataThrough: observedAt
  });
  fixture.sources.coinGecko = source("CoinGecko", "https://example.com/coingecko");
  fixture.sources.coinbaseExchange = source("Coinbase Exchange", "https://example.com/coinbase");
  fixture.sources.solanaData = source("Solana Foundation Data", "https://example.com/solana-data");
  fixture.sources.solanaStatus = source("Solana Status", "https://status.solana.com");
  fixture.sources.agaveReleases = source("Agave releases", "https://github.com/anza-xyz/agave/releases");
  fixture.coverageIncidents = [{
    id: "collection-gap-2026-08-26",
    status: "resolved",
    startedAt: "2026-08-26T16:57:53.898Z",
    endedAt: observedAt,
    affectedMetrics: ["TPS", "Non-vote TPS", "Slot time"],
    reason: "Scheduled collection was interrupted and the next canonical validation failed.",
    disclosure: "No values were interpolated."
  }];
  fixture.economics.coinGeckoPrice = {
    status: "fresh",
    observedAt,
    sourceIds: ["coinGecko"],
    currency: "USD",
    currentUsd: 101,
    change24hPct: 1,
    reference24h: { observedAt: "2026-08-28T12:00:00.000Z", priceUsd: 100, elapsedSeconds: 86_400 },
    history: [
      { observedAt: "2026-08-28T12:00:00.000Z", priceUsd: 100 },
      { observedAt, priceUsd: 101 }
    ]
  };
  fixture.economics.coinbaseMarket = {
    status: "fresh",
    observedAt: "2026-08-28T23:59:59.999Z",
    sourceIds: ["coinbaseExchange"],
    productId: "SOL-USD",
    granularitySeconds: 86_400,
    dataThrough: "2026-08-28",
    history: [
      { date: "2026-08-27", openUsd: 98, highUsd: 104, lowUsd: 97, closeUsd: 102, volumeSol: 1_000 },
      { date: "2026-08-28", openUsd: 102, highUsd: 106, lowUsd: 101, closeUsd: 105, volumeSol: 1_100 }
    ]
  };
  fixture.providerComparisons = {
    status: "fresh",
    observedAt,
    sourceIds: ["solanaData"],
    metrics: [
      { id: "sol-price", name: "SOL Price", unit: "USD", description: "Daily SOL price.", series: [{ providerName: "Blockworks", dataThrough: "2026-08-28", history: [{ date: "2026-08-28", value: 105 }] }] },
      { id: "fees", name: "Fees", unit: "SOL", description: "Daily fees.", series: [{ providerName: "Solscan", dataThrough: "2026-08-28", history: [{ date: "2026-08-28", value: 10_000 }] }] },
      { id: "fee-payers", name: "Fee Payers", unit: "Count", description: "Daily fee payers.", series: [{ providerName: "Token Terminal", dataThrough: "2026-08-28", history: [{ date: "2026-08-28", value: 2_000_000 }] }] },
      { id: "dex-volume", name: "DEX Volume", unit: "USD", description: "Daily DEX volume.", series: [{ providerName: "DexPaprika", dataThrough: "2026-08-28", history: [{ date: "2026-08-28", value: 7_000_000_000 }] }] }
    ]
  };
  fixture.observability = {
    solanaStatus: {
      status: "fresh",
      observedAt,
      sourceIds: ["solanaStatus"],
      page: { id: "solana", name: "Solana Status", url: "https://status.solana.com", updatedAt: "2026-08-29T11:55:00.000Z" },
      condition: { indicator: "none", description: "All systems operational" },
      components: [{ id: "rpc", name: "RPC", status: "operational", updatedAt: "2026-08-29T11:55:00.000Z", position: 1, group: false }],
      incidents: []
    },
    agaveReleases: {
      status: "fresh",
      observedAt,
      sourceIds: ["agaveReleases"],
      repository: "anza-xyz/agave",
      items: [{
        id: "100",
        tagName: "v3.0.0",
        title: "Agave v3.0.0",
        url: "https://github.com/anza-xyz/agave/releases/tag/v3.0.0",
        createdAt: "2026-08-27T10:00:00.000Z",
        publishedAt: "2026-08-27T11:00:00.000Z",
        prerelease: false,
        notes: "Release notes"
      }]
    }
  };
  return fixture;
}

test("canonical snapshot validates optional coverage, provider, market, and observability domains", () => {
  const fixture = supplementalFixture();
  const parsed = parseCanonicalSnapshot(fixture);

  assert.equal(parsed.coverageIncidents[0].status, "resolved");
  assert.equal(parsed.providerComparisons.metrics.length, 4);
  assert.equal(parsed.economics.coinbaseMarket.dataThrough, "2026-08-28");
  assert.equal(parsed.observability.agaveReleases.repository, "anza-xyz/agave");
});

test("canonical invariants reject contradictory optional-domain data", () => {
  const coverage = supplementalFixture();
  coverage.coverageIncidents[0].status = "ongoing";
  assert.throws(() => parseCanonicalSnapshot(coverage), (error) => error.code === "INVALID_COVERAGE_STATUS");

  const providers = supplementalFixture();
  providers.providerComparisons.metrics.reverse();
  assert.throws(() => parseCanonicalSnapshot(providers), (error) => error.code === "INVALID_PROVIDER_METRIC_ORDER");

  const coinbase = supplementalFixture();
  coinbase.economics.coinbaseMarket.dataThrough = "2026-08-27";
  assert.throws(() => parseCanonicalSnapshot(coinbase), (error) => error.code === "COINBASE_HISTORY_MISMATCH");
});

test("canonical invariants reject silent freshness and stake corruption", () => {
  const stale = canonicalFixture();
  stale.network.chain.status = "stale";
  assert.throws(() => parseCanonicalSnapshot(stale), (error) => error.code === "MISSING_STALE_TIMESTAMP");

  const stake = canonicalFixture();
  stake.validators.stake.totalLamports = "111";
  assert.throws(() => parseCanonicalSnapshot(stake), (error) => error.code === "VALIDATOR_STAKE_MISMATCH");

  const unavailableCheck = canonicalFixture();
  unavailableCheck.alertChecks[0].status = "unavailable";
  delete unavailableCheck.alertChecks[0].observedAt;
  assert.throws(() => parseCanonicalSnapshot(unavailableCheck), (error) => error.code === "MISSING_ALERT_REASON");

  const price = canonicalFixture();
  price.economics.solPrice.currentUsd = 101;
  assert.throws(() => parseCanonicalSnapshot(price), (error) => error.code === "PRICE_HISTORY_MISMATCH");

  const addresses = canonicalFixture();
  addresses.ecosystem.dailyActiveAddresses.value = 2_000_101;
  assert.throws(() => parseCanonicalSnapshot(addresses), (error) => error.code === "ADDRESS_CONSENSUS_MISMATCH");
});

test("canonical invariants reject contradictory histories and source timelines", () => {
  const source = canonicalFixture();
  source.sources.solanaRpc.lastAttemptAt = "2026-08-20T00:10:00.000Z";
  assert.throws(() => parseCanonicalSnapshot(source), (error) => error.code === "FUTURE_SOURCE_ATTEMPT");

  const validators = canonicalFixture();
  validators.validators.history[0].activeCount = 2;
  assert.throws(() => parseCanonicalSnapshot(validators), (error) => error.code === "VALIDATOR_HISTORY_MISMATCH");

  const top = canonicalFixture();
  top.validators.top = top.validators.top.slice(0, -1);
  assert.throws(() => parseCanonicalSnapshot(top), (error) => error.code === "TOP_VALIDATOR_MISMATCH");

  const rev = canonicalFixture();
  rev.economics.rev.history[0].transactionFeesSol = 999;
  assert.throws(() => parseCanonicalSnapshot(rev), (error) => error.code === "REV_HISTORY_MISMATCH");

  const fee = canonicalFixture();
  fee.economics.medianTransactionFee.sample.producedSlotCount = 10_000;
  assert.throws(() => parseCanonicalSnapshot(fee), (error) => error.code === "INVALID_FEE_SAMPLE");

  const addresses = canonicalFixture();
  addresses.ecosystem.dailyActiveAddresses.history.unshift({ date: "2026-08-17", value: 1, allium: 1, dune: 3 });
  assert.throws(() => parseCanonicalSnapshot(addresses), (error) => error.code === "ADDRESS_HISTORY_MISMATCH");
});
