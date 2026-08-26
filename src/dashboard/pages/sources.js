import { fmt } from "../format.js";
import { appendTableRow, createTable, makeSortable } from "../table.js";
import { el, emptyStatePanel, safeLink, statusDot } from "../ui.js";
import {
  formatCheckEvidence,
  formatCheckValue,
  metricCard,
  metricGrid,
  pageHeader,
  panel,
  sourceErrorText
} from "../view-utils.js";

const SOURCE_COLUMNS = [
  { key: "source", label: "Source", sort: "text", width: "22%" },
  { key: "state", label: "State", sort: "text", width: "10%" },
  { key: "data-through", label: "Data through", sort: "date", width: "14%" },
  { key: "activity", label: "Pipeline activity", sort: "date", width: "23%" },
  { key: "next-due", label: "Next due", sort: "date", width: "14%" },
  { key: "diagnostic", label: "Diagnostic", width: "17%" }
];

const CHECK_COLUMNS = [
  { key: "check", label: "Check", sort: "text", width: "24%" },
  { key: "state", label: "State", sort: "text", width: "12%" },
  { key: "current", label: "Current evidence", sort: "number", width: "18%" },
  { key: "window", label: "Evaluation window", width: "22%" },
  { key: "threshold", label: "Trigger definition", width: "24%" }
];

const CHECK_LABELS = {
  "tps-change": "TPS change",
  "slow-slot-time": "Slow slot time",
  "high-validator-delinquency": "Validator delinquency",
  "large-tvl-change": "TVL movement",
  "large-sol-price-move": "SOL price movement"
};

const SOURCE_STATES = {
  fresh: {
    label: "Healthy",
    note: "Latest collector attempt succeeded."
  },
  stale: {
    label: "Stale",
    note: "Last known-good evidence is retained after a collector error."
  },
  unavailable: {
    label: "Unavailable",
    note: "No successful value is available."
  }
};

function sourceState(source) {
  const state = SOURCE_STATES[source.status] || { label: source.status, note: "Source state reported by the pipeline." };
  return statusDot(source.status, state.label, { title: state.note, className: "status-text source-state-cell" });
}

function formatSourceTime(value) {
  if (!value) return "—";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return fmt.date(value);
  const time = Date.parse(value);
  return Number.isFinite(time) ? fmt.utc(value) : value;
}

function sourceIdentity(sourceId, source) {
  const identity = el("div", "source-identity");
  const link = safeLink(source.name, source.url, "source-name");
  link.title = source.url;
  identity.append(link, el("code", "source-id", sourceId));
  return identity;
}

function sourceActivity(source) {
  const activity = el("div", "source-activity");
  activity.append(
    el("span", "source-activity-main", source.lastSuccessAt ? `Succeeded ${fmt.utc(source.lastSuccessAt)}` : "No successful fetch"),
    el("small", "source-activity-note", source.lastAttemptAt ? `Attempted ${fmt.utc(source.lastAttemptAt)}` : "No recorded attempt")
  );
  return activity;
}

function sourceDiagnostic(source) {
  const diagnostic = el("div", "source-diagnostic");
  if (!source.error) {
    diagnostic.append(el("span", undefined, "No collector error"));
    return diagnostic;
  }

  const detail = sourceErrorText(source);
  if (source.error.code) diagnostic.append(el("code", "source-error-code", source.error.code));
  diagnostic.append(el("span", undefined, source.error.message || detail));
  return diagnostic;
}

function sourceLedger(snapshot) {
  const sources = Object.entries(snapshot.sources);
  const card = panel({
    title: "Source ledger",
    note: "Provider time, pipeline time, publication time, and collector diagnostics remain separate.",
    className: "source-ledger-panel cut-corner",
    action: safeLink("Raw snapshot", "/data.json", "panel-link")
  });

  if (!sources.length) {
    card.append(emptyStatePanel("This snapshot does not contain source records.", { title: "No source evidence" }));
    return card;
  }

  const { wrap, table, body } = createTable(SOURCE_COLUMNS, "Canonical source provenance and freshness");
  for (const [sourceId, source] of sources) {
    appendTableRow(body, SOURCE_COLUMNS, [
      { content: sourceIdentity(sourceId, source), sortValue: source.name },
      { content: sourceState(source), sortValue: source.status },
      { content: formatSourceTime(source.dataThrough), sortValue: source.dataThrough || "" },
      { content: sourceActivity(source), sortValue: source.lastAttemptAt },
      { content: formatSourceTime(source.nextDueAt), sortValue: source.nextDueAt || "" },
      { content: sourceDiagnostic(source), className: source.error ? "source-diagnostic-cell has-error" : "source-diagnostic-cell" }
    ], {
      className: `source-row source-${source.status}`,
      dataset: { sourceId, status: source.status }
    });
  }
  makeSortable(table, body, SOURCE_COLUMNS);
  card.append(wrap);
  return card;
}

function checkState(check) {
  if (check.status === "triggered") return statusDot("triggered", "Warning");
  if (check.status === "unavailable") return statusDot("unavailable", "Unavailable");
  return statusDot("normal", "Normal");
}

function checkIdentity(check) {
  const identity = el("div", "check-identity");
  identity.append(
    el("span", undefined, CHECK_LABELS[check.id] || check.id),
    el("code", "check-kind", check.metricPath)
  );
  return identity;
}

