import { DATA_COLORS } from "../charts.js";
import { coverageGapCallout } from "../coverage-callout.js";
import { fmt } from "../format.js";
import { appendTableRow, createTable, makeSortable } from "../table.js";
import { el, emptyStatePanel, statusDot } from "../ui.js";
import {
  chartPanel,
  copyButton,
  formatStakeCompact,
  historySpec,
  metricCard,
  metricGrid,
  pageHeader,
  panel,
  shortKey
} from "../view-utils.js";

const LIVE_GAP_MS = 3 * 60 * 60 * 1_000;
const VALIDATOR_CHART_START = "2026-08-21T00:00:00.000Z";

const VALIDATOR_COLUMNS = [
  { key: "rank", label: "Rank", align: "right", sort: "number", width: "7%" },
  { key: "identity", label: "Vote account", sort: "text", width: "38%" },
  { key: "status", label: "Status", sort: "text", width: "12%" },
  { key: "stake", label: "Stake (SOL)", align: "right", sort: "bigint", width: "19%" },
  { key: "share", label: "Share", align: "right", sort: "number", width: "12%" },
  { key: "commission", label: "Commission", align: "right", sort: "number", width: "12%" }
];

const COMMISSION_COLUMNS = [
  { key: "window", label: "Possible change window", sort: "date", width: "32%" },
  { key: "vote", label: "Vote account", sort: "text", width: "38%" },
  { key: "previous", label: "Previous", align: "right", sort: "number", width: "15%" },
  { key: "current", label: "Current", align: "right", sort: "number", width: "15%" }
];

function validatorIdentity(validator) {
  const identity = el("div", "validator-identity");
  const vote = el("code", "validator-key", shortKey(validator.votePubkey));
  vote.title = validator.votePubkey;
  const copy = copyButton(validator.votePubkey, "Copy");
  identity.append(vote, copy);
  if (validator.nodePubkey) {
    const node = el("small", "validator-node", `Node ${shortKey(validator.nodePubkey)}`);
    node.title = validator.nodePubkey;
    identity.append(node);
  }
  return identity;
}

function validatorState(status) {
  return statusDot(status, status === "delinquent" ? "Delinquent" : "Active", {
    className: "status-text validator-state"
  });
}

function validatorDirectory(data) {
  const card = panel({
    title: "Validator directory",
    note: "Current vote accounts ranked by activated stake.",
    className: "validator-directory-panel cut-corner"
  });
  const toolbar = el("div", "table-toolbar");
  const copy = el("div", "table-toolbar-copy");
  const result = el("p", "table-result", `${data.table.length} of ${data.table.length} validators visible`);
  result.setAttribute("aria-live", "polite");
  copy.append(el("strong", undefined, "Filter current set"), result);

  const controls = el("div", "table-controls");
  const search = document.createElement("input");
  search.className = "table-search";
  search.type = "search";
  search.placeholder = "Search vote or node key";
  search.setAttribute("aria-label", "Search validators by vote or node key");
  const filters = ["all", "active", "delinquent"].map((filter) => {
    const button = el("button", "table-control-button", filter[0].toUpperCase() + filter.slice(1));
    button.type = "button";
    button.dataset.validatorFilter = filter;
    button.setAttribute("aria-pressed", String(filter === "all"));
    return button;
  });
  controls.append(search, ...filters);
  toolbar.append(copy, controls);

  const { wrap, table, body } = createTable(VALIDATOR_COLUMNS, "All validators with current stake rank, status, and commission");
  wrap.classList.add("validator-table");
  for (const validator of data.table) {
    const row = appendTableRow(body, VALIDATOR_COLUMNS, [
      { content: fmt.integer(validator.rank), sortValue: validator.rank },
      { content: validatorIdentity(validator), sortValue: validator.votePubkey },
      { content: validatorState(validator.status), sortValue: validator.status },
      { content: fmt.stakeSol(validator.activatedStakeLamports), sortValue: validator.activatedStakeLamports },
      { content: fmt.pct(validator.stakeSharePct), sortValue: validator.stakeSharePct },
      { content: `${validator.commissionPct}%`, sortValue: validator.commissionPct }
    ], {
      className: validator.status === "delinquent" ? "validator-row row-delinquent" : "validator-row",
      dataset: { status: validator.status }
    });
    row.dataset.searchText = `${validator.votePubkey} ${validator.nodePubkey || ""}`.toLowerCase();
  }
  makeSortable(table, body, VALIDATOR_COLUMNS);

  let activeFilter = "all";
  function applyFilter() {
    const term = search.value.trim().toLowerCase();
    let visible = 0;
    for (const row of body.rows) {
      const matchesState = activeFilter === "all" || row.dataset.status === activeFilter;
      const matchesTerm = !term || row.dataset.searchText.includes(term);
      row.hidden = !(matchesState && matchesTerm);
      if (!row.hidden) visible += 1;
    }
    result.textContent = `${visible} of ${data.table.length} validators visible`;
  }
  search.addEventListener("input", applyFilter);
  for (const button of filters) {
    button.addEventListener("click", () => {
      activeFilter = button.dataset.validatorFilter;
      for (const item of filters) item.setAttribute("aria-pressed", String(item === button));
      applyFilter();
    });
  }
  card.append(toolbar, wrap);
  return card;
}

