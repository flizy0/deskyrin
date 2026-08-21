import { z } from "zod";
import { METHODOLOGY_VERSION, SCHEMA_VERSION, SOURCE_IDS } from "../config.js";
import { PipelineError } from "../lib/errors.js";
import { nearlyEqual } from "../lib/numbers.js";

const finite = z.number().refine(Number.isFinite, "Expected a finite number");
const nonNegative = finite.min(0);
const positive = finite.positive();
const integer = z.number().int();
const nonNegativeInteger = integer.min(0);
const positiveInteger = integer.positive();
const decimalInteger = z.string().regex(/^(0|[1-9]\d*)$/);
const publicKey = z.string().min(32).max(64);
const safeText = z.string().min(1).max(1_000);
const httpsUrl = z.string().url().refine((value) => new URL(value).protocol === "https:", "Expected an HTTPS URL");
const utcDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Expected a real UTC date");
const isoTime = z.string().refine((value) => {
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.toISOString() === value;
}, "Expected a canonical ISO timestamp");

const sourceErrorSchema = z.object({
  code: z.string().min(1).max(100),
  message: z.string().min(1).max(300)
}).strict();

export const sourceRecordSchema = z.object({
  name: z.string().min(1).max(100),
  url: httpsUrl,
  status: z.enum(["fresh", "stale", "unavailable"]),
  lastAttemptAt: isoTime,
  lastSuccessAt: isoTime.optional(),
  nextDueAt: isoTime,
  dataThrough: z.string().min(1).max(40).optional(),
  error: sourceErrorSchema.optional()
}).strict();

const domainFields = {
  status: z.enum(["fresh", "stale"]),
  observedAt: isoTime,
  sourceIds: z.array(z.string().min(1)).min(1),
  staleSince: isoTime.optional()
};

const performanceHistoryPointSchema = z.object({
  observedAt: isoTime,
  totalTps: nonNegative,
  nonVoteTps: nonNegative,
  slotTimeMs: positive
}).strict();

const networkPerformanceSchema = z.object({
  ...domainFields,
  sample: z.object({
    count: positiveInteger,
    windowSeconds: positive,
    endingSlot: decimalInteger
  }).strict(),
  tps: z.object({
    total: nonNegative,
    nonVote: nonNegative
  }).strict(),
  slotTimeMs: positive,
  history: z.array(performanceHistoryPointSchema).min(1)
}).strict();

const networkChainSchema = z.object({
  ...domainFields,
  commitment: z.literal("finalized"),
  slot: decimalInteger,
  blockHeight: decimalInteger,
  epoch: z.object({
    number: nonNegativeInteger,
    slotIndex: nonNegativeInteger,
    slotsInEpoch: positiveInteger,
    progressPct: nonNegative.max(100)
  }).strict()
}).strict();

const validatorRowSchema = z.object({
  rank: positiveInteger,
  votePubkey: publicKey,
  nodePubkey: publicKey,
  status: z.enum(["active", "delinquent"]),
  activatedStakeLamports: decimalInteger,
  stakeSharePct: nonNegative.max(100),
  commissionPct: nonNegativeInteger.max(100)
}).strict();

const validatorHistoryPointSchema = z.object({
  observedAt: isoTime,
  activeCount: nonNegativeInteger,
  delinquentCount: nonNegativeInteger,
  totalStakeLamports: decimalInteger,
  delinquentStakeLamports: decimalInteger,
  delinquentStakePct: nonNegative.max(100)
}).strict();

const commissionChangeSchema = z.object({
  observedAt: isoTime,
  votePubkey: publicKey,
  previousCommissionPct: nonNegativeInteger.max(100),
  commissionPct: nonNegativeInteger.max(100)
}).strict();

const validatorsSchema = z.object({
  ...domainFields,
  delinquencyDistanceSlots: positiveInteger,
  counts: z.object({
    active: nonNegativeInteger,
    delinquent: nonNegativeInteger,
    total: positiveInteger
  }).strict(),
  stake: z.object({
    activeLamports: decimalInteger,
    delinquentLamports: decimalInteger,
    totalLamports: decimalInteger,
    delinquentPct: nonNegative.max(100),
    top10Pct: nonNegative.max(100),
    distribution: z.array(z.object({
      label: z.string().min(1).max(100),
      votePubkey: publicKey.optional(),
      stakeLamports: decimalInteger,
      sharePct: nonNegative.max(100),
      status: z.enum(["active", "delinquent", "aggregate"])
    }).strict()).min(1)
  }).strict(),
  top: z.array(validatorRowSchema).min(1).max(10),
  table: z.array(validatorRowSchema).min(1).max(5_000),
  commissionChanges: z.array(commissionChangeSchema).max(5_000).default([]),
  history: z.array(validatorHistoryPointSchema).min(1)
}).strict();

