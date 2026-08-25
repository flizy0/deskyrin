import { destroyCharts, lineChart, stackedBarChart } from "./charts.js";
import { closeChartExplorer, openChartExplorer } from "./chart-explorer.js";
import { fmt, freshnessText } from "./format.js";
import {
  chartCardHeader,
  el,
  emptyStatePanel,
  metricCard as metricCardPrimitive,
  safeLink,
  sectionHeader,
  statusBadge
} from "./ui.js";

function badge(domain) {
  if (!domain) return null;
  return statusBadge(domain.status, freshnessText(domain), {
    className: "freshness",
    title: `Observed ${fmt.utc(domain.observedAt)}`
  });
}

function metricCard(label, value, note, domain) {
  return metricCardPrimitive(label, value, note, badge(domain));
}

function signalCard(label, value, note, domain) {
  const card = metricCard(label, value, note, domain);
  card.classList.replace("metric-card", "signal-card");
  return card;
}

function indexedSectionHeader(id, eyebrow, title, copy, index) {
  const header = sectionHeader(id, eyebrow, title, copy);
  header.append(el("span", "section-index", index));
  return header;
}

function chartCard(title, note, explorerSpec, { meta = [] } = {}) {
  const card = el("article", "chart-card");
  let expand;
  if (explorerSpec) {
    expand = el("button", "chart-expand-button", "Explore");
    expand.type = "button";
    expand.dataset.chartExplorerOpen = "";
    expand.setAttribute("aria-label", `Explore ${title}`);
    expand.setAttribute("aria-haspopup", "dialog");
    expand.addEventListener("click", () => openChartExplorer(explorerSpec, expand));
  }
  card.append(chartCardHeader(title, note, expand));

  if (meta.length) {
    const row = el("div", "chart-meta-row");
    for (const item of meta) row.append(el("span", undefined, item));
    card.append(row);
  }

  if (!explorerSpec) {
    card.append(emptyStatePanel("History is unavailable for this snapshot."));
    return { card, canvas: null };
  }

  const wrap = el("div", "chart-wrap");
  const canvas = document.createElement("canvas");
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", `${title}. ${note}`);
  canvas.setAttribute("aria-keyshortcuts", "ArrowLeft ArrowRight Home End");
  canvas.tabIndex = 0;
  const liveStatus = el("span", "sr-only chart-a11y-status");
  liveStatus.setAttribute("aria-live", "polite");
  wrap.append(canvas, liveStatus);
  card.append(wrap);
  return { card, canvas };
}

function tableShell(headers, captionText) {
  const wrap = el("div", "table-wrap");
  const table = document.createElement("table");
  if (captionText) table.createCaption().textContent = captionText;
  const head = document.createElement("thead");
  const row = document.createElement("tr");
  for (const header of headers) {
    const cell = el("th", undefined, header);
    cell.scope = "col";
    row.append(cell);
  }
  head.append(row);
  const body = document.createElement("tbody");
  table.append(head, body);
  wrap.append(table);
  return { wrap, table, body };
}

function makeSortable(table, body, columns) {
  const headers = [...table.tHead.rows[0].cells];
  for (const [index, column] of columns.entries()) {
    if (!column) continue;
    const header = headers[index];
    const label = header.textContent;
    const button = el("button", "sort-button", label);
    button.type = "button";
    button.addEventListener("click", () => {
      const direction = header.getAttribute("aria-sort") === "ascending" ? "descending" : "ascending";
      for (const item of headers) item.removeAttribute("aria-sort");
      header.setAttribute("aria-sort", direction);
      const multiplier = direction === "ascending" ? 1 : -1;
      const rows = [...body.rows];
      rows.sort((left, right) => {
        const leftValue = left.cells[index].dataset.sortValue;
        const rightValue = right.cells[index].dataset.sortValue;
        let comparison;
        if (column === "bigint") comparison = BigInt(leftValue) < BigInt(rightValue) ? -1 : BigInt(leftValue) > BigInt(rightValue) ? 1 : 0;
        else if (column === "number") comparison = Number(leftValue) - Number(rightValue);
        else comparison = leftValue.localeCompare(rightValue);
        return comparison * multiplier;
      });
      body.append(...rows);
    });
    header.replaceChildren(button);
  }
}

function isPlottable(history, timestamp, fields) {
  if (!Array.isArray(history) || history.length === 0) return false;
  let previous = -Infinity;
  return history.every((point) => {
    const time = Date.parse(timestamp(point));
    const valid = Number.isFinite(time) && time > previous && fields.every((field) => Number.isFinite(point[field]));
    previous = time;
    return valid;
  });
}

