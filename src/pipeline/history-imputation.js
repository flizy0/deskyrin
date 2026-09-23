import { PipelineError } from "./lib/errors.js";

export const IMPUTATION_METHOD = "linear_between_observations";
export const NETWORK_RECOVERY_SOURCE = "solana_rpc_performance_samples";

const HOUR_MS = 60 * 60 * 1_000;
const TOKENIZED_CADENCE_MS = 6 * HOUR_MS;
const HOURLY_VISIBLE_GAP_MS = 6 * HOUR_MS;
const TOKENIZED_VISIBLE_GAP_MS = 36 * HOUR_MS;

function assert(condition, code, message) {
  if (!condition) throw new PipelineError(code, message);
}

function interpolateNumber(left, right, numerator, denominator) {
  return (left * (denominator - numerator) + right * numerator) / denominator;
}

function interpolateInteger(left, right, numerator, denominator) {
  return Math.round(interpolateNumber(left, right, numerator, denominator));
}

function interpolateBigInt(left, right, numerator, denominator) {
  const lower = BigInt(left);
  const upper = BigInt(right);
  const divisor = BigInt(denominator);
  const rounded = (lower * BigInt(denominator - numerator) + upper * BigInt(numerator) + divisor / 2n) / divisor;
  return rounded.toString();
}

function stakePercentage(delinquent, total) {
  const totalStake = BigInt(total);
  if (totalStake === 0n) return 0;
  return Number(BigInt(delinquent) * 1_000_000_000_000n / totalStake) / 10_000_000_000;
}

function interpolatedTimestamp(left, right, numerator, denominator) {
  const lower = Date.parse(left);
  const upper = Date.parse(right);
  return new Date(lower + Math.round((upper - lower) * numerator / denominator)).toISOString();
}

function withoutExistingImputations(history) {
  return history.filter((point) => point.imputed !== true);
}

function capRepairedHistory(history, limit) {
  if (history.length <= limit) return history;
  const start = history.length - limit;
  const capped = history.slice(start);
  if (capped[0].imputed !== true) return capped;
  const leftAnchor = history.slice(0, start).findLast((point) => point.imputed !== true);
  return leftAnchor ? [leftAnchor, ...capped.slice(1)] : capped;
}

export function imputeBoundedHistory(history, {
  cadenceMs,
  interpolate,
  label,
  limit,
  minimumGapMs = cadenceMs * 1.5
}) {
  assert(Array.isArray(history) && history.length > 0, "INVALID_IMPUTATION_HISTORY", `${label} history is empty`);
  assert(Number.isFinite(minimumGapMs) && minimumGapMs > 0, "INVALID_IMPUTATION_THRESHOLD", `${label} minimum gap must be positive`);
  assert(Number.isInteger(limit) && limit > 0, "INVALID_IMPUTATION_LIMIT", `${label} history limit must be positive`);
  const observed = withoutExistingImputations(history);
  assert(observed.length > 0, "INVALID_IMPUTATION_HISTORY", `${label} has no observed points`);
  const repaired = [];

  for (let index = 0; index < observed.length; index += 1) {
    const left = observed[index];
    repaired.push(left);
    const right = observed[index + 1];
    if (!right) continue;
    const gapMs = Date.parse(right.observedAt) - Date.parse(left.observedAt);
    assert(Number.isFinite(gapMs) && gapMs > 0, "INVALID_IMPUTATION_HISTORY", `${label} must be strictly chronological`);
    if (gapMs <= minimumGapMs) continue;

    const missingCount = Math.max(0, Math.round(gapMs / cadenceMs) - 1);
    assert(missingCount < limit, "IMPUTED_GAP_TOO_LARGE", `${label} gap exceeds the bounded repair window`);
    const denominator = missingCount + 1;
    for (let numerator = 1; numerator <= missingCount; numerator += 1) {
      repaired.push({
        ...interpolate(left, right, numerator, denominator),
        observedAt: interpolatedTimestamp(left.observedAt, right.observedAt, numerator, denominator),
        imputed: true
      });
    }
  }

  return capRepairedHistory(repaired, limit);
}

function addRecoveredNetworkPoints(history, recoveredPoints) {
  const byTime = new Map(history.map((point) => [point.observedAt, point]));
  const first = Date.parse(history[0].observedAt);
  const last = Date.parse(history.at(-1).observedAt);
  for (const point of recoveredPoints) {
    const time = Date.parse(point.observedAt);
    assert(Number.isFinite(time) && time > first && time < last, "INVALID_RECOVERED_POINT", "Recovered TPS point must be bounded by retained observations");
    assert(
      Number.isFinite(point.totalTps)
        && Number.isFinite(point.nonVoteTps)
        && Number.isFinite(point.slotTimeMs)
        && point.totalTps >= point.nonVoteTps
        && point.nonVoteTps >= 0
        && point.slotTimeMs > 0,
      "INVALID_RECOVERED_POINT",
      `Recovered TPS point ${point.observedAt} is incoherent`
    );
    const existing = byTime.get(point.observedAt);
    if (existing) {
      const sameRecoveredPoint = existing.recoveredFrom === NETWORK_RECOVERY_SOURCE
        && existing.totalTps === point.totalTps
        && existing.nonVoteTps === point.nonVoteTps
        && existing.slotTimeMs === point.slotTimeMs;
      assert(sameRecoveredPoint, "CONFLICTING_RECOVERED_POINT", `Network history already contains ${point.observedAt}`);
      continue;
    }
    byTime.set(point.observedAt, {
      ...point,
      recoveredFrom: NETWORK_RECOVERY_SOURCE
    });
  }
  return [...byTime.values()].sort((left, right) => left.observedAt.localeCompare(right.observedAt));
}