const priceHistoryPointSchema = z.object({
  observedAt: isoTime,
  priceUsd: positive
}).strict();

const solPriceSchema = z.object({
  ...domainFields,
  currency: z.literal("USD"),
  currentUsd: positive,
  change24hPct: finite,
  reference24h: z.object({
    observedAt: isoTime,
    priceUsd: positive,
    elapsedSeconds: positiveInteger.min(82_800).max(90_000)
  }).strict(),
  confidence: nonNegative.optional(),
  history: z.array(priceHistoryPointSchema).min(2)
}).strict();

const dailyValueSchema = (field, valueSchema = nonNegative) => z.object({
  date: utcDate,
  [field]: valueSchema
}).strict();

const tvlSchema = z.object({
  ...domainFields,
  currency: z.literal("USD"),
  latest: z.object({ date: utcDate, valueUsd: positive }).strict(),
  previous: z.object({ date: utcDate, valueUsd: positive }).strict(),
  change1dPct: finite,
  history: z.array(dailyValueSchema("valueUsd", positive)).min(2)
}).strict();

const stablecoinSchema = z.object({
  ...domainFields,
  currency: z.literal("USD"),
  date: utcDate,
  totalCirculatingUsd: positive,
  history: z.array(dailyValueSchema("totalCirculatingUsd", positive)).min(2)
}).strict();

const dexSchema = z.object({
  ...domainFields,
  currency: z.literal("USD"),
  date: utcDate,
  dailyVolumeUsd: positive,
  history: z.array(dailyValueSchema("dailyVolumeUsd", positive)).min(2)
}).strict();

const revHistoryPointSchema = z.object({
  date: utcDate,
  totalSol: positive,
  transactionFeesSol: positive,
  grossJitoTipsSol: positive,
  feeProviderCount: positiveInteger,
  feeProviderMinSol: nonNegative,
  feeProviderMaxSol: nonNegative
}).strict();

const revSchema = z.object({
  ...domainFields,
  unit: z.literal("SOL"),
  date: utcDate,
  totalSol: positive,
  components: z.object({
    transactionFeesSol: positive,
    grossJitoTipsSol: positive
  }).strict(),
  feeConsensus: z.object({
    method: z.literal("median"),
    providers: z.array(z.object({ name: z.enum(["Allium", "Dune"]), valueSol: positive }).strict()).length(2),
    minSol: positive,
    maxSol: positive
  }).strict(),
  history: z.array(revHistoryPointSchema).min(1)
}).strict();

const medianFeeSchema = z.object({
  ...domainFields,
  unit: z.literal("lamports"),
  medianLamports: positive,
  sample: z.object({
    commitment: z.literal("finalized"),
    startSlot: decimalInteger,
    endSlot: decimalInteger,
    producedSlotCount: positiveInteger,
    selectedBlockCount: positiveInteger,
    transactionCount: positiveInteger,
    approximateWindowSeconds: positiveInteger
  }).strict(),
  history: z.array(z.object({
    observedAt: isoTime,
    medianLamports: positive,
    transactionCount: positiveInteger,
    selectedBlockCount: positiveInteger
  }).strict()).min(1)
}).strict();

const tokenizedHistoryPointSchema = z.object({
  observedAt: isoTime,
  totalTransferVolumeUsd: positive,
  equityTransferVolumeUsd: positive
}).strict();

const tokenizedAssetsSchema = z.object({
  ...domainFields,
  currency: z.literal("USD"),
  windowDays: z.literal(30),
  totalTransferVolumeUsd: positive,
  equityTransferVolumeUsd: positive,
  history: z.array(tokenizedHistoryPointSchema).min(1)
}).strict();

const activeAddressHistoryPointSchema = z.object({
  date: utcDate,
  value: positive,
  allium: positiveInteger,
  dune: positiveInteger
}).strict();

const activeAddressesSchema = z.object({
  ...domainFields,
  date: utcDate,
  value: positive,
  consensusMethod: z.literal("median"),
  providers: z.array(z.object({
    name: z.enum(["Allium", "Dune"]),
    value: positiveInteger
  }).strict()).length(2),
  history: z.array(activeAddressHistoryPointSchema).min(1)
}).strict();