function formatCheck(check) {
  if (check.status === "unavailable") return (check.reasonCode || "data unavailable").replaceAll("_", " ").toLowerCase();
  if (check.changePct !== undefined) return fmt.pct(check.changePct, true);
  if (check.currentValue !== undefined && check.unit.startsWith("%")) return fmt.pct(check.currentValue);
  if (check.currentValue !== undefined) return fmt.decimal(check.currentValue);
  return "—";
}

function formatCheckReference(check) {
  let baseline;
  if (check.referenceValue !== undefined) {
    if (check.kind === "tvl_change" || check.kind === "sol_price_move") baseline = `Baseline ${fmt.usd(check.referenceValue)}`;
    else if (check.unit === "ms") baseline = `Baseline ${fmt.decimal(check.referenceValue)} ms`;
    else if (check.unit.includes("%")) baseline = `Baseline ${fmt.pct(check.referenceValue)}`;
    else if (check.unit === "TPS") baseline = `Baseline ${fmt.integer(check.referenceValue)} TPS`;
    else baseline = `Baseline ${fmt.compact(check.referenceValue)}`;
  }
  const threshold = check.threshold || {};
  let trigger = "Fixed documented threshold";
  if (threshold.relativePct !== undefined && threshold.absoluteTps !== undefined) trigger = `Trigger |change| ≥${threshold.relativePct}% and |Δ| ≥${fmt.integer(threshold.absoluteTps)} TPS`;
  else if (threshold.relativePct !== undefined && threshold.absoluteMs !== undefined) trigger = `Trigger slowdown ≥${threshold.relativePct}% and increase ≥${fmt.integer(threshold.absoluteMs)} ms`;
  else if (threshold.percent !== undefined) trigger = `Trigger ≥${fmt.pct(threshold.percent)}${threshold.confirmations ? ` · ${threshold.confirmations} confirmations` : ""}`;
  else if (threshold.absolutePct !== undefined) trigger = `Trigger ≥${fmt.pct(threshold.absolutePct)} absolute move`;
  return [baseline, trigger].filter(Boolean).join(" · ");
}

const CHECK_LABELS = {
  "tps-change": "TPS change",
  "slow-slot-time": "Slow slot time",
  "high-validator-delinquency": "High validator delinquency",
  "large-tvl-change": "Large TVL change",
  "large-sol-price-move": "Large SOL price move"
};

function renderAlerts(snapshot) {
  const root = document.querySelector("#alerts");
  root.replaceChildren(indexedSectionHeader(
    "alerts",
    "System overview",
    "Alerts / notable changes",
    "A cross-domain snapshot followed by fixed, documented checks that only evaluate fresh evidence.",
    "01 / 06"
  ));

  const signals = el("div", "signal-grid");
  signals.append(
    signalCard("Total TPS", fmt.integer(snapshot.network.performance.tps.total), "Latest duration-weighted sample", snapshot.network.performance),
    signalCard("Slot time", `${fmt.decimal(snapshot.network.performance.slotTimeMs)} ms`, "Milliseconds per produced slot", snapshot.network.performance),
    signalCard("SOL / 24h", fmt.usd(snapshot.economics.solPrice.currentUsd), fmt.pct(snapshot.economics.solPrice.change24hPct, true), snapshot.economics.solPrice),
    signalCard("Daily active addresses", fmt.decimal(snapshot.ecosystem.dailyActiveAddresses.value), `Completed UTC day · ${fmt.date(snapshot.ecosystem.dailyActiveAddresses.date)}`, snapshot.ecosystem.dailyActiveAddresses)
  );

  const active = el("div", "alerts-active");
  const unavailableChecks = snapshot.alertChecks.filter((check) => check.status === "unavailable");
  if (snapshot.alerts.length === 0 && unavailableChecks.length === 0) {
    const clear = el("article", "alert-card clear");
    const icon = el("span", "alert-icon", "✓");
    icon.setAttribute("aria-hidden", "true");
    clear.append(icon, el("div", undefined, "No active threshold warnings across the five monitored checks."));
    active.append(clear);
  } else if (snapshot.alerts.length === 0) {
    const degraded = el("article", "alert-card warning");
    const icon = el("span", "alert-icon", "?");
    icon.setAttribute("aria-hidden", "true");
    degraded.append(icon, el("div", undefined, `No triggered warnings, but ${unavailableChecks.length} threshold check${unavailableChecks.length === 1 ? " is" : "s are"} unavailable.`));
    active.append(degraded);
  } else {
    for (const alert of snapshot.alerts) {
      const card = el("article", "alert-card warning");
      const content = el("div");
      const time = el("time", undefined, fmt.utc(alert.observedAt));
      time.dateTime = alert.observedAt;
      content.append(el("h3", undefined, alert.title), el("p", undefined, alert.message), time);
      const icon = el("span", "alert-icon", "!");
      icon.setAttribute("aria-hidden", "true");
      card.append(icon, content);
      active.append(card);
    }
  }

  const checks = el("div", "check-grid");
  for (const check of snapshot.alertChecks) {
    const card = el("article", `check-card ${check.status}`);
    card.append(
      el("span", "check-state", check.status),
      el("h3", undefined, CHECK_LABELS[check.id] || check.id.replaceAll("-", " ")),
      el("p", undefined, formatCheck(check)),
      el("small", undefined, check.window),
      el("div", "check-evidence", formatCheckReference(check))
    );
    checks.append(card);
  }
  root.append(signals, active, checks);
}

