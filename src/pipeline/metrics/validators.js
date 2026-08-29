import { PipelineError } from "../lib/errors.js";
import { appendHistory, normalizeHistory } from "../lib/history.js";
import { decimalBigInt } from "../lib/numbers.js";
import { isoTimestamp } from "../lib/time.js";

function percentage(part, total) {
  if (total <= 0n) throw new PipelineError("EMPTY_VALIDATOR_STAKE", "Activated validator stake must be positive");
  return Number(part * 1_000_000_000_000n / total) / 10_000_000_000;
}

export function calculateValidators(voteAccounts, now, previousValidators, config) {
  const combined = [
    ...voteAccounts.current.map((row) => ({ ...row, status: "active" })),
    ...voteAccounts.delinquent.map((row) => ({ ...row, status: "delinquent" }))
  ].map((row) => ({ ...row, stake: decimalBigInt(row.activatedStake, "activatedStake") }))
    .filter((row) => row.stake > 0n);

  if (combined.length < config.rpc.minimumValidatorCount) {
    throw new PipelineError("IMPLAUSIBLE_VALIDATOR_SET", `Solana mainnet returned only ${combined.length} staked validators`);
  }
  const keys = new Set(combined.map((row) => row.votePubkey));
  if (keys.size !== combined.length) throw new PipelineError("DUPLICATE_VOTE_ACCOUNT", "Vote account response contains duplicate keys");
  const previousCount = previousValidators?.table?.length;
  if (previousCount && combined.length * 100 < previousCount * config.rpc.minimumValidatorRetentionPct) {
    throw new PipelineError("ABRUPT_VALIDATOR_COUNT_DROP", `Validator count fell from ${previousCount} to ${combined.length}`);
  }

  combined.sort((left, right) => left.stake === right.stake
    ? left.votePubkey.localeCompare(right.votePubkey)
    : left.stake > right.stake ? -1 : 1);
  const activeStake = combined.filter((row) => row.status === "active").reduce((sum, row) => sum + row.stake, 0n);
  const delinquentStake = combined.filter((row) => row.status === "delinquent").reduce((sum, row) => sum + row.stake, 0n);
  const totalStake = activeStake + delinquentStake;
  const previousStake = previousValidators?.stake?.totalLamports ? BigInt(previousValidators.stake.totalLamports) : undefined;
  if (previousStake && totalStake * 100n < previousStake * BigInt(config.rpc.minimumValidatorRetentionPct)) {
    throw new PipelineError("ABRUPT_VALIDATOR_STAKE_DROP", "Total activated stake fell beyond the validation threshold");
  }
  const table = combined.map((row, index) => ({
    rank: index + 1,
    votePubkey: row.votePubkey,
    nodePubkey: row.nodePubkey,
    status: row.status,
    activatedStakeLamports: row.stake.toString(),
    stakeSharePct: percentage(row.stake, totalStake),
    commissionPct: row.commission
  }));
  const top = table.slice(0, config.display.topValidators);
  const topStake = combined.slice(0, config.display.topValidators).reduce((sum, row) => sum + row.stake, 0n);
  const otherStake = totalStake - topStake;
  const distribution = top.map((row) => ({
    label: `#${row.rank}`,
    votePubkey: row.votePubkey,
    stakeLamports: row.activatedStakeLamports,
    sharePct: row.stakeSharePct,
    status: row.status
  }));
  if (otherStake > 0n) {
    distribution.push({
      label: "Other validators",
      stakeLamports: otherStake.toString(),
      sharePct: percentage(otherStake, totalStake),
      status: "aggregate"
    });
  }
  const observedAt = isoTimestamp(now);
  const activeCount = table.filter((row) => row.status === "active").length;
  const delinquentCount = table.length - activeCount;
  const delinquentPct = percentage(delinquentStake, totalStake);
  const historyPoint = {
    observedAt,
    activeCount,
    delinquentCount,
    totalStakeLamports: totalStake.toString(),
    delinquentStakeLamports: delinquentStake.toString(),
    delinquentStakePct: delinquentPct
  };
  const previousObservedAt = previousValidators?.observedAt
    ? isoTimestamp(previousValidators.observedAt, "previous validator observation")
    : null;
  if (previousObservedAt && Date.parse(previousObservedAt) >= Date.parse(observedAt)) {
    throw new PipelineError("INVALID_VALIDATOR_TIMELINE", "Previous validator observation must precede the current observation");
  }
  const previousCommission = new Map((previousValidators?.table || []).map((row) => [row.votePubkey, row.commissionPct]));
  const newCommissionChanges = table.flatMap((row) => {
    const oldCommissionPct = previousCommission.get(row.votePubkey);
    if (oldCommissionPct === undefined || oldCommissionPct === row.commissionPct) return [];
    return [{
      previousObservedAt,
      detectedAt: observedAt,
      votePubkey: row.votePubkey,
      previousCommissionPct: oldCommissionPct,
      commissionPct: row.commissionPct
    }];
  });
  const commissionChanges = normalizeHistory([
    ...(previousValidators?.commissionChanges || []),
    ...newCommissionChanges
  ], {
    key: (point) => `${point.detectedAt}|${point.votePubkey}`,
    limit: config.history.commissionEvents
  });

  return {
    status: "fresh",
    observedAt,
    sourceIds: ["solanaRpc"],
    delinquencyDistanceSlots: config.rpc.delinquencyDistanceSlots,
    counts: { active: activeCount, delinquent: delinquentCount, total: table.length },
    stake: {
      activeLamports: activeStake.toString(),
      delinquentLamports: delinquentStake.toString(),
      totalLamports: totalStake.toString(),
      delinquentPct,
      top10Pct: percentage(topStake, totalStake),
      distribution
    },
    top,
    table,
    commissionChanges,
    history: appendHistory(previousValidators?.history, historyPoint, {
      key: (point) => point.observedAt,
      limit: config.history.hourlyPoints
    })
  };
}