function checkCurrent(check) {
  const current = el("div", "check-current");
  current.append(el("span", undefined, formatCheckValue(check)));
  if (check.observedAt) current.append(el("small", "check-observed", fmt.utc(check.observedAt)));
  return current;
}

function checksLedger(snapshot) {
  const warningCount = snapshot.alerts.length;
  const card = panel({
    title: "Deterministic checks",
    note: warningCount ? `${warningCount} active threshold warning${warningCount === 1 ? "" : "s"}.` : "No active threshold warnings in this snapshot.",
    className: "checks-ledger-panel span-8",
    action: safeLink("Full methodology", "/methodology.md", "panel-link")
  });

  const { wrap, table, body } = createTable(CHECK_COLUMNS, "Deterministic notable-change checks and their current evidence");
  for (const check of snapshot.alertChecks) {
    const definition = formatCheckEvidence(check) || "Threshold documented in methodology";
    appendTableRow(body, CHECK_COLUMNS, [
      { content: checkIdentity(check), sortValue: CHECK_LABELS[check.id] || check.id },
      { content: checkState(check), sortValue: check.status },
      { content: checkCurrent(check), sortValue: check.changePct ?? check.currentValue ?? "" },
      check.window,
      check.status === "unavailable" && check.reasonCode
        ? { content: `${definition} · ${check.reasonCode.replaceAll("_", " ").toLowerCase()}`, className: "source-diagnostic-cell has-error" }
        : definition
    ], {
      className: `check-row check-${check.status}`,
      dataset: { checkId: check.id, status: check.status }
    });
  }
  makeSortable(table, body, CHECK_COLUMNS);
  card.append(wrap);
  return card;
}

function outputLink(title, href, copy) {
  const item = el("div", "output-link-card");
  item.append(safeLink(title, href, "output-link"), el("p", "output-link-copy", copy));
  return item;
}

function outputsPanel(snapshot) {
  const card = panel({
    title: "Publication contract",
    note: "Canonical machine, human, and methodological outputs.",
    className: "source-output-panel span-4"
  });

  const contract = el("dl", "technical-list compact source-contract-list");
  for (const [label, value] of [
    ["Published", fmt.utc(snapshot.updatedAt)],
    ["Snapshot", snapshot.updateStatus === "complete" ? "Complete" : "Partial"],
    ["Schema", snapshot.schemaVersion],
    ["Methodology", snapshot.methodologyVersion],
    ["Source records", fmt.integer(Object.keys(snapshot.sources).length)],
    ["Checks evaluated", fmt.integer(snapshot.alertChecks.length)],
    ["Active warnings", fmt.integer(snapshot.alerts.length)]
  ]) {
    const row = el("div");
    row.append(el("dt", undefined, label), el("dd", undefined, value));
    contract.append(row);
  }

  const links = el("div", "output-link-list");
  links.append(
    outputLink("Canonical JSON", "/data.json", "Machine-readable snapshot and source diagnostics."),
    outputLink("Deterministic report", "/report.md", "Human-readable output generated from the same snapshot."),
    outputLink("Methodology", "/methodology.md", "Definitions, windows, limitations, and thresholds.")
  );
  card.append(contract, links);
  return card;
}

export function renderSources(snapshot, root) {
  const sources = Object.values(snapshot.sources);
  const freshCount = sources.filter((source) => source.status === "fresh").length;
  const staleCount = sources.filter((source) => source.status === "stale").length;
  const unavailableCount = sources.filter((source) => source.status === "unavailable").length;
  const issueCount = staleCount + unavailableCount;
  const partial = snapshot.updateStatus === "partial";

  root.append(pageHeader({
    eyebrow: "Evidence and provenance",
    title: "Sources",
    copy: "Collector health, exact freshness boundaries, deterministic checks, and canonical output contracts.",
    meta: [
      partial ? "Snapshot partial · some domains retain stale evidence" : "Snapshot complete · all published domains current",
      `Published ${fmt.utc(snapshot.updatedAt)}`
    ]
  }));

  root.append(metricGrid([
    metricCard({
      label: "Snapshot",
      value: partial ? "Partial" : "Complete",
      note: partial ? "At least one published domain is stale" : "All published domains are current",
      tone: partial ? "warning" : "positive"
    }),
    metricCard({
      label: "Source records",
      value: fmt.integer(sources.length),
      note: "Canonical public provider records",
      tone: "neutral"
    }),
    metricCard({
      label: "Healthy sources",
      value: fmt.integer(freshCount),
      note: `${sources.length ? fmt.pct(freshCount / sources.length * 100) : "—"} of recorded sources`,
      tone: "positive"
    }),
    metricCard({
      label: "Source issues",
      value: issueCount ? fmt.integer(issueCount) : "None",
      note: `${fmt.integer(staleCount)} stale · ${fmt.integer(unavailableCount)} unavailable`,
      tone: unavailableCount ? "negative" : staleCount ? "warning" : "neutral"
    })
  ], "metric-grid-four sources-summary"));

  const lowerGrid = el("div", "analytics-grid source-details-grid");
  lowerGrid.append(checksLedger(snapshot), outputsPanel(snapshot));
  root.append(sourceLedger(snapshot), lowerGrid);
}