function renderNetwork(snapshot) {
  const root = document.querySelector("#network");
  const performance = snapshot.network.performance;
  const chain = snapshot.network.chain;
  root.replaceChildren(indexedSectionHeader(
    "network",
    "Consensus telemetry",
    "Network Performance",
    "Finalized chain state and duration-weighted Solana RPC performance samples, kept at their real observation times.",
    "02 / 06"
  ));

  const cards = el("div", "metric-grid");
  cards.append(
    metricCard("TPS", fmt.integer(performance.tps.total), "All transactions · latest 5 minutes", performance),
    metricCard("Slot time", `${fmt.decimal(performance.slotTimeMs)} ms`, "Duration ÷ produced slots", performance),
    metricCard("Block height", fmt.integer(BigInt(chain.blockHeight)), `Finalized slot ${fmt.integer(BigInt(chain.slot))}`, chain),
    metricCard("Epoch progress", fmt.pct(chain.epoch.progressPct), `Epoch ${chain.epoch.number} · ${fmt.integer(chain.epoch.slotIndex)} / ${fmt.integer(chain.epoch.slotsInEpoch)} slots`, chain)
  );

  const validHistory = isPlottable(performance.history, (point) => point.observedAt, ["totalTps", "nonVoteTps", "slotTimeMs"]);
  const labels = validHistory ? performance.history.map((point) => point.observedAt) : [];
  const tpsSpec = validHistory ? {
    title: "TPS history",
    note: "Total and non-vote transactions per second",
    labels,
    datasets: [
      { label: "Total TPS", data: performance.history.map((point) => point.totalTps), color: "#8b5cf6", fill: true },
      { label: "Non-vote TPS", data: performance.history.map((point) => point.nonVoteTps), color: "#2dd4bf" }
    ],
    yFormatter: fmt.integer,
    observedAt: performance.observedAt,
    updatedAt: snapshot.updatedAt
  } : null;
  const slotSpec = validHistory ? {
    title: "Slot-time history",
    note: "Milliseconds per produced slot",
    labels,
    datasets: [{ label: "Slot time", data: performance.history.map((point) => point.slotTimeMs), color: "#a78bfa", fill: true }],
    yFormatter: (value) => `${fmt.decimal(value)} ms`,
    observedAt: performance.observedAt,
    updatedAt: snapshot.updatedAt
  } : null;

  const chartGrid = el("div", "chart-grid network-chart-grid");
  const tpsChart = chartCard("TPS history", "Total and non-vote transactions per second", tpsSpec, { meta: [`${performance.history.length} stored observations`, "Exact timestamps · UTC"] });
  const slotChart = chartCard("Slot-time history", "Milliseconds per produced slot", slotSpec, { meta: ["Produced-slot interval estimate", "No synthetic points"] });
  chartGrid.append(tpsChart.card, slotChart.card);
  root.append(cards, chartGrid);
  if (tpsChart.canvas) lineChart(tpsChart.canvas, tpsSpec.labels, tpsSpec.datasets, tpsSpec.yFormatter);
  if (slotChart.canvas) lineChart(slotChart.canvas, slotSpec.labels, slotSpec.datasets, slotSpec.yFormatter);
}