const newsSchema = z.object({
  ...domainFields,
  feedUpdatedAt: isoTime.optional(),
  items: z.array(z.object({
    id: z.string().min(1).max(500),
    title: z.string().min(1).max(300),
    url: httpsUrl,
    publishedAt: isoTime,
    description: z.string().max(1_000).optional()
  }).strict()).min(1).max(8)
}).strict();

const upgradesSchema = z.object({
  ...domainFields,
  items: z.array(z.object({
    id: z.string().min(1).max(100),
    title: z.string().min(1).max(200),
    subtitle: z.string().min(1).max(500),
    url: httpsUrl,
    stage: z.enum(["in_development", "pending_activation", "action_required"]),
    stageLabel: z.string().min(1).max(100),
    releaseId: z.string().min(1).max(100),
    releaseLabel: z.string().min(1).max(100),
    expected: z.string().min(1).max(100).optional(),
    publishedAt: isoTime.optional(),
    metrics: z.array(z.object({ value: safeText, label: safeText }).strict()).max(4),
    simds: z.array(z.object({
      id: z.string().regex(/^\d{4}$/),
      title: z.string().min(1).max(200).optional(),
      url: httpsUrl
    }).strict()).max(12)
  }).strict()).min(1).max(20)
}).strict();

const thresholdValue = z.union([finite, z.string().min(1).max(100), z.boolean()]);
const alertCheckSchema = z.object({
  id: z.enum(["tps-change", "slow-slot-time", "high-validator-delinquency", "large-tvl-change", "large-sol-price-move"]),
  kind: z.string().min(1).max(100),
  status: z.enum(["normal", "triggered", "unavailable"]),
  metricPath: z.string().min(1).max(200),
  unit: z.string().min(1).max(50),
  window: z.string().min(1).max(200),
  threshold: z.record(z.string(), thresholdValue),
  direction: z.enum(["up", "down"]).optional(),
  observedAt: isoTime.optional(),
  currentValue: finite.optional(),
  referenceValue: finite.optional(),
  changePct: finite.optional(),
  reasonCode: z.string().min(1).max(100).optional()
}).strict();

const alertSchema = z.object({
  id: z.string().min(1).max(100),
  kind: z.string().min(1).max(100),
  severity: z.literal("warning"),
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(500),
  observedAt: isoTime,
  checkId: z.string().min(1).max(100)
}).strict();

export const canonicalSnapshotSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  methodologyVersion: z.literal(METHODOLOGY_VERSION),
  updatedAt: isoTime,
  updateStatus: z.enum(["complete", "partial"]),
  sources: z.record(z.string(), sourceRecordSchema),
  network: z.object({
    performance: networkPerformanceSchema,
    chain: networkChainSchema
  }).strict(),
  validators: validatorsSchema,
  economics: z.object({
    solPrice: solPriceSchema,
    tvlAlertInput: tvlSchema,
    stablecoinSupply: stablecoinSchema,
    dexVolume: dexSchema,
    rev: revSchema,
    medianTransactionFee: medianFeeSchema
  }).strict(),
  ecosystem: z.object({
    tokenizedAssets: tokenizedAssetsSchema,
    dailyActiveAddresses: activeAddressesSchema,
    news: newsSchema,
    upgrades: upgradesSchema
  }).strict(),
  alertChecks: z.array(alertCheckSchema).length(5),
  alerts: z.array(alertSchema).max(5)
}).strict();

const EXPECTED_ALERT_IDS = [
  "tps-change",
  "slow-slot-time",
  "high-validator-delinquency",
  "large-tvl-change",
  "large-sol-price-move"
];

function assert(condition, code, message) {
  if (!condition) throw new PipelineError(code, message);
}

function assertSortedUnique(points, key, limit, label) {
  assert(points.length <= limit, "HISTORY_TOO_LARGE", `${label} exceeds ${limit} points`);
  const keys = points.map(key);
  assert(new Set(keys).size === keys.length, "DUPLICATE_HISTORY", `${label} contains duplicate points`);
  assert(keys.every((value, index) => index === 0 || keys[index - 1] < value), "UNSORTED_HISTORY", `${label} must be ascending`);
}

