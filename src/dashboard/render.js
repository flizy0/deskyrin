import { destroyCharts, doughnutChart, lineChart } from "./charts.js";
import { fmt, freshnessText } from "./format.js";

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function safeLink(label, href, className) {
  const link = el("a", className, label);
  const url = new URL(href, window.location.origin);
  if (url.protocol === "https:" || url.origin === window.location.origin) link.href = url.href;
  link.target = url.origin === window.location.origin ? "_self" : "_blank";
  if (link.target === "_blank") link.rel = "noopener noreferrer";
  return link;
}

function sectionHeader(id, eyebrow, title, copy) {
  const header = el("div", "section-header");
  const text = el("div");
  text.append(el("p", "eyebrow", eyebrow), el("h2", "section-title", title), el("p", "section-copy", copy));
  text.querySelector("h2").id = `${id}-title`;
  header.append(text);
  return header;
}

function badge(domain) {
  const node = el("span", `freshness ${domain.status}`, freshnessText(domain));
  node.title = `Observed ${fmt.utc(domain.observedAt)}`;
  return node;
}

function metricCard(label, value, note, domain) {
  const card = el("article", "metric-card");
  card.append(el("p", "metric-label", label), el("p", "metric-value", value), el("p", "metric-note", note));
  if (domain) card.append(badge(domain));
  return card;
}

function chartCard(title, note) {
  const card = el("article", "chart-card");
  const head = el("div", "chart-head");
  head.append(el("h3", "chart-title", title), el("p", "chart-note", note));
  const wrap = el("div", "chart-wrap");
  const canvas = document.createElement("canvas");
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", `${title}. ${note}`);
  canvas.setAttribute("aria-keyshortcuts", "ArrowLeft ArrowRight Home End");
  canvas.tabIndex = 0;
  const liveStatus = el("span", "sr-only chart-a11y-status");
  liveStatus.setAttribute("aria-live", "polite");
  wrap.append(canvas, liveStatus);
  card.append(head, wrap);
  return { card, canvas };
}