function concentrationPanel(data) {
  const panel = el("article", "concentration-panel");
  const head = el("div", "concentration-head");
  const title = el("div");
  const other = data.stake.distribution.find((point) => point.status === "aggregate");
  title.append(
    el("h3", undefined, "Stake concentration"),
    el("p", undefined, `Top 10 compared with ${other ? fmt.pct(other.sharePct) : "the remaining network"}. Bars are scaled to the largest validator.`)
  );
  head.append(title, el("span", "concentration-total", `Top 10 · ${fmt.pct(data.stake.top10Pct)}`));

  const list = el("div", "concentration-list");
  const rows = data.stake.distribution.filter((point) => point.status !== "aggregate").slice(0, 10);
  const max = Math.max(...rows.map((point) => point.sharePct), 1);
  for (const point of rows) {
    const row = el("div", "concentration-row");
    const track = el("span", "concentration-track");
    const fill = el("span", "concentration-fill");
    fill.style.width = `${Math.max(2, point.sharePct / max * 100)}%`;
    track.setAttribute("role", "img");
    track.setAttribute("aria-label", `${point.label}: ${fmt.pct(point.sharePct)} of activated stake`);
    track.append(fill);
    row.append(el("span", "concentration-label", point.label), track, el("span", "concentration-value", fmt.pct(point.sharePct)));
    list.append(row);
  }
  panel.append(head, list);
  return panel;
}

function validatorTable(data) {
  const table = tableShell(["Rank", "Vote account", "Status", "Stake (SOL)", "Share", "Commission"], "All validators — current stake rank, status, and commission");
  table.wrap.classList.add("validator-table");
  const rows = [];
  for (const validator of data.table) {
    const row = document.createElement("tr");
    row.dataset.status = validator.status;
    row.dataset.searchText = `${validator.votePubkey} ${validator.nodePubkey || ""}`.toLowerCase();
    if (validator.status === "delinquent") row.className = "row-delinquent";
    const keyCell = document.createElement("td");
    keyCell.append(el("code", undefined, validator.votePubkey));
    const state = el("span", `validator-state ${validator.status}`, validator.status);
    const values = [validator.rank, keyCell, state, fmt.stakeSol(validator.activatedStakeLamports), fmt.pct(validator.stakeSharePct), `${validator.commissionPct}%`];
    const sortValues = [validator.rank, validator.votePubkey, validator.status, validator.activatedStakeLamports, validator.stakeSharePct, validator.commissionPct];
    for (const [index, value] of values.entries()) {
      if (value instanceof HTMLElement && value.tagName === "TD") {
        value.dataset.sortValue = String(sortValues[index]);
        row.append(value);
      } else {
        const cell = document.createElement("td");
        cell.dataset.sortValue = String(sortValues[index]);
        cell.append(value instanceof Node ? value : document.createTextNode(String(value)));
        row.append(cell);
      }
    }
    table.body.append(row);
    rows.push(row);
  }
  makeSortable(table.table, table.body, ["number", "text", "text", "bigint", "number", "number"]);

  const workspace = el("article", "validator-workspace");
  const toolbar = el("div", "table-toolbar");
  const copy = el("div", "table-toolbar-copy");
  const result = el("p", undefined, `${rows.length} of ${rows.length} validators visible`);
  result.setAttribute("aria-live", "polite");
  copy.append(el("h3", undefined, "Validator directory"), result);

  const controls = el("div", "table-controls");
  const search = document.createElement("input");
  search.className = "table-search";
  search.type = "search";
  search.placeholder = "Search vote or node key";
  search.setAttribute("aria-label", "Search validators by vote or node key");
  const filterButtons = ["all", "active", "delinquent"].map((status) => {
    const button = el("button", "table-control-button", status[0].toUpperCase() + status.slice(1));
    button.type = "button";
    button.dataset.validatorFilter = status;
    button.setAttribute("aria-pressed", String(status === "all"));
    return button;
  });
  controls.append(search, ...filterButtons);
  toolbar.append(copy, controls);

  const empty = el("p", "empty-note", "No validators match this local filter.");
  empty.hidden = true;
  empty.style.padding = "1rem";
  let activeFilter = "all";
  const applyFilter = () => {
    const query = search.value.trim().toLowerCase();
    let visible = 0;
    for (const row of rows) {
      const matchesStatus = activeFilter === "all" || row.dataset.status === activeFilter;
      const matchesQuery = !query || row.dataset.searchText.includes(query);
      row.hidden = !(matchesStatus && matchesQuery);
      if (!row.hidden) visible += 1;
    }
    result.textContent = `${visible} of ${rows.length} validators visible`;
    empty.hidden = visible !== 0;
  };
  search.addEventListener("input", applyFilter);
  for (const button of filterButtons) {
    button.addEventListener("click", () => {
      activeFilter = button.dataset.validatorFilter;
      for (const item of filterButtons) item.setAttribute("aria-pressed", String(item === button));
      applyFilter();
    });
  }

  workspace.append(toolbar, table.wrap, empty);
  return workspace;
}

