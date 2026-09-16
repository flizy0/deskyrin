export const ARCHIVED_COLLECTION_GAP_ID = "collection-gap-2026-08-26";

export function retainCoverageIncidents(previousIncidents) {
  return Array.isArray(previousIncidents)
    ? previousIncidents
      .filter((incident) => incident?.id !== ARCHIVED_COLLECTION_GAP_ID)
      .map((incident) => structuredClone(incident))
    : [];
}