function tableShell(headers, captionText) {
  const wrap = el("div", "table-wrap");
  const table = document.createElement("table");
  if (captionText) table.createCaption().textContent = captionText;
  const head = document.createElement("thead");
  const row = document.createElement("tr");
  for (const header of headers) row.append(el("th", undefined, header));
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

function formatCheck(check) {
  if (check.status === "unavailable") return (check.reasonCode || "data unavailable").replaceAll("_", " ").toLowerCase();
  if (check.changePct !== undefined) return fmt.pct(check.changePct, true);
  if (check.currentValue !== undefined && check.unit.startsWith("%")) return fmt.pct(check.currentValue);
  if (check.currentValue !== undefined) return fmt.decimal(check.currentValue);
  return "—";
}

function renderAlerts(snapshot) {
  const root = document.querySelector("#alerts");
  root.replaceChildren(sectionHeader("alerts", "Threshold checks", "Alerts / notable changes", "Warnings are emitted only from fresh evidence and fixed, documented thresholds."));
  const active = el("div", "alerts-active");
  if (snapshot.alerts.length === 0) {
    const clear = el("article", "alert-card clear");
    clear.append(el("span", "alert-icon", "✓"), el("div", undefined, "No active threshold warnings."));
    active.append(clear);
  } else {
    for (const alert of snapshot.alerts) {
      const card = el("article", "alert-card warning");
      const content = el("div");
      content.append(el("h3", undefined, alert.title), el("p", undefined, alert.message), el("time", undefined, fmt.utc(alert.observedAt)));
      card.append(el("span", "alert-icon", "!"), content);
      active.append(card);
    }
  }
  const checks = el("div", "check-grid");
  for (const check of snapshot.alertChecks) {
    const card = el("article", `check-card ${check.status}`);
    card.append(el("span", "check-state", check.status), el("h3", undefined, check.id.replaceAll("-", " ")), el("p", undefined, formatCheck(check)), el("small", undefined, check.window));
    checks.append(card);
  }
  root.append(active, checks);
}

function renderNetwork(snapshot) {
  const root = document.querySelector("#network");
  const performance = snapshot.network.performance;
  const chain = snapshot.network.chain;
  root.replaceChildren(sectionHeader("network", "Consensus health", "Network Performance", "Finalized chain state and duration-weighted recent RPC performance samples."));
  const cards = el("div", "metric-grid");
  cards.append(
    metricCard("TPS", fmt.integer(performance.tps.total), "All transactions · latest 5 minutes", performance),
    metricCard("Slot time", `${fmt.decimal(performance.slotTimeMs)} ms`, "Duration ÷ produced slots", performance),
    metricCard("Block height", fmt.integer(BigInt(chain.blockHeight)), `Finalized slot ${fmt.integer(BigInt(chain.slot))}`, chain),
    metricCard("Epoch progress", fmt.pct(chain.epoch.progressPct), `Epoch ${chain.epoch.number} · ${fmt.integer(chain.epoch.slotIndex)} / ${fmt.integer(chain.epoch.slotsInEpoch)} slots`, chain)
  );
  const chartGrid = el("div", "chart-grid two");
  const tpsChart = chartCard("TPS history", "Total and non-vote transactions per second");
  const slotChart = chartCard("Slot-time history", "Milliseconds per produced slot");
  chartGrid.append(tpsChart.card, slotChart.card);
  root.append(cards, chartGrid);
  const labels = performance.history.map((point) => point.observedAt);
  lineChart(tpsChart.canvas, labels, [
    { label: "Total TPS", data: performance.history.map((point) => point.totalTps) },
    { label: "Non-vote TPS", data: performance.history.map((point) => point.nonVoteTps) }
  ], (value) => fmt.integer(value));
  lineChart(slotChart.canvas, labels, [{ label: "Slot time", data: performance.history.map((point) => point.slotTimeMs) }], (value) => `${fmt.decimal(value)} ms`);
}

function renderValidators(snapshot) {
  const root = document.querySelector("#validators");
  const data = snapshot.validators;
  root.replaceChildren(sectionHeader("validators", "Activated stake", "Validator Status", "Staked vote accounts classified by the RPC default 128-slot delinquency window."));
  const cards = el("div", "metric-grid");
  cards.append(
    metricCard("Active validators", fmt.integer(data.counts.active), `${fmt.integer(data.counts.total)} total staked validators`, data),
    metricCard("Delinquent validators", fmt.integer(data.counts.delinquent), `${fmt.pct(data.stake.delinquentPct)} of activated stake`, data),
    metricCard("Top 10 stake share", fmt.pct(data.stake.top10Pct), "Share of total activated stake", data),
    metricCard("Commission changes", fmt.integer(data.commissionChanges.length), "Observed since tracking began", data)
  );
  const distribution = chartCard("Top validators by stake", "Ranks 1–10 plus all remaining activated stake");
  const table = tableShell(["Rank", "Vote account", "Status", "Stake (SOL)", "Share", "Commission"], "All validators — current stake rank, status, and commission");
  table.wrap.classList.add("validator-table");
  for (const validator of data.table) {
    const row = document.createElement("tr");
    if (validator.status === "delinquent") row.className = "row-delinquent";
    const keyCell = document.createElement("td");
    const code = el("code", undefined, validator.votePubkey);
    keyCell.append(code);
    const state = el("span", `validator-state ${validator.status}`, validator.status);
    const values = [validator.rank, keyCell, state, fmt.stakeSol(validator.activatedStakeLamports), fmt.pct(validator.stakeSharePct), `${validator.commissionPct}%`];
    const sortValues = [validator.rank, validator.votePubkey, validator.status, validator.activatedStakeLamports, validator.stakeSharePct, validator.commissionPct];
    for (const [index, value] of values.entries()) {
      if (value instanceof HTMLElement && value.tagName === "TD") {
        value.dataset.sortValue = String(sortValues[index]);
        row.append(value);
      }
      else {
        const cell = document.createElement("td");
        cell.dataset.sortValue = String(sortValues[index]);
        cell.append(value instanceof Node ? value : document.createTextNode(String(value)));
        row.append(cell);
      }
    }
    table.body.append(row);
  }
  const split = el("div", "validator-layout");
  split.append(distribution.card, table.wrap);
  makeSortable(table.table, table.body, ["number", "text", "text", "bigint", "number", "number"]);

  const commission = el("article", "commission-panel");
  commission.append(el("h3", undefined, "Commission tracking"));
  if (data.commissionChanges.length === 0) {
    commission.append(el("p", "empty-note", "No commission changes have been observed since tracking began."));
  } else {
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
  }
  root.append(cards, split, commission);
  doughnutChart(distribution.canvas, data.stake.distribution.map((point) => point.label), data.stake.distribution.map((point) => point.sharePct), (value) => fmt.pct(value));
}

function renderEconomics(snapshot) {
  const root = document.querySelector("#economics");
  const data = snapshot.economics;
  root.replaceChildren(sectionHeader("economics", "On-chain economy", "Economic Indicators", "Market, liquidity, trading, fee, and REV series with completed-day boundaries where applicable."));
  const cards = el("div", "metric-grid");
  cards.append(
    metricCard("SOL price", fmt.usd(data.solPrice.currentUsd), `${fmt.pct(data.solPrice.change24hPct, true)} over 24 hours`, data.solPrice),
    metricCard("Stablecoin supply", fmt.usd(data.stablecoinSupply.totalCirculatingUsd), `USD-equivalent circulating · ${fmt.date(data.stablecoinSupply.date)}`, data.stablecoinSupply),
    metricCard("DEX volume", fmt.usd(data.dexVolume.dailyVolumeUsd), `Completed UTC day · ${fmt.date(data.dexVolume.date)}`, data.dexVolume),
    metricCard("REV", `${fmt.compact(data.rev.totalSol)} SOL`, `Fees + gross Jito tips · ${fmt.date(data.rev.date)}`, data.rev),
    metricCard("Median transaction fee", `${fmt.decimal(data.medianTransactionFee.medianLamports)} lamports`, `${fmt.integer(data.medianTransactionFee.sample.transactionCount)} transactions sampled`, data.medianTransactionFee)
  );
  const chartGrid = el("div", "chart-grid three");
  const specs = [
    { title: "SOL price", note: "USD reference price", history: data.solPrice.history, key: "observedAt", series: [["SOL price", "priceUsd"]], formatter: fmt.usd },
    { title: "Stablecoin supply", note: "USD-equivalent circulating", history: data.stablecoinSupply.history, key: "date", series: [["Stablecoin supply", "totalCirculatingUsd"]], formatter: fmt.usd },
    { title: "DEX volume", note: "Direct DEX volume per completed UTC day", history: data.dexVolume.history, key: "date", series: [["DEX volume", "dailyVolumeUsd"]], formatter: fmt.usd },
    {
      title: "Real Economic Value",
      note: "Transaction fees + gross Jito tips",
      history: data.rev.history,
      key: "date",
      series: [["REV total", "totalSol"], ["Transaction fees", "transactionFeesSol"], ["Gross Jito tips", "grossJitoTipsSol"]],
      formatter: (value) => `${fmt.compact(value)} SOL`
    },
    { title: "Median transaction fee", note: "Stratified finalized-block sample", history: data.medianTransactionFee.history, key: "observedAt", series: [["Median transaction fee", "medianLamports"]], formatter: (value) => `${fmt.decimal(value)} lamports` }
  ];
  for (const { title, note, history, key, series, formatter } of specs) {
    const chart = chartCard(title, note);
    chartGrid.append(chart.card);
    lineChart(
      chart.canvas,
      history.map((point) => key === "date" ? `${point[key]}T00:00:00.000Z` : point[key]),
      series.map(([label, field]) => ({ label, data: history.map((point) => point[field]) })),
      formatter
    );
  }
  root.append(cards, chartGrid);
}

function renderEcosystem(snapshot) {
  const root = document.querySelector("#ecosystem");
  const data = snapshot.ecosystem;
  root.replaceChildren(sectionHeader("ecosystem", "Adoption and roadmap", "Ecosystem Growth", "Only the listing-defined growth metrics, official ecosystem news, and upcoming protocol developments."));
  const cards = el("div", "metric-grid");
  cards.append(
    metricCard("Tokenized assets", fmt.usd(data.tokenizedAssets.totalTransferVolumeUsd), "Trailing 30-day transfer volume · stablecoins excluded", data.tokenizedAssets),
    metricCard("Tokenized equities", fmt.usd(data.tokenizedAssets.equityTransferVolumeUsd), "Stocks subset · trailing 30-day transfer volume", data.tokenizedAssets),
    metricCard("Daily active addresses", fmt.decimal(data.dailyActiveAddresses.value), `Initiating signers / fee payers · ${fmt.date(data.dailyActiveAddresses.date)}`, data.dailyActiveAddresses)
  );
  const chartGrid = el("div", "chart-grid two");
  const rwaChart = chartCard("Tokenized-asset transfer volume", "Trailing 30-day total and Stocks subset");
  const addressChart = chartCard("Daily active addresses", "Median of aligned Allium and Dune fee-payer observations");
  chartGrid.append(rwaChart.card, addressChart.card);
  lineChart(rwaChart.canvas, data.tokenizedAssets.history.map((point) => point.observedAt), [
    { label: "All tokenized assets", data: data.tokenizedAssets.history.map((point) => point.totalTransferVolumeUsd) },
    { label: "Tokenized equities", data: data.tokenizedAssets.history.map((point) => point.equityTransferVolumeUsd) }
  ], fmt.usd);
  lineChart(addressChart.canvas, data.dailyActiveAddresses.history.map((point) => `${point.date}T00:00:00.000Z`), [{ label: "Active addresses", data: data.dailyActiveAddresses.history.map((point) => point.value) }], fmt.compact);

  const contentGrid = el("div", "content-grid");
  const upgrades = el("article", "content-panel");
  upgrades.append(el("h3", undefined, "Upcoming upgrades and developments"), badge(data.upgrades));
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

  const news = el("article", "content-panel");
  news.append(el("h3", undefined, "Ecosystem and Community News"), badge(data.news));
  const newsList = el("div", "news-list");
  for (const item of data.news.items) {
    const row = el("article", "news-item");
    row.append(el("time", undefined, fmt.date(item.publishedAt)), safeLink(item.title, item.url));
    if (item.description) row.append(el("p", undefined, item.description));
    newsList.append(row);
  }
  news.append(newsList);
  contentGrid.append(upgrades, news);
  root.append(cards, chartGrid, contentGrid);
}

function renderSources(snapshot) {
  const root = document.querySelector("#sources");
  root.replaceChildren(sectionHeader("sources", "Provenance", "Data Sources", "Every source is public and keyless by default; source time is kept separate from pipeline update time."));
  const table = tableShell(["Source", "State", "Last success", "Data through", "Next due"]);
  for (const source of Object.values(snapshot.sources)) {
    const row = document.createElement("tr");
    const sourceCell = document.createElement("td");
    sourceCell.append(safeLink(source.name, source.url));
    const values = [sourceCell, source.status, source.lastSuccessAt ? fmt.utc(source.lastSuccessAt) : "—", source.dataThrough?.includes("T") ? fmt.utc(source.dataThrough) : source.dataThrough || "—", fmt.utc(source.nextDueAt)];
    for (const value of values) {
      if (value instanceof HTMLElement && value.tagName === "TD") row.append(value);
      else row.append(el("td", value === source.status ? `source-state ${source.status}` : undefined, value));
    }
    table.body.append(row);
  }
  root.append(table.wrap);
}

export function renderDashboard(snapshot) {
  destroyCharts();
  const status = document.querySelector("#overall-status");
  status.textContent = snapshot.updateStatus;
  status.className = `status-badge ${snapshot.updateStatus}`;
  const updated = document.querySelector("#updated-at");
  updated.textContent = fmt.utc(snapshot.updatedAt);
  updated.dateTime = snapshot.updatedAt;
  renderAlerts(snapshot);
  renderNetwork(snapshot);
  renderValidators(snapshot);
  renderEconomics(snapshot);
  renderEcosystem(snapshot);
  renderSources(snapshot);
}