function commissionPanel(data) {
  const commission = el("article", "commission-panel");
  commission.append(el("h3", undefined, "Commission tracking"));
  if (data.commissionChanges.length === 0) {
    commission.append(el("p", "empty-note", "No commission changes have been observed since tracking began."));
    return commission;
  }
  const changes = tableShell(["Observed", "Vote account", "Previous", "New"], "Recorded validator commission changes, newest first");
  for (const event of [...data.commissionChanges].reverse()) {
    const row = document.createElement("tr");
    for (const value of [fmt.utc(event.observedAt), event.votePubkey, `${event.previousCommissionPct}%`, `${event.commissionPct}%`]) {
      const cell = document.createElement("td");
      cell.append(value === event.votePubkey ? el("code", undefined, value) : document.createTextNode(value));
      row.append(cell);
    }
    changes.body.append(row);
  }
  changes.wrap.classList.add("commission-table");
  commission.append(changes.wrap);
  return commission;
}

function renderValidators(snapshot) {
  const root = document.querySelector("#validators");
  const data = snapshot.validators;
  root.replaceChildren(indexedSectionHeader(
    "validators",
    "Activated stake",
    "Validator Status",
    "Current vote-account health, stake concentration, historical delinquency, and a complete sortable directory.",
    "03 / 06"
  ));

  const cards = el("div", "metric-grid");
  cards.append(
    metricCard("Active validators", fmt.integer(data.counts.active), `${fmt.integer(data.counts.total)} total staked validators`, data),
    metricCard("Delinquent validators", fmt.integer(data.counts.delinquent), `${fmt.pct(data.stake.delinquentPct)} of activated stake`, data),
    metricCard("Top 10 stake share", fmt.pct(data.stake.top10Pct), "Share of total activated stake", data),
    metricCard("Commission changes", fmt.integer(data.commissionChanges.length), "Observed since tracking began", data)
  );

  const validHistory = isPlottable(data.history, (point) => point.observedAt, ["delinquentStakePct"]);
  const validatorSpec = validHistory ? {
    title: "Validator health history",
    note: "Activated stake held by validators classified delinquent by the RPC window",
    labels: data.history.map((point) => point.observedAt),
    datasets: [{ label: "Delinquent stake share", data: data.history.map((point) => point.delinquentStakePct), color: "#fb7185", fill: true }],
    yFormatter: fmt.pct,
    beginAtZero: true,
    observedAt: data.observedAt,
    updatedAt: snapshot.updatedAt
  } : null;
  const healthChart = chartCard("Validator health history", "Activated stake held by validators classified delinquent by the RPC window", validatorSpec, {
    meta: [`Current ${fmt.pct(data.stake.delinquentPct)}`, `${fmt.integer(data.counts.delinquent)} delinquent vote accounts`, `${data.history.length} observations`]
  });
  const analytics = el("div", "validator-analytics");
  analytics.append(healthChart.card, concentrationPanel(data));
  root.append(cards, analytics, validatorTable(data), commissionPanel(data));
  if (healthChart.canvas) lineChart(healthChart.canvas, validatorSpec.labels, validatorSpec.datasets, validatorSpec.yFormatter, { beginAtZero: true });
}

function lineHistorySpec(snapshot, { title, note, domain, history, time, series, formatter }) {
  const fields = series.map((item) => item.field);
  if (!isPlottable(history, time, fields)) return null;
  return {
    title,
    note,
    labels: history.map(time),
    datasets: series.map(({ label, field, ...style }) => ({ label, data: history.map((point) => point[field]), ...style })),
    yFormatter: formatter,
    observedAt: domain.observedAt,
    updatedAt: snapshot.updatedAt
  };
}