function domains(snapshot) {
  return [
    snapshot.network.performance,
    snapshot.network.chain,
    snapshot.validators,
    snapshot.economics.solPrice,
    snapshot.economics.tvlAlertInput,
    snapshot.economics.stablecoinSupply,
    snapshot.economics.dexVolume,
    snapshot.economics.rev,
    snapshot.economics.medianTransactionFee,
    snapshot.ecosystem.tokenizedAssets,
    snapshot.ecosystem.dailyActiveAddresses,
    snapshot.ecosystem.news,
    snapshot.ecosystem.upgrades
  ];
}

export function validateCanonicalInvariants(snapshot, limits = {}) {
  const hourlyLimit = limits.hourlyPoints ?? 720;
  const dailyLimit = limits.dailyPoints ?? 90;
  const rwaLimit = limits.rwaPoints ?? 365;

  for (const domain of domains(snapshot)) {
    assert(domain.sourceIds.every((id) => Object.hasOwn(snapshot.sources, id)), "UNKNOWN_SOURCE_ID", "Domain references an unknown source");
    assert(new Set(domain.sourceIds).size === domain.sourceIds.length, "DUPLICATE_SOURCE_ID", "Domain source IDs must be unique");
    assert(new Date(domain.observedAt).getTime() <= new Date(snapshot.updatedAt).getTime() + 300_000, "FUTURE_DOMAIN", "Domain observation is later than the snapshot");
    if (domain.status === "stale") {
      assert(Boolean(domain.staleSince), "MISSING_STALE_TIMESTAMP", "Stale domain must include staleSince");
    } else {
      assert(!domain.staleSince, "FRESH_WITH_STALE_TIMESTAMP", "Fresh domain must not include staleSince");
    }
  }

  const knownSourceIds = new Set(Object.values(SOURCE_IDS));
  const snapshotTime = Date.parse(snapshot.updatedAt);
  for (const [sourceId, source] of Object.entries(snapshot.sources)) {
    assert(knownSourceIds.has(sourceId), "UNKNOWN_SOURCE", `Snapshot contains unknown source ${sourceId}`);
    assert(source.status !== "fresh" || Boolean(source.lastSuccessAt) && !source.error, "INVALID_SOURCE_STATE", "Fresh source must have a success and no error");
    assert(source.status !== "stale" || Boolean(source.lastSuccessAt) && Boolean(source.error), "INVALID_SOURCE_STATE", "Stale source must have a last success and error");
    assert(source.status !== "unavailable" || !source.lastSuccessAt, "INVALID_SOURCE_STATE", "Unavailable source cannot claim a last success");
    assert(source.status !== "unavailable" || Boolean(source.error), "INVALID_SOURCE_STATE", "Unavailable source must include its error");
    const attemptTime = Date.parse(source.lastAttemptAt);
    const successTime = source.lastSuccessAt ? Date.parse(source.lastSuccessAt) : undefined;
    assert(attemptTime <= snapshotTime + 300_000, "FUTURE_SOURCE_ATTEMPT", "Source attempt is later than the snapshot");
    assert(successTime === undefined || successTime <= attemptTime, "INVALID_SOURCE_TIMELINE", "Source success is later than its attempt");
    assert(Date.parse(source.nextDueAt) > attemptTime, "INVALID_SOURCE_TIMELINE", "Source next-due time must follow its last attempt");
  }

  const anyStale = domains(snapshot).some((domain) => domain.status === "stale");
  assert(snapshot.updateStatus === (anyStale ? "partial" : "complete"), "INVALID_UPDATE_STATUS", "updateStatus disagrees with domain freshness");

  assertSortedUnique(snapshot.network.performance.history, (point) => point.observedAt, hourlyLimit, "network history");
  assertSortedUnique(snapshot.validators.history, (point) => point.observedAt, hourlyLimit, "validator history");
  assertSortedUnique(snapshot.validators.commissionChanges, (point) => `${point.observedAt}|${point.votePubkey}`, limits.commissionEvents ?? 1_000, "commission changes");
  assertSortedUnique(snapshot.economics.medianTransactionFee.history, (point) => point.observedAt, hourlyLimit, "fee history");
  assertSortedUnique(snapshot.economics.solPrice.history, (point) => point.observedAt, dailyLimit + 1, "price history");
  assertSortedUnique(snapshot.economics.tvlAlertInput.history, (point) => point.date, dailyLimit, "TVL history");
  assertSortedUnique(snapshot.economics.stablecoinSupply.history, (point) => point.date, dailyLimit, "stablecoin history");
  assertSortedUnique(snapshot.economics.dexVolume.history, (point) => point.date, dailyLimit, "DEX history");
  assertSortedUnique(snapshot.economics.rev.history, (point) => point.date, dailyLimit, "REV history");
  assertSortedUnique(snapshot.ecosystem.tokenizedAssets.history, (point) => point.observedAt, rwaLimit, "RWA history");
  assertSortedUnique(snapshot.ecosystem.dailyActiveAddresses.history, (point) => point.date, dailyLimit, "active-address history");

  const performance = snapshot.network.performance;
  const performancePoint = performance.history.find((point) => point.observedAt === performance.observedAt);
  assert(Boolean(performancePoint), "NETWORK_HISTORY_MISMATCH", "Current network observation is missing from history");
  assert(nearlyEqual(performancePoint.totalTps, performance.tps.total), "NETWORK_HISTORY_MISMATCH", "Current TPS does not match history");
  assert(nearlyEqual(performancePoint.nonVoteTps, performance.tps.nonVote), "NETWORK_HISTORY_MISMATCH", "Current non-vote TPS does not match history");
  assert(nearlyEqual(performancePoint.slotTimeMs, performance.slotTimeMs), "NETWORK_HISTORY_MISMATCH", "Current slot time does not match history");
  assert(performance.tps.nonVote <= performance.tps.total, "INVALID_TPS_BREAKDOWN", "Non-vote TPS cannot exceed total TPS");

  const chain = snapshot.network.chain;
  assert(chain.epoch.slotIndex <= chain.epoch.slotsInEpoch, "INVALID_EPOCH_PROGRESS", "Epoch slot index exceeds epoch length");
  assert(nearlyEqual(chain.epoch.progressPct, chain.epoch.slotIndex / chain.epoch.slotsInEpoch * 100), "INVALID_EPOCH_PROGRESS", "Epoch percentage is inconsistent");

  const table = snapshot.validators.table;
  assert(snapshot.validators.counts.total === table.length, "VALIDATOR_COUNT_MISMATCH", "Validator total does not match table");
  assert(snapshot.validators.counts.active === table.filter((row) => row.status === "active").length, "VALIDATOR_COUNT_MISMATCH", "Active validator count does not match table");
  assert(snapshot.validators.counts.delinquent === table.filter((row) => row.status === "delinquent").length, "VALIDATOR_COUNT_MISMATCH", "Delinquent validator count does not match table");
  assert(table.every((row, index) => row.rank === index + 1), "INVALID_VALIDATOR_RANK", "Validator ranks must be contiguous");
  assert(new Set(table.map((row) => row.votePubkey)).size === table.length, "DUPLICATE_VALIDATOR", "Validator vote accounts must be unique");
  assert(table.every((row, index) => index === 0 || BigInt(table[index - 1].activatedStakeLamports) >= BigInt(row.activatedStakeLamports)), "INVALID_VALIDATOR_ORDER", "Validator table must be stake-descending");
  assert(snapshot.validators.top.length === Math.min(10, table.length), "TOP_VALIDATOR_MISMATCH", "Top validators must contain the first ten table rows");
  assert(JSON.stringify(snapshot.validators.top) === JSON.stringify(table.slice(0, snapshot.validators.top.length)), "TOP_VALIDATOR_MISMATCH", "Top validators must match the table prefix");

  const activeStake = table.filter((row) => row.status === "active").reduce((sum, row) => sum + BigInt(row.activatedStakeLamports), 0n);
  const delinquentStake = table.filter((row) => row.status === "delinquent").reduce((sum, row) => sum + BigInt(row.activatedStakeLamports), 0n);
  const totalStake = activeStake + delinquentStake;
  assert(totalStake > 0n, "EMPTY_VALIDATOR_STAKE", "Total validator stake must be positive");
  const stakePct = (stake) => Number(stake * 1_000_000_000_000n / totalStake) / 10_000_000_000;
  assert(snapshot.validators.stake.activeLamports === activeStake.toString(), "VALIDATOR_STAKE_MISMATCH", "Active stake does not match table");
  assert(snapshot.validators.stake.delinquentLamports === delinquentStake.toString(), "VALIDATOR_STAKE_MISMATCH", "Delinquent stake does not match table");
  assert(snapshot.validators.stake.totalLamports === totalStake.toString(), "VALIDATOR_STAKE_MISMATCH", "Total stake does not match table");
  const delinquentPct = stakePct(delinquentStake);
  assert(nearlyEqual(snapshot.validators.stake.delinquentPct, delinquentPct, 1e-7), "VALIDATOR_STAKE_MISMATCH", "Delinquent stake percentage is inconsistent");
  assert(table.every((row) => nearlyEqual(row.stakeSharePct, stakePct(BigInt(row.activatedStakeLamports)), 1e-9)), "VALIDATOR_SHARE_MISMATCH", "Validator stake share is inconsistent");
  const topStake = snapshot.validators.top.reduce((sum, row) => sum + BigInt(row.activatedStakeLamports), 0n);
  assert(nearlyEqual(snapshot.validators.stake.top10Pct, stakePct(topStake), 1e-9), "VALIDATOR_SHARE_MISMATCH", "Top-validator stake share is inconsistent");
  const distributionStake = snapshot.validators.stake.distribution.reduce((sum, row) => sum + BigInt(row.stakeLamports), 0n);
  assert(distributionStake === totalStake, "VALIDATOR_DISTRIBUTION_MISMATCH", "Stake distribution does not cover total stake exactly");
  assert(snapshot.validators.stake.distribution.every((row) => nearlyEqual(row.sharePct, stakePct(BigInt(row.stakeLamports)), 1e-9)), "VALIDATOR_DISTRIBUTION_MISMATCH", "Stake distribution share is inconsistent");
  const expectedDistributionLength = snapshot.validators.top.length + (table.length > snapshot.validators.top.length ? 1 : 0);
  assert(snapshot.validators.stake.distribution.length === expectedDistributionLength, "VALIDATOR_DISTRIBUTION_MISMATCH", "Stake distribution must contain the top validators and optional remainder");
  for (const [index, row] of snapshot.validators.top.entries()) {
    const slice = snapshot.validators.stake.distribution[index];
    assert(slice.votePubkey === row.votePubkey && slice.stakeLamports === row.activatedStakeLamports && slice.status === row.status, "VALIDATOR_DISTRIBUTION_MISMATCH", "Top-validator distribution slice does not match the table");
  }
  if (table.length > snapshot.validators.top.length) {
    const remainder = snapshot.validators.stake.distribution.at(-1);
    assert(remainder.status === "aggregate" && remainder.votePubkey === undefined, "VALIDATOR_DISTRIBUTION_MISMATCH", "Validator distribution remainder must be aggregate");
  }
  const validatorPoint = snapshot.validators.history.find((point) => point.observedAt === snapshot.validators.observedAt);
  assert(Boolean(validatorPoint), "VALIDATOR_HISTORY_MISMATCH", "Current validator observation is missing from history");
  assert(validatorPoint.activeCount === snapshot.validators.counts.active && validatorPoint.delinquentCount === snapshot.validators.counts.delinquent, "VALIDATOR_HISTORY_MISMATCH", "Validator counts do not match history");
  assert(validatorPoint.totalStakeLamports === totalStake.toString() && validatorPoint.delinquentStakeLamports === delinquentStake.toString(), "VALIDATOR_HISTORY_MISMATCH", "Validator stake does not match history");
  assert(nearlyEqual(validatorPoint.delinquentStakePct, delinquentPct, 1e-7), "VALIDATOR_HISTORY_MISMATCH", "Validator delinquency does not match history");
  assert(snapshot.validators.commissionChanges.every((event) => event.previousCommissionPct !== event.commissionPct), "INVALID_COMMISSION_CHANGE", "Commission change events must record an actual change");
  assert(snapshot.validators.commissionChanges.every((event) => Date.parse(event.observedAt) <= Date.parse(snapshot.updatedAt) + 300_000), "FUTURE_COMMISSION_CHANGE", "Commission change is later than the snapshot");

  const price = snapshot.economics.solPrice;
  const currentPricePoint = price.history.find((point) => point.observedAt === price.observedAt);
  assert(Boolean(currentPricePoint) && nearlyEqual(currentPricePoint.priceUsd, price.currentUsd), "PRICE_HISTORY_MISMATCH", "Current SOL price does not match history");
  assert(nearlyEqual(price.change24hPct, (price.currentUsd / price.reference24h.priceUsd - 1) * 100), "PRICE_CHANGE_MISMATCH", "SOL price change is inconsistent with its reference");
  assert((Date.parse(price.observedAt) - Date.parse(price.reference24h.observedAt)) / 1_000 === price.reference24h.elapsedSeconds, "PRICE_WINDOW_MISMATCH", "SOL price reference timestamps disagree with elapsedSeconds");

  const tvl = snapshot.economics.tvlAlertInput;
  const tvlLatest = tvl.history.at(-1);
  const tvlPrevious = tvl.history.at(-2);
  assert(tvl.latest.date === tvlLatest.date && nearlyEqual(tvl.latest.valueUsd, tvlLatest.valueUsd), "TVL_HISTORY_MISMATCH", "TVL headline does not match latest history");
  assert(tvl.previous.date === tvlPrevious.date && nearlyEqual(tvl.previous.valueUsd, tvlPrevious.valueUsd), "TVL_HISTORY_MISMATCH", "TVL reference does not match history");
  assert(Date.parse(`${tvlLatest.date}T00:00:00.000Z`) - Date.parse(`${tvlPrevious.date}T00:00:00.000Z`) === 86_400_000, "TVL_WINDOW_MISMATCH", "TVL comparison dates are not adjacent");
  assert(nearlyEqual(tvl.change1dPct, (tvl.latest.valueUsd / tvl.previous.valueUsd - 1) * 100), "TVL_CHANGE_MISMATCH", "TVL change is inconsistent");

  const stablecoin = snapshot.economics.stablecoinSupply;
  const stablecoinLatest = stablecoin.history.at(-1);
  assert(stablecoin.date === stablecoinLatest.date && nearlyEqual(stablecoin.totalCirculatingUsd, stablecoinLatest.totalCirculatingUsd), "STABLECOIN_HISTORY_MISMATCH", "Stablecoin headline does not match history");

  const dex = snapshot.economics.dexVolume;
  const dexLatest = dex.history.at(-1);
  assert(dex.date === dexLatest.date && nearlyEqual(dex.dailyVolumeUsd, dexLatest.dailyVolumeUsd), "DEX_HISTORY_MISMATCH", "DEX headline does not match history");

  const rev = snapshot.economics.rev;
  assert(nearlyEqual(rev.totalSol, rev.components.transactionFeesSol + rev.components.grossJitoTipsSol), "REV_COMPONENT_MISMATCH", "REV total does not equal its components");
  const feeValues = rev.feeConsensus.providers.map((provider) => provider.valueSol);
  assert(nearlyEqual(rev.feeConsensus.minSol, Math.min(...feeValues)), "REV_CONSENSUS_MISMATCH", "REV fee minimum is inconsistent");
  assert(nearlyEqual(rev.feeConsensus.maxSol, Math.max(...feeValues)), "REV_CONSENSUS_MISMATCH", "REV fee maximum is inconsistent");
  assert(new Set(rev.feeConsensus.providers.map((provider) => provider.name)).size === 2, "REV_CONSENSUS_MISMATCH", "REV fee providers must be unique");
  const revLatest = rev.history.at(-1);
  assert(rev.date === revLatest.date && nearlyEqual(rev.totalSol, revLatest.totalSol), "REV_HISTORY_MISMATCH", "REV headline does not match history");
  assert(nearlyEqual(rev.components.transactionFeesSol, revLatest.transactionFeesSol) && nearlyEqual(rev.components.grossJitoTipsSol, revLatest.grossJitoTipsSol), "REV_HISTORY_MISMATCH", "REV components do not match history");
  assert(revLatest.feeProviderCount === 2 && nearlyEqual(revLatest.feeProviderMinSol, rev.feeConsensus.minSol) && nearlyEqual(revLatest.feeProviderMaxSol, rev.feeConsensus.maxSol), "REV_HISTORY_MISMATCH", "REV provider evidence does not match history");
  assert(rev.history.every((point) => point.feeProviderCount === 2 && nearlyEqual(point.totalSol, point.transactionFeesSol + point.grossJitoTipsSol) && nearlyEqual(point.transactionFeesSol, (point.feeProviderMinSol + point.feeProviderMaxSol) / 2)), "REV_HISTORY_MISMATCH", "REV history contains incoherent components or provider consensus");

  const fee = snapshot.economics.medianTransactionFee;
  const feePoint = fee.history.find((point) => point.observedAt === fee.observedAt);
  assert(Boolean(feePoint) && nearlyEqual(fee.medianLamports, feePoint.medianLamports), "FEE_HISTORY_MISMATCH", "Median-fee headline does not match history");
  assert(fee.sample.transactionCount === feePoint.transactionCount && fee.sample.selectedBlockCount === feePoint.selectedBlockCount, "FEE_HISTORY_MISMATCH", "Median-fee sample does not match history");
  const feeWindowSlots = BigInt(fee.sample.endSlot) - BigInt(fee.sample.startSlot) + 1n;
  assert(feeWindowSlots > 0n && BigInt(fee.sample.producedSlotCount) <= feeWindowSlots, "INVALID_FEE_SAMPLE", "Median-fee produced-slot population exceeds its window");
  assert(fee.sample.selectedBlockCount <= fee.sample.producedSlotCount && fee.sample.transactionCount >= fee.sample.selectedBlockCount, "INVALID_FEE_SAMPLE", "Median-fee sample counts are incoherent");

  const rwa = snapshot.ecosystem.tokenizedAssets;
  assert(rwa.equityTransferVolumeUsd <= rwa.totalTransferVolumeUsd, "RWA_SUBSET_MISMATCH", "Tokenized-equity volume exceeds total tokenized-asset volume");
  const rwaPoint = rwa.history.find((point) => point.observedAt === rwa.observedAt);
  assert(Boolean(rwaPoint) && nearlyEqual(rwa.totalTransferVolumeUsd, rwaPoint.totalTransferVolumeUsd) && nearlyEqual(rwa.equityTransferVolumeUsd, rwaPoint.equityTransferVolumeUsd), "RWA_HISTORY_MISMATCH", "Tokenized-asset headline does not match history");

  const addresses = snapshot.ecosystem.dailyActiveAddresses;
  assert(new Set(addresses.providers.map((provider) => provider.name)).size === 2, "ADDRESS_CONSENSUS_MISMATCH", "Active-address providers must be unique");
  const addressValues = Object.fromEntries(addresses.providers.map((provider) => [provider.name, provider.value]));
  assert(nearlyEqual(addresses.value, (addressValues.Allium + addressValues.Dune) / 2), "ADDRESS_CONSENSUS_MISMATCH", "Active-address value is not the provider median");
  const addressLatest = addresses.history.at(-1);
  assert(addresses.date === addressLatest.date && nearlyEqual(addresses.value, addressLatest.value), "ADDRESS_HISTORY_MISMATCH", "Active-address headline does not match history");
  assert(addressLatest.allium === addressValues.Allium && addressLatest.dune === addressValues.Dune, "ADDRESS_HISTORY_MISMATCH", "Active-address providers do not match history");
  assert(addresses.history.every((point) => nearlyEqual(point.value, (point.allium + point.dune) / 2)), "ADDRESS_HISTORY_MISMATCH", "Active-address history contains an invalid provider median");

  assert(snapshot.alertChecks.map((check) => check.id).every((id, index) => id === EXPECTED_ALERT_IDS[index]), "INVALID_ALERT_CHECK_ORDER", "Alert checks must use the fixed order");
  for (const check of snapshot.alertChecks) {
    if (check.status === "unavailable") {
      assert(Boolean(check.reasonCode), "MISSING_ALERT_REASON", "Unavailable alert checks must include a reason code");
    } else {
      assert(Boolean(check.observedAt), "MISSING_ALERT_OBSERVATION", "Evaluated alert checks must include an observation timestamp");
    }
  }
  const checksById = new Map(snapshot.alertChecks.map((check) => [check.id, check]));
  assert(new Set(snapshot.alerts.map((alert) => alert.id)).size === snapshot.alerts.length, "DUPLICATE_ALERT", "Active alert IDs must be unique");
  for (const alert of snapshot.alerts) {
    assert(checksById.get(alert.checkId)?.status === "triggered", "ORPHAN_ALERT", "Every active alert must reference a triggered check");
  }
  for (const check of snapshot.alertChecks.filter((item) => item.status === "triggered")) {
    assert(snapshot.alerts.some((alert) => alert.checkId === check.id), "MISSING_ACTIVE_ALERT", "Every triggered check must have an active alert");
  }

  return snapshot;
}

export function parseCanonicalSnapshot(value, limits) {
  const parsed = canonicalSnapshotSchema.parse(value);
  return validateCanonicalInvariants(parsed, limits);
}

export function serializeCanonicalSnapshot(snapshot, limits) {
  const parsed = parseCanonicalSnapshot(snapshot, limits);
  return `${JSON.stringify(parsed, null, 2)}\n`;
}
