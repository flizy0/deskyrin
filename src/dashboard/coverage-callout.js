import { fmt } from "./format.js";
import { el } from "./ui.js";

export function selectCoverageIncidents(snapshot, affectedMetrics = []) {
  const incidents = Array.isArray(snapshot?.coverageIncidents) ? snapshot.coverageIncidents : [];
  if (!affectedMetrics.length) return incidents;
  const selected = new Set(affectedMetrics);
  return incidents.filter((incident) => incident.affectedMetrics.some((metric) => selected.has(metric)));
}

export function coverageGapCallout(snapshot, { affectedMetrics = [] } = {}) {
  const incidents = selectCoverageIncidents(snapshot, affectedMetrics);
  if (!incidents.length) return null;

  const callout = el("aside", "coverage-callout");
  callout.setAttribute("aria-label", "Known collection coverage gap");

  for (const incident of incidents) {
    const item = el("div", `coverage-incident ${incident.status}`);
    const head = el("div", "coverage-incident-head");
    const title = el("div", "coverage-incident-title");
    title.append(el("span", "status-dot"), el("strong", undefined, "Known collection gap"));
    const state = el("span", "coverage-incident-state", incident.status === "resolved" ? "Resolved" : "Ongoing");
    head.append(title, state);

    const relevantMetrics = affectedMetrics.length
      ? incident.affectedMetrics.filter((metric) => affectedMetrics.includes(metric))
      : incident.affectedMetrics;
    const end = incident.endedAt ? fmt.utc(incident.endedAt) : "recovery pending";
    const detail = el("p", "coverage-incident-detail");
    detail.append(
      el("span", "coverage-incident-window", `${fmt.utc(incident.startedAt)} – ${end}`),
      document.createTextNode(` · ${relevantMetrics.join(", ")}`)
    );
    item.append(head, detail, el("p", "coverage-incident-copy", `${incident.reason} ${incident.disclosure}`));
    callout.append(item);
  }

  return callout;
}