function renderEconomics(snapshot) {
  const root = document.querySelector("#economics");
  const data = snapshot.economics;
  root.replaceChildren(indexedSectionHeader(
    "economics",
    "Economic signal",
    "Economic Indicators",
    "Market, liquidity, trading, sampled fees, and multi-source Real Economic Value on completed-day boundaries.",
    "04 / 06"
  ));

  const cards = el("div", "metric-grid");
  cards.append(
    metricCard("SOL price", fmt.usd(data.solPrice.currentUsd), `${fmt.pct(data.solPrice.change24hPct, true)} over 24 hours`, data.solPrice),
    metricCard("Stablecoin supply", fmt.usd(data.stablecoinSupply.totalCirculatingUsd), `USD-equivalent circulating · ${fmt.date(data.stablecoinSupply.date)}`, data.stablecoinSupply),
    metricCard("DEX volume", fmt.usd(data.dexVolume.dailyVolumeUsd), `Completed UTC day · ${fmt.date(data.dexVolume.date)}`, data.dexVolume),
    metricCard("REV", `${fmt.compact(data.rev.totalSol)} SOL`, `Fees + gross Jito tips · ${fmt.date(data.rev.date)}`, data.rev),
    metricCard("Median transaction fee", `${fmt.decimal(data.medianTransactionFee.medianLamports)} lamports`, `${fmt.integer(data.medianTransactionFee.sample.transactionCount)} transactions sampled`, data.medianTransactionFee)
  );

  const specs = [
    lineHistorySpec(snapshot, {
      title: "SOL price", note: "USD reference price", domain: data.solPrice, history: data.solPrice.history,
      time: (point) => point.observedAt, series: [{ label: "SOL price", field: "priceUsd", color: "#8b5cf6", fill: true }], formatter: fmt.usd
    }),
    lineHistorySpec(snapshot, {
      title: "Stablecoin supply", note: "USD-equivalent circulating", domain: data.stablecoinSupply, history: data.stablecoinSupply.history,
      time: (point) => `${point.date}T00:00:00.000Z`, series: [{ label: "Stablecoin supply", field: "totalCirculatingUsd", color: "#2dd4bf", fill: true }], formatter: fmt.usd
    }),
    lineHistorySpec(snapshot, {
      title: "DEX volume", note: "Direct DEX volume per completed UTC day", domain: data.dexVolume, history: data.dexVolume.history,
      time: (point) => `${point.date}T00:00:00.000Z`, series: [{ label: "DEX volume", field: "dailyVolumeUsd", color: "#22d3ee", fill: true }], formatter: fmt.usd
    })
  ];

  const revSpec = lineHistorySpec(snapshot, {
    title: "Real Economic Value",
    note: "Transaction fees plus gross Jito tips · completed UTC days",
    domain: data.rev,
    history: data.rev.history,
    time: (point) => `${point.date}T00:00:00.000Z`,
    series: [
      { label: "REV total", field: "totalSol", color: "#f2f4f8" },
      { label: "Transaction fees", field: "transactionFeesSol", color: "#8b5cf6" },
      { label: "Gross Jito tips", field: "grossJitoTipsSol", color: "#ec4899" }
    ],
    formatter: (value) => `${fmt.compact(value)} SOL`
  });
  const feeSpec = lineHistorySpec(snapshot, {
    title: "Median transaction fee",
    note: "Stratified finalized-block sample",
    domain: data.medianTransactionFee,
    history: data.medianTransactionFee.history,
    time: (point) => point.observedAt,
    series: [{ label: "Median transaction fee", field: "medianLamports", color: "#a78bfa", fill: true }],
    formatter: (value) => `${fmt.decimal(value)} lamports`
  });

  const chartGrid = el("div", "chart-grid economics-chart-grid");
  const genericCharts = specs.map((spec, index) => {
    const titles = ["SOL price", "Stablecoin supply", "DEX volume"];
    const notes = ["USD reference price", "USD-equivalent circulating", "Direct DEX volume per completed UTC day"];
    const chart = chartCard(titles[index], notes[index], spec);
    chartGrid.append(chart.card);
    if (chart.canvas) lineChart(chart.canvas, spec.labels, spec.datasets, spec.yFormatter);
    return chart;
  });
  void genericCharts;

  const providerValues = data.rev.feeConsensus.providers.map((provider) => `${provider.name} ${fmt.decimal(provider.valueSol)} SOL`);
  const revChart = chartCard("Real Economic Value", "Transaction fees plus gross Jito tips · completed UTC days", revSpec, {
    meta: [
      `Total ${fmt.compact(data.rev.totalSol)} SOL`,
      `Fees ${fmt.compact(data.rev.components.transactionFeesSol)} SOL`,
      `Gross tips ${fmt.compact(data.rev.components.grossJitoTipsSol)} SOL`,
      ...providerValues
    ]
  });
  chartGrid.append(revChart.card);
  if (revChart.canvas) {
    stackedBarChart(
      revChart.canvas,
      revSpec.labels,
      [
        { label: "Transaction fees", data: data.rev.history.map((point) => point.transactionFeesSol), color: "#8b5cf6" },
        { label: "Gross Jito tips", data: data.rev.history.map((point) => point.grossJitoTipsSol), color: "#ec4899" }
      ],
      revSpec.yFormatter
    );
  }

  const sample = data.medianTransactionFee.sample;
  const feeChart = chartCard("Median transaction fee", "Stratified finalized-block sample", feeSpec, {
    meta: [
      `${fmt.integer(sample.selectedBlockCount)} finalized blocks`,
      `${fmt.integer(sample.transactionCount)} transactions`,
      `~${fmt.integer(sample.approximateWindowSeconds / 60)} minute window`
    ]
  });
  chartGrid.append(feeChart.card);
  if (feeChart.canvas) lineChart(feeChart.canvas, feeSpec.labels, feeSpec.datasets, feeSpec.yFormatter);
  root.append(cards, chartGrid);
}