function concentrationPanel(data) {
  const card = panel({
    title: "Stake concentration",
    note: `Top 10 control ${fmt.pct(data.stake.top10Pct)} of activated stake.`,
    className: "span-5 concentration-panel",
    domain: data
  });
  const rows = data.stake.distribution.filter((point) => point.status !== "aggregate").slice(0, 10);
  const max = Math.max(1, ...rows.map((point) => point.sharePct));
  const list = el("div", "concentration-list");
  for (const point of rows) {
    const item = el("div", "concentration-row");
    const identity = el("code", "concentration-label", point.votePubkey ? shortKey(point.votePubkey) : point.label);
    identity.title = point.votePubkey || point.label;
    const track = el("span", "concentration-track");
    const fill = el("span", `concentration-fill ${point.status === "delinquent" ? "delinquent" : ""}`);
    fill.style.width = `${Math.max(2, point.sharePct / max * 100)}%`;
    track.setAttribute("role", "img");
    track.setAttribute("aria-label", `${point.label}: ${fmt.pct(point.sharePct)} of activated stake`);
    track.append(fill);
    item.append(identity, track, el("span", "concentration-value", fmt.pct(point.sharePct)));
    list.append(item);
  }
  card.append(list);
  return card;
}

function commissionPanel(data) {
  const card = panel({
    title: "Commission changes",
    note: "Detected between successful snapshots; rows do not claim an exact change time.",
    className: "commission-panel"
  });
  if (!data.commissionChanges.length) {
    card.append(emptyStatePanel("No commission changes were detected between retained snapshots.", { title: "No recorded changes" }));
    return card;
  }
  const { wrap, table, body } = createTable(COMMISSION_COLUMNS, "Validator commission changes detected between successful snapshots");
  for (const change of [...data.commissionChanges].reverse()) {
    const vote = el("code", "validator-key", shortKey(change.votePubkey));
    vote.title = change.votePubkey;
    const start = change.previousObservedAt ? fmt.utc(change.previousObservedAt) : "Lower bound unavailable";
    const window = el("span", "commission-window", `${start} → ${fmt.utc(change.detectedAt)}`);
    window.title = change.previousObservedAt
      ? "The commission changed sometime after the first snapshot and no later than the second."
      : "The retained legacy record has no reliable lower-bound timestamp; only detection time is known.";
    appendTableRow(body, COMMISSION_COLUMNS, [
      { content: window, sortValue: change.detectedAt },
      { content: vote, sortValue: change.votePubkey },
      { content: `${change.previousCommissionPct}%`, sortValue: change.previousCommissionPct },
      { content: `${change.commissionPct}%`, sortValue: change.commissionPct }
    ]);
  }
  makeSortable(table, body, COMMISSION_COLUMNS);
  card.append(wrap);
  return card;
}

export function renderValidators(snapshot, root) {
  const data = snapshot.validators;
  const chartHistory = data.history.filter((point) => point.observedAt >= VALIDATOR_CHART_START);
  root.append(pageHeader({
    eyebrow: "Stake and consensus participation",
    title: "Validators",
    copy: "Activated-stake health, network concentration, commission changes, and the complete vote-account directory.",
    meta: [`Observed ${fmt.utc(data.observedAt)}`, `${fmt.integer(data.counts.total)} vote accounts`]
  }));

  const coverage = coverageGapCallout(snapshot, { affectedMetrics: ["Validator snapshots and commission tracking"] });
  if (coverage) root.append(coverage);

  root.append(metricGrid([
    metricCard({
      label: "Validators",
      value: fmt.integer(data.counts.total),
      note: `${fmt.integer(data.counts.active)} active · ${fmt.integer(data.counts.delinquent)} delinquent`,
      domain: data,
      tone: "validator"
    }),
    metricCard({
      label: "Activated stake",
      value: formatStakeCompact(data.stake.totalLamports),
      note: "Active and delinquent vote accounts",
      domain: data,
      tone: "validator"
    }),
    metricCard({
      label: "Delinquent stake",
      value: fmt.pct(data.stake.delinquentPct),
      note: `${fmt.stakeSol(data.stake.delinquentLamports)} SOL`,
      domain: data,
      tone: data.stake.delinquentPct >= 5 ? "negative" : "neutral",
      series: chartHistory.map((point) => ({ observedAt: point.observedAt, value: point.delinquentStakePct })),
      seriesGapMs: LIVE_GAP_MS
    }),
    metricCard({
      label: "Top 10 stake",
      value: fmt.pct(data.stake.top10Pct),
      note: "Share of total activated stake",
      domain: data,
      tone: "validator"
    }),
    metricCard({
      label: "Commission changes",
      value: fmt.integer(data.commissionChanges.length),
      note: "Recorded in the bounded retained window",
      tone: "neutral"
    })
  ], "metric-grid-five"));

  const healthSpec = historySpec(snapshot, {
    title: "Validator health history",
    note: "Delinquent activated stake share at exact snapshot observations",
    domain: data,
    history: chartHistory,
    time: (point) => point.observedAt,
    series: [{ label: "Delinquent stake", field: "delinquentStakePct", color: DATA_COLORS.negative, fill: true, spanGaps: LIVE_GAP_MS }],
    formatter: fmt.pct,
    beginAtZero: true
  });
  const history = chartPanel(healthSpec, {
    className: "span-7 chart-primary cut-corner",
    meta: [`${chartHistory.length} observations`, "Stake-weighted · no synthetic points"]
  });
  const grid = el("div", "analytics-grid validator-analysis-grid");
  grid.append(history.card, concentrationPanel(data));
  root.append(grid, commissionPanel(data), validatorDirectory(data));
  history.draw();
}
