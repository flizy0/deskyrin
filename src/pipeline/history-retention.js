import { SNAPSHOT_HISTORY_START_AT } from "./config.js";
import { ARCHIVED_COLLECTION_GAP_ID, retainCoverageIncidents } from "./coverage.js";
import { PipelineError } from "./lib/errors.js";
import { isoTimestamp } from "./lib/time.js";

// Only project-collected observations are bounded here. Provider-dated histories
// (including SOL prices, daily metrics, and comparisons) retain their own windows.
const SNAPSHOT_DOMAIN_PATHS = [
  ["network", "performance"],
  ["validators"],
  ["economics", "medianTransactionFee"],
  ["ecosystem", "tokenizedAssets"]
];

function domainAt(snapshot, path) {
  return path.reduce((value, key) => value?.[key], snapshot);
}

function retentionStart(snapshot, startAt) {
  const start = isoTimestamp(startAt, "snapshot history start");
  // Historical fixtures and archived publications retain their original contract.
  return snapshot.updatedAt >= start ? start : null;
}

export function applySnapshotHistoryRetention(snapshot, startAt = SNAPSHOT_HISTORY_START_AT) {
  const start = retentionStart(snapshot, startAt);
  if (!start) return snapshot;
  const retained = structuredClone(snapshot);
  for (const path of SNAPSHOT_DOMAIN_PATHS) {
    const domain = domainAt(retained, path);
    if (!domain) continue;
    domain.history = domain.history.filter((point) => point.observedAt >= start);
    if (domain.history.length === 0) {
      throw new PipelineError("EMPTY_RETAINED_SNAPSHOT_HISTORY", `${path.join(".")} has no observation at or after ${start}`);
    }
  }
  if (retained.validators) {
    retained.validators.commissionChanges = retained.validators.commissionChanges
      .filter((event) => event.detectedAt >= start)
      .map((event) => ({
        ...event,
        previousObservedAt: event.previousObservedAt && event.previousObservedAt < start
          ? null
          : event.previousObservedAt
      }));
  }
  const tokenized = retained.ecosystem?.tokenizedAssets;
  if (tokenized?.legacyTransferVolume) {
    const history = tokenized.legacyTransferVolume.history.filter((point) => point.observedAt >= start);
    if (history.length) tokenized.legacyTransferVolume.history = history;
    else delete tokenized.legacyTransferVolume;
  }
  if (retained.coverageIncidents) retained.coverageIncidents = retainCoverageIncidents(retained.coverageIncidents);
  return retained;
}

export function assertSnapshotHistoryRetention(snapshot, startAt = SNAPSHOT_HISTORY_START_AT) {
  const start = retentionStart(snapshot, startAt);
  if (!start) return;
  const histories = SNAPSHOT_DOMAIN_PATHS.map((path) => domainAt(snapshot, path)?.history)
    .concat([snapshot.ecosystem?.tokenizedAssets?.legacyTransferVolume?.history]);
  const hasOldHistory = histories.some((history) => history?.some((point) => point.observedAt < start));
  const hasOldCommission = snapshot.validators?.commissionChanges.some((event) =>
    event.detectedAt < start || event.previousObservedAt !== null && event.previousObservedAt < start
  );
  const hasArchivedGap = snapshot.coverageIncidents?.some((incident) => incident.id === ARCHIVED_COLLECTION_GAP_ID);
  if (hasOldHistory || hasOldCommission || hasArchivedGap) {
    throw new PipelineError("SNAPSHOT_HISTORY_RETENTION_VIOLATION", `Published snapshot histories must start at or after ${start} and exclude archived collection coverage`);
  }
}