function renderEcosystem(snapshot) {
  const root = document.querySelector("#ecosystem");
  const data = snapshot.ecosystem;
  root.replaceChildren(indexedSectionHeader(
    "ecosystem",
    "Adoption and roadmap",
    "Ecosystem Growth",
    "Completed-day adoption evidence, rolling tokenized-asset activity, official news, and protocol developments.",
    "05 / 06"
  ));

  const cards = el("div", "metric-grid");
  cards.append(
    metricCard("Daily active addresses", fmt.decimal(data.dailyActiveAddresses.value), `Initiating signers / fee payers · ${fmt.date(data.dailyActiveAddresses.date)}`, data.dailyActiveAddresses),
    metricCard("Tokenized assets", fmt.usd(data.tokenizedAssets.totalTransferVolumeUsd), "Trailing 30-day transfer volume · stablecoins excluded", data.tokenizedAssets),
    metricCard("Tokenized equities", fmt.usd(data.tokenizedAssets.equityTransferVolumeUsd), "Stocks subset · trailing 30-day transfer volume", data.tokenizedAssets)
  );

  const addressSpec = lineHistorySpec(snapshot, {
    title: "Daily active addresses",
    note: "Aligned Allium and Dune fee-payer observations with their consensus midpoint",
    domain: data.dailyActiveAddresses,
    history: data.dailyActiveAddresses.history,
    time: (point) => `${point.date}T00:00:00.000Z`,
    series: [
      { label: "Consensus median", field: "value", color: "#8b5cf6", fill: true },
      { label: "Allium", field: "allium", color: "#22d3ee", borderDash: [5, 4] },
      { label: "Dune", field: "dune", color: "#ec4899", borderDash: [3, 4] }
    ],
    formatter: fmt.decimal
  });
  const rwaSpec = lineHistorySpec(snapshot, {
    title: "Tokenized-asset transfer volume",
    note: "Each observation is a trailing 30-day total, not daily flow",
    domain: data.tokenizedAssets,
    history: data.tokenizedAssets.history,
    time: (point) => point.observedAt,
    series: [
      { label: "All tokenized assets", field: "totalTransferVolumeUsd", color: "#8b5cf6", fill: true },
      { label: "Tokenized equities", field: "equityTransferVolumeUsd", color: "#2dd4bf" }
    ],
    formatter: fmt.usd
  });

  const chartGrid = el("div", "chart-grid ecosystem-chart-grid");
  const addressProviders = data.dailyActiveAddresses.providers.map((provider) => `${provider.name} ${fmt.decimal(provider.value)}`);
  const addressChart = chartCard("Daily active addresses", "Aligned Allium and Dune fee-payer observations with their consensus midpoint", addressSpec, { meta: addressProviders });
  const rwaChart = chartCard("Tokenized-asset transfer volume", "Each observation is a trailing 30-day total, not daily flow", rwaSpec, { meta: [`${data.tokenizedAssets.history.length} stored observations`, "Rolling 30-day measurement"] });
  chartGrid.append(addressChart.card, rwaChart.card);
  if (addressChart.canvas) lineChart(addressChart.canvas, addressSpec.labels, addressSpec.datasets, addressSpec.yFormatter);
  if (rwaChart.canvas) lineChart(rwaChart.canvas, rwaSpec.labels, rwaSpec.datasets, rwaSpec.yFormatter);

  const contentGrid = el("div", "content-grid");
  const upgrades = el("article", "content-panel");
  const upgradeHead = el("div", "content-panel-head");
  upgradeHead.append(el("h3", undefined, "Upcoming upgrades and developments"), badge(data.upgrades));
  upgrades.append(upgradeHead);
  if (data.upgrades.items.length === 0) {
    upgrades.append(emptyStatePanel("No upgrade records are available in this snapshot."));
  } else {
    const upgradeList = el("div", "upgrade-list");
    for (const item of data.upgrades.items) {
      const card = el("div", "upgrade-item");
      const head = el("div", "upgrade-head");
      head.append(safeLink(item.title, item.url), el("span", `stage ${item.stage}`, item.stageLabel));
      card.append(head, el("p", undefined, item.subtitle), el("small", undefined, item.releaseLabel));
      if (item.metrics.length) {
        const metrics = el("div", "upgrade-metrics");
        for (const metric of item.metrics) metrics.append(el("span", undefined, `${metric.value} · ${metric.label}`));
        card.append(metrics);
      }
      if (item.simds.length) {
        const links = el("div", "simd-links");
        for (const simd of item.simds) links.append(safeLink(`SIMD-${simd.id}`, simd.url));
        card.append(links);
      }
      upgradeList.append(card);
    }
    upgrades.append(upgradeList);
  }

  const news = el("article", "content-panel");
  const newsHead = el("div", "content-panel-head");
  newsHead.append(el("h3", undefined, "Ecosystem and Community News"), badge(data.news));
  news.append(newsHead);
  if (data.news.items.length === 0) {
    news.append(emptyStatePanel("No official news items are available in this snapshot."));
  } else {
    const newsList = el("div", "news-list");
    for (const item of data.news.items) {
      const row = el("article", "news-item");
      const time = el("time", undefined, fmt.date(item.publishedAt));
      time.dateTime = item.publishedAt;
      row.append(time, safeLink(item.title, item.url));
      if (item.description) row.append(el("p", undefined, item.description));
      newsList.append(row);
    }
    news.append(newsList);
  }
  contentGrid.append(upgrades, news);
  root.append(cards, chartGrid, contentGrid);
}

