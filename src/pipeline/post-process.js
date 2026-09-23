import { isDeepStrictEqual } from "node:util";
import { parseCanonicalSnapshot } from "./contracts/canonical.js";
import { repairSnapshotHistoryGaps } from "./history-imputation.js";
import { applySnapshotHistoryRetention } from "./history-retention.js";
import { PipelineError, safeError } from "./lib/errors.js";
import { notifyUnhandledPipelineIssue } from "./notifications.js";

const HISTORY_TARGETS = Object.freeze([
  {
    path: "network.performance.history",
    get: (snapshot) => snapshot.network.performance.history
  },
  {
    path: "validators.history",
    get: (snapshot) => snapshot.validators.history
  },
  {
    path: "economics.medianTransactionFee.history",
    get: (snapshot) => snapshot.economics.medianTransactionFee.history
  },
  {
    path: "ecosystem.tokenizedAssets.history",
    get: (snapshot) => snapshot.ecosystem.tokenizedAssets.history
  }
]);

function historyStats(history) {
  return {
    points: history.length,
    recovered: history.filter((point) => point.recoveredFrom).length,
    imputed: history.filter((point) => point.imputed === true).length
  };
}

function repairReasons(before, after) {
  const reasons = [];
  if (after.recovered > before.recovered) reasons.push("RECOVERED_SOURCE_EVIDENCE");
  if (after.imputed > before.imputed) reasons.push("VISIBLE_HISTORY_GAP");
  if (after.imputed < before.imputed) reasons.push("STALE_HISTORY_ESTIMATES");
  if (reasons.length === 0) reasons.push("NON_CANONICAL_HISTORY");
  return reasons;
}

function requireHistoryConfig(history) {
  if (
    !history
    || !Number.isInteger(history.hourlyPoints)
    || !Number.isInteger(history.tokenizedPoints)
    || typeof history.snapshotStartAt !== "string"
  ) {
    throw new PipelineError("INVALID_POST_PROCESS_CONFIG", "Snapshot post-process requires canonical history limits");
  }
}

export function applyKnownSnapshotRepairs(snapshot, history, { recoveredNetworkPoints = [] } = {}) {
  requireHistoryConfig(history);
  const result = repairSnapshotHistoryGaps(snapshot, {
    recoveredNetworkPoints,
    hourlyLimit: history.hourlyPoints,
    tokenizedLimit: history.tokenizedPoints
  });
  const repairs = HISTORY_TARGETS.flatMap((target) => {
    const beforeHistory = target.get(snapshot);
    const afterHistory = target.get(result.snapshot);
    if (isDeepStrictEqual(beforeHistory, afterHistory)) return [];
    const before = historyStats(beforeHistory);
    const after = historyStats(afterHistory);
    return [{
      history: target.path,
      reasons: repairReasons(before, after),
      before,
      after
    }];
  });
  return {
    snapshot: repairs.length > 0 ? result.snapshot : snapshot,
    applied: repairs.length > 0,
    repairs,
    summary: result.summary
  };
}

export function assertSnapshotAutoRepairStable(snapshot, history) {
  const result = applyKnownSnapshotRepairs(snapshot, history);
  if (!result.applied) return;
  const paths = result.repairs.map((repair) => repair.history).join(", ");
  throw new PipelineError(
    "SNAPSHOT_AUTO_REPAIR_REQUIRED",
    `Snapshot requires known history repair before publication: ${paths}`,
    { details: result.repairs }
  );
}

export async function postProcessSnapshot(snapshot, {
  config,
  context = "snapshot",
  notify = notifyUnhandledPipelineIssue,
  recoveredNetworkPoints = []
} = {}) {
  try {
    requireHistoryConfig(config?.history);
    const autoRepair = applyKnownSnapshotRepairs(snapshot, config.history, { recoveredNetworkPoints });
    const retained = applySnapshotHistoryRetention(autoRepair.snapshot, config.history.snapshotStartAt);
    const parsed = parseCanonicalSnapshot(retained, config.history);
    return { snapshot: parsed, autoRepair };
  } catch (error) {
    const issue = {
      kind: "unhandled_snapshot_issue",
      context,
      error: safeError(error)
    };
    try {
      await notify(issue);
    } catch {
      // Notification delivery must never replace the original pipeline failure.
    }
    throw error;
  }
}