function networkPoint(left, right, numerator, denominator) {
  return {
    totalTps: interpolateNumber(left.totalTps, right.totalTps, numerator, denominator),
    nonVoteTps: interpolateNumber(left.nonVoteTps, right.nonVoteTps, numerator, denominator),
    slotTimeMs: interpolateNumber(left.slotTimeMs, right.slotTimeMs, numerator, denominator)
  };
}

function validatorPoint(left, right, numerator, denominator) {
  const totalStakeLamports = interpolateBigInt(left.totalStakeLamports, right.totalStakeLamports, numerator, denominator);
  const delinquentStakeLamports = interpolateBigInt(left.delinquentStakeLamports, right.delinquentStakeLamports, numerator, denominator);
  return {
    activeCount: Math.max(0, interpolateInteger(left.activeCount, right.activeCount, numerator, denominator)),
    delinquentCount: Math.max(0, interpolateInteger(left.delinquentCount, right.delinquentCount, numerator, denominator)),
    totalStakeLamports,
    delinquentStakeLamports,
    delinquentStakePct: stakePercentage(delinquentStakeLamports, totalStakeLamports)
  };
}

function medianFeePoint(left, right, numerator, denominator) {
  return {
    medianLamports: interpolateNumber(left.medianLamports, right.medianLamports, numerator, denominator),
    transactionCount: Math.max(1, interpolateInteger(left.transactionCount, right.transactionCount, numerator, denominator)),
    selectedBlockCount: Math.max(1, interpolateInteger(left.selectedBlockCount, right.selectedBlockCount, numerator, denominator))
  };
}

function tokenizedPoint(left, right, numerator, denominator) {
  const totalSpotVolume30dUsd = Math.max(0, interpolateNumber(left.totalSpotVolume30dUsd, right.totalSpotVolume30dUsd, numerator, denominator));
  const equitySpotVolume30dUsd = Math.min(totalSpotVolume30dUsd, Math.max(0, interpolateNumber(left.equitySpotVolume30dUsd, right.equitySpotVolume30dUsd, numerator, denominator)));
  const indexedAssetCount = Math.max(1, interpolateInteger(left.indexedAssetCount, right.indexedAssetCount, numerator, denominator));
  const indexedEquityCount = Math.min(indexedAssetCount, Math.max(1, interpolateInteger(left.indexedEquityCount, right.indexedEquityCount, numerator, denominator)));
  const coveredAssetCount = Math.min(indexedAssetCount, Math.max(1, interpolateInteger(left.coveredAssetCount, right.coveredAssetCount, numerator, denominator)));
  const coveredEquityCount = Math.min(
    indexedEquityCount,
    coveredAssetCount,
    Math.max(1, interpolateInteger(left.coveredEquityCount, right.coveredEquityCount, numerator, denominator))
  );
  return {
    totalSpotVolume30dUsd,
    equitySpotVolume30dUsd,
    indexedAssetCount,
    indexedEquityCount,
    coveredAssetCount,
    coveredEquityCount
  };
}

function historyStats(history) {
  return {
    points: history.length,
    recovered: history.filter((point) => point.recoveredFrom).length,
    imputed: history.filter((point) => point.imputed === true).length
  };
}

export function repairSnapshotHistoryGaps(snapshot, {
  recoveredNetworkPoints = [],
  hourlyLimit = 720,
  tokenizedLimit = 365
} = {}) {
  const repaired = structuredClone(snapshot);
  const networkHistory = addRecoveredNetworkPoints(repaired.network.performance.history, recoveredNetworkPoints);
  repaired.network.performance.history = imputeBoundedHistory(networkHistory, {
    cadenceMs: HOUR_MS,
    interpolate: networkPoint,
    label: "network performance",
    limit: hourlyLimit,
    minimumGapMs: HOURLY_VISIBLE_GAP_MS
  });
  repaired.validators.history = imputeBoundedHistory(repaired.validators.history, {
    cadenceMs: HOUR_MS,
    interpolate: validatorPoint,
    label: "validator",
    limit: hourlyLimit,
    minimumGapMs: HOURLY_VISIBLE_GAP_MS
  });
  repaired.economics.medianTransactionFee.history = imputeBoundedHistory(repaired.economics.medianTransactionFee.history, {
    cadenceMs: HOUR_MS,
    interpolate: medianFeePoint,
    label: "median-fee",
    limit: hourlyLimit,
    minimumGapMs: HOURLY_VISIBLE_GAP_MS
  });
  repaired.ecosystem.tokenizedAssets.history = imputeBoundedHistory(repaired.ecosystem.tokenizedAssets.history, {
    cadenceMs: TOKENIZED_CADENCE_MS,
    interpolate: tokenizedPoint,
    label: "tokenized-market",
    limit: tokenizedLimit,
    minimumGapMs: TOKENIZED_VISIBLE_GAP_MS
  });

  return {
    snapshot: repaired,
    summary: {
      networkPerformance: historyStats(repaired.network.performance.history),
      validators: historyStats(repaired.validators.history),
      medianTransactionFee: historyStats(repaired.economics.medianTransactionFee.history),
      tokenizedMarkets: historyStats(repaired.ecosystem.tokenizedAssets.history)
    }
  };
}
