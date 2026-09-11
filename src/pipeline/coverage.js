import { isoTimestamp } from "./lib/time.js";

const COLLECTION_GAP_ID = "collection-gap-2026-08-26";
const COLLECTION_GAP_STARTED_AT = "2026-08-26T17:57:44.334Z";
const AFFECTED_METRICS = Object.freeze([
  "TPS",
  "Non-vote TPS",
  "Slot time",
  "Validator snapshots and commission tracking",
  "Sampled median transaction fee"
]);
const REASON = "Scheduled collection did not publish during part of this interval, and the first subsequent publication was rejected by canonical commission-history ordering validation.";
const DISCLOSURE = "No values were interpolated. Provider-dated histories may be retrieved after recovery.";

export function buildCoverageIncidents(previousIncidents, recovery, observedAt, firstMissedAt = COLLECTION_GAP_STARTED_AT) {
  const observation = isoTimestamp(observedAt, "coverage observation");
  const retained = Array.isArray(previousIncidents)
    ? previousIncidents
      .filter((incident) => incident?.id !== COLLECTION_GAP_ID)
      .map((incident) => ({
        ...incident,
        affectedMetrics: Array.isArray(incident.affectedMetrics) ? [...incident.affectedMetrics] : incident.affectedMetrics
      }))
    : [];
  const previous = Array.isArray(previousIncidents)
    ? previousIncidents.find((incident) => incident?.id === COLLECTION_GAP_ID)
    : undefined;
  const startedAt = previous?.startedAt
    ? isoTimestamp(previous.startedAt, "coverage incident start")
    : isoTimestamp(firstMissedAt, "first missed collection");
  if (!previous && Date.parse(observation) < Date.parse(startedAt)) return retained;
  const previousEnd = typeof previous?.endedAt === "string"
    ? isoTimestamp(previous.endedAt, "coverage incident end")
    : null;
  const endedAt = previousEnd || (recovery === true
    ? observation
    : null);

  return [...retained, {
    id: COLLECTION_GAP_ID,
    status: endedAt ? "resolved" : "ongoing",
    startedAt,
    endedAt,
    affectedMetrics: [...AFFECTED_METRICS],
    reason: REASON,
    disclosure: DISCLOSURE
  }];
}
