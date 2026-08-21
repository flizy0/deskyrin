import assert from "node:assert/strict";
import test from "node:test";
import { parseCanonicalSnapshot, serializeCanonicalSnapshot } from "../../src/pipeline/contracts/canonical.js";
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
