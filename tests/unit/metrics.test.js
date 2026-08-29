import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_CONFIG } from "../../src/pipeline/config.js";
import { calculateAlerts } from "../../src/pipeline/metrics/alerts.js";
import { calculateNetworkPerformance } from "../../src/pipeline/metrics/network.js";
import { calculateActiveAddresses, calculateRev } from "../../src/pipeline/metrics/rev.js";
import { calculateValidators } from "../../src/pipeline/metrics/validators.js";
import { canonicalFixture } from "../helpers/canonical-fixture.js";

const now = new Date("2026-08-20T00:00:00.000Z");

test("network headline is duration weighted and alert evidence is isolated", () => {
  const samples = Array.from({ length: 80 }, (_, index) => ({
    numTransactions: index < 10 ? 420_000 : 180_000,
    numNonVoteTransactions: index < 10 ? 300_000 : 120_000,
    numSlots: 150,
    samplePeriodSecs: 60,
    slot: 1_000 - index
  }));
  const result = calculateNetworkPerformance(samples, now, [], DEFAULT_CONFIG);
  assert.equal(result.domain.tps.total, 7_000);
  assert.equal(result.domain.tps.nonVote, 5_000);
  assert.equal(result.domain.slotTimeMs, 400);
  assert.equal(result.evidence.baseline.totalTps, 3_000);
});

test("validator calculation filters unstaked accounts and preserves exact aggregate stake", () => {
  const account = (votePubkey, stake) => ({ activatedStake: stake, commission: 5, epochVoteAccount: true, lastVote: 10, rootSlot: 9, votePubkey, nodePubkey: votePubkey });
  const config = { ...DEFAULT_CONFIG, rpc: { ...DEFAULT_CONFIG.rpc, minimumValidatorCount: 1 } };
  const result = calculateValidators({
    current: [account("11111111111111111111111111111111", 10_000_000_000_000_001n), account("22222222222222222222222222222222", 0)],
    delinquent: [account("33333333333333333333333333333333", 5_000_000_000_000_001n)]
  }, now, undefined, config);
  assert.equal(result.counts.total, 2);
  assert.equal(result.stake.totalLamports, "15000000000000002");
  assert.equal(result.table[0].status, "active");
  assert.equal(result.table[1].status, "delinquent");

  const changed = calculateValidators({
    current: [{ ...account("11111111111111111111111111111111", 10_000_000_000_000_001n), commission: 7 }],
    delinquent: [account("33333333333333333333333333333333", 5_000_000_000_000_001n)]
  }, new Date("2026-08-20T01:00:00.000Z"), result, config);
  assert.deepEqual(changed.commissionChanges, [{
    previousObservedAt: "2026-08-20T00:00:00.000Z",
    detectedAt: "2026-08-20T01:00:00.000Z",
    votePubkey: "11111111111111111111111111111111",
    previousCommissionPct: 5,
    commissionPct: 7
  }]);
});

test("REV and active addresses use same-date two-provider medians", () => {
  const rows = [
    { date: "2026-08-18", metricName: "Fees", unit: "SOL", providerName: "Allium", value: 100 },
    { date: "2026-08-18", metricName: "Fees", unit: "SOL", providerName: "Dune", value: 102 },
    { date: "2026-08-18", metricName: "Fee Payers", unit: "Count", providerName: "Allium", value: 1_000 },
    { date: "2026-08-18", metricName: "Fee Payers", unit: "Count", providerName: "Dune", value: 1_001 }
  ];
  const rev = calculateRev(rows, [{ date: "2026-08-18", grossTipsSol: 9 }], now, DEFAULT_CONFIG);
  assert.equal(rev.components.transactionFeesSol, 101);
  assert.equal(rev.totalSol, 110);
  assert.equal(calculateActiveAddresses(rows, now, DEFAULT_CONFIG).value, 1_000.5);
});

test("alerts trigger only after complete threshold logic", () => {
  const snapshot = canonicalFixture();
  snapshot.updatedAt = now.toISOString();
  snapshot.network.performance.observedAt = now.toISOString();
  snapshot.economics.solPrice.change24hPct = 12;
  const result = calculateAlerts(snapshot, {
    performance: {
      baseline: { totalTps: 3_000, slotTimeMs: 400 },
      recent: [
        { totalTps: 1_500, slotTimeMs: 700 },
        { totalTps: 1_400, slotTimeMs: 690 }
      ]
    }
  }, DEFAULT_CONFIG);
  assert.equal(result.checks.find((check) => check.id === "tps-change").status, "triggered");
  assert.equal(result.checks.find((check) => check.id === "slow-slot-time").status, "triggered");
  assert.equal(result.checks.find((check) => check.id === "large-sol-price-move").status, "triggered");
});