function sourceErrorText(source) {
  if (!source.error) return "—";
  if (typeof source.error === "string") return source.error;
  return [source.error.code, source.error.message].filter(Boolean).join(" · ") || "Unavailable";
}

function renderSources(snapshot) {
  const root = document.querySelector("#sources");
  root.replaceChildren(indexedSectionHeader(
    "sources",
    "Evidence ledger",
    "Data Sources",
    "Public, keyless-by-default providers with source time kept separate from pipeline and publication time.",
    "06 / 06"
  ));
  const table = tableShell(["Source", "State", "Last success", "Data through", "Next due", "Details"], "Canonical source provenance and freshness");
  const sources = Object.values(snapshot.sources);
  if (sources.length === 0) {
    root.append(emptyStatePanel("No source records are available in this snapshot."));
    return;
  }
  for (const source of sources) {
    const row = document.createElement("tr");
    const sourceCell = document.createElement("td");
    sourceCell.append(safeLink(source.name, source.url));
    const detail = sourceErrorText(source);
    const values = [
      sourceCell,
      source.status,
      source.lastSuccessAt ? fmt.utc(source.lastSuccessAt) : "—",
      source.dataThrough?.includes("T") ? fmt.utc(source.dataThrough) : source.dataThrough || "—",
      source.nextDueAt ? fmt.utc(source.nextDueAt) : "—",
      detail
    ];
    for (const [index, value] of values.entries()) {
      if (value instanceof HTMLElement && value.tagName === "TD") row.append(value);
      else row.append(el("td", index === 1 ? `source-state ${source.status}` : index === 5 && detail !== "—" ? "source-error" : undefined, value));
    }
    table.body.append(row);
  }
  root.append(table.wrap);
}

const dashboardSectionIds = ["alerts", "network", "validators", "economics", "ecosystem", "sources"];

export function resetDashboard() {
  closeChartExplorer();
  destroyCharts();
  for (const id of dashboardSectionIds) document.getElementById(id)?.replaceChildren();
  delete document.body.dataset.dashboardReady;
}

export function renderDashboard(snapshot) {
  resetDashboard();
  const status = document.querySelector("#overall-status");
  status.textContent = snapshot.updateStatus;
  status.className = `status-badge ${snapshot.updateStatus}`;
  const updated = document.querySelector("#updated-at");
  updated.textContent = fmt.utc(snapshot.updatedAt);
  updated.dateTime = snapshot.updatedAt;
  document.querySelector("#load-error").hidden = true;
  renderAlerts(snapshot);
  renderNetwork(snapshot);
  renderValidators(snapshot);
  renderEconomics(snapshot);
  renderEcosystem(snapshot);
  renderSources(snapshot);
  document.body.dataset.dashboardReady = "true";
}
