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
const MEDIAN_FEE_GAP = Object.freeze({
  id: "median-fee-gap-2026-09-02",
  status: "resolved",
  startedAt: "2026-09-02T01:34:05.253Z",
  endedAt: "2026-09-02T12:31:57.796Z",
  affectedMetrics: Object.freeze(["Sampled median transaction fee"]),
  reason: "The Solana RPC returned null for a selected finalized block across consecutive due attempts, so the required complete block sample was not published.",
  disclosure: "No values were interpolated. Exact selected-block null responses are now retried; persistent absence still leaves the metric stale."
});

function copyIncident(incident) {
  return { ...incident, affectedMetrics: [...incident.affectedMetrics] };
}

export function buildCoverageIncidents(previousIncidents, recovery, observedAt, firstMissedAt = COLLECTION_GAP_STARTED_AT) {
  const observation = isoTimestamp(observedAt, "coverage observation");
  const retained = Array.isArray(previousIncidents)
    ? previousIncidents
      .filter((incident) => incident?.id !== COLLECTION_GAP_ID && incident?.id !== MEDIAN_FEE_GAP.id)
      .map((incident) => Array.isArray(incident.affectedMetrics) ? copyIncident(incident) : { ...incident })
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

  const incidents = [...retained, {
    id: COLLECTION_GAP_ID,
    status: endedAt ? "resolved" : "ongoing",
    startedAt,
    endedAt,
    affectedMetrics: [...AFFECTED_METRICS],
    reason: REASON,
    disclosure: DISCLOSURE
  }];
  if (Date.parse(observation) >= Date.parse(MEDIAN_FEE_GAP.startedAt)) {
    incidents.push(copyIncident(MEDIAN_FEE_GAP));
  }
  return incidents;
}
