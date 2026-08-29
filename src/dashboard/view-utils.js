import { closeChartExplorer, openChartExplorer } from "./chart-explorer.js";
import { destroyCharts, lineChart, stackedBarChart } from "./charts.js";
import { fmt, freshnessText } from "./format.js";
import { sparkline } from "./sparkline.js";
import { el, emptyStatePanel, safeLink } from "./ui.js";

export function resetView(root) {
  closeChartExplorer();
  destroyCharts();
  root?.replaceChildren();
}

export function pageHeader({ eyebrow, title, copy, meta = [] }) {
  const header = el("header", "page-header");
  const heading = el("div", "page-heading");
  if (eyebrow) heading.append(el("p", "eyebrow", eyebrow));
  heading.append(el("h1", "page-title", title));
  if (copy) heading.append(el("p", "page-copy", copy));
  header.append(heading);

  if (meta.length) {
    const list = el("div", "page-meta");
    for (const item of meta) list.append(el("span", undefined, item));
    header.append(list);
  }
  return header;
}

function freshnessLabel(domain, { compact = false } = {}) {
  if (!domain) return null;
  const label = el("span", `freshness-label ${domain.status}`);
  label.dataset.status = domain.status;
  label.title = `Observed ${fmt.utc(domain.observedAt)}`;
  label.append(el("span", "status-dot"), document.createTextNode(compact && domain.status === "fresh" ? "Fresh" : freshnessText(domain)));
  return label;
}

function deltaNode(change) {
  if (!change || change.value === undefined || !Number.isFinite(change.value)) return null;
  const tone = change.tone || "neutral";
  const node = el("span", `metric-delta ${tone}`);
  const arrow = change.value > 0 ? "↑" : change.value < 0 ? "↓" : "→";
  node.append(el("span", "metric-delta-arrow", arrow), document.createTextNode(change.label || fmt.pct(change.value, true)));
  return node;
}

export function metricCard({ label, value, note, domain, tone = "neutral", change, series, seriesGapMs, href, ariaLabel }) {
  const card = el("article", `metric-card tone-${tone}`);
  card.setAttribute("aria-label", ariaLabel || label);
  const head = el("div", "metric-card-head");
  head.append(el("p", "metric-label", label));
  const delta = deltaNode(change);
  if (delta) head.append(delta);
  card.append(head, el("p", "metric-value", value));
  if (note) card.append(el("p", "metric-note", note));

  if (Array.isArray(series) && series.length) {
    const chart = sparkline(series, { className: "metric-sparkline", tone, label: `${label} recent history`, maxGapMs: seriesGapMs });
    if (chart) card.append(chart);
  }

  const foot = el("div", "metric-card-foot");
  const freshness = freshnessLabel(domain, { compact: true });
  if (freshness) foot.append(freshness);
  if (href) foot.append(href.startsWith("#") ? routeLink("Open", href.slice(1), "metric-link") : safeLink("Open", href, "metric-link"));
  if (foot.childElementCount) card.append(foot);
  return card;
}

export function metricGrid(cards, className = "") {
  const grid = el("div", ["metric-grid", className].filter(Boolean).join(" "));
  grid.append(...cards);
  return grid;
}

function panelHeader(title, note, { action, domain, eyebrow } = {}) {
  const header = el("header", "panel-header");
  const copy = el("div", "panel-heading");
  if (eyebrow) copy.append(el("p", "panel-eyebrow", eyebrow));
  copy.append(el("h2", "panel-title", title));
  if (note) copy.append(el("p", "panel-note", note));
  header.append(copy);
  const tools = el("div", "panel-tools");
  const freshness = freshnessLabel(domain, { compact: true });
  if (freshness) tools.append(freshness);
  if (action) tools.append(action);
  if (tools.childElementCount) header.append(tools);
  return header;
}

export function panel({ title, note, className = "", domain, action, eyebrow } = {}) {
  const node = el("article", ["panel", className].filter(Boolean).join(" "));
  if (title) node.append(panelHeader(title, note, { action, domain, eyebrow }));
  return node;
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

export function historySpec(snapshot, { title, note, domain, history, time, series, formatter, beginAtZero = false, type = "line" }) {
  const fields = series.map((item) => item.field);
  if (!isPlottable(history, time, fields)) return null;
  return {
    title,
    note,
    labels: history.map(time),
    datasets: series.map(({ label, field, ...style }) => ({ label, data: history.map((point) => point[field]), ...style })),
    yFormatter: formatter,
    beginAtZero,
    type,
    observedAt: domain.observedAt,
    updatedAt: snapshot.updatedAt
  };
}

export function chartPanel(spec, { title, note, className = "", meta = [], emptyMessage, type } = {}) {
  const chartTitle = title || spec?.title || "History";
  const chartNote = note || spec?.note || "Canonical observations";
  let expand;
  if (spec) {
    expand = el("button", "chart-expand-button", "Explore");
    expand.type = "button";
    expand.dataset.chartExplorerOpen = "";
    expand.setAttribute("aria-label", `Explore ${chartTitle}`);
    expand.setAttribute("aria-haspopup", "dialog");
    expand.addEventListener("click", () => openChartExplorer({ ...spec, type: type || spec.type || "line" }, expand));
  }
  const card = panel({ title: chartTitle, note: chartNote, className: ["chart-card", className].filter(Boolean).join(" "), action: expand });

  if (meta.length) {
    const row = el("div", "chart-meta-row");
    for (const item of meta) row.append(el("span", undefined, item));
    card.append(row);
  }

  if (!spec) {
    card.append(emptyStatePanel(emptyMessage || "Insufficient canonical history for this view.", {
      title: "History unavailable"
    }));
    return { card, draw() {} };
  }

  const wrap = el("div", "chart-wrap");
  const canvas = document.createElement("canvas");
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", `${chartTitle}. ${chartNote}`);
  canvas.setAttribute("aria-keyshortcuts", "ArrowLeft ArrowRight Home End");
  canvas.tabIndex = 0;
  const liveStatus = el("span", "sr-only chart-a11y-status");
  liveStatus.setAttribute("aria-live", "polite");
  wrap.append(canvas, liveStatus);
  card.append(wrap);

  return {
    card,
    draw() {
      const chartType = type || spec.type || "line";
      if (chartType === "stackedBar") return stackedBarChart(canvas, spec.labels, spec.datasets, spec.yFormatter);
      return lineChart(canvas, spec.labels, spec.datasets, spec.yFormatter, {
        beginAtZero: spec.beginAtZero === true,
        legend: spec.legend !== false
      });
    }
  };
}

export function formatCheckValue(check) {
  if (check.status === "unavailable") return (check.reasonCode || "data unavailable").replaceAll("_", " ").toLowerCase();
  if (check.changePct !== undefined) return fmt.pct(check.changePct, true);
  if (check.currentValue !== undefined && check.unit.startsWith("%")) return fmt.pct(check.currentValue);
  if (check.currentValue !== undefined) return fmt.decimal(check.currentValue);
  return "—";
}

export function formatCheckEvidence(check) {
  const fragments = [];
  if (check.referenceValue !== undefined) {
    if (check.kind === "tvl_change" || check.kind === "sol_price_move") fragments.push(`Baseline ${fmt.usd(check.referenceValue)}`);
    else if (check.unit === "ms") fragments.push(`Baseline ${fmt.decimal(check.referenceValue)} ms`);
    else if (check.unit.includes("%")) fragments.push(`Baseline ${fmt.pct(check.referenceValue)}`);
    else if (check.unit === "TPS") fragments.push(`Baseline ${fmt.integer(check.referenceValue)} TPS`);
    else fragments.push(`Baseline ${fmt.compact(check.referenceValue)}`);
  }
  const threshold = check.threshold || {};
  if (threshold.relativePct !== undefined && threshold.absoluteTps !== undefined) fragments.push(`Trigger ±${threshold.relativePct}% and ±${fmt.integer(threshold.absoluteTps)} TPS`);
  else if (threshold.relativePct !== undefined && threshold.absoluteMs !== undefined) fragments.push(`Trigger +${threshold.relativePct}% and +${fmt.integer(threshold.absoluteMs)} ms`);
  else if (threshold.percent !== undefined) fragments.push(`Trigger ${fmt.pct(threshold.percent)}${threshold.confirmations ? ` · ${threshold.confirmations} confirmations` : ""}`);
  else if (threshold.absolutePct !== undefined) fragments.push(`Trigger ±${fmt.pct(threshold.absolutePct)}`);
  return fragments.join(" · ");
}

export function checkStateLabel(check) {
  return check.status === "triggered" ? "Warning" : check.status === "unavailable" ? "Unavailable" : "Normal";
}

export function progressBar(value, label, { tone = "network" } = {}) {
  const wrapper = el("div", "progress-block");
  const head = el("div", "progress-head");
  head.append(el("span", undefined, label), el("span", undefined, fmt.pct(value)));
  const track = el("div", "progress-track");
  track.setAttribute("role", "progressbar");
  track.setAttribute("aria-label", label);
  track.setAttribute("aria-valuemin", "0");
  track.setAttribute("aria-valuemax", "100");
  track.setAttribute("aria-valuenow", String(value));
  const fill = el("span", `progress-fill tone-${tone}`);
  fill.style.width = `${Math.min(100, Math.max(0, value))}%`;
  track.append(fill);
  wrapper.append(head, track);
  return wrapper;
}

export function routeLink(label, route, className = "text-link") {
  const link = el("a", className, label);
  link.href = `#${route}`;
  link.dataset.routeLink = route;
  return link;
}

export function copyButton(value, label = "Copy") {
  const button = el("button", "copy-button", label);
  button.type = "button";
  button.title = `Copy ${value}`;
  button.setAttribute("aria-label", `Copy ${value}`);
  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(value);
      button.textContent = "Copied";
      button.dataset.copied = "true";
      setTimeout(() => {
        button.textContent = label;
        delete button.dataset.copied;
      }, 1_500);
    } catch {
      button.textContent = "Select key";
    }
  });
  return button;
}

export function shortKey(value) {
  return value.length > 18 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
}

export function formatStakeCompact(lamports) {
  const value = BigInt(lamports);
  const hundredthsOfMillionSol = value / 10_000_000_000_000n;
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(Number(hundredthsOfMillionSol) / 100)}M SOL`;
}

export function sourceErrorText(source) {
  if (!source.error) return "—";
  if (typeof source.error === "string") return source.error;
  return [source.error.code, source.error.message].filter(Boolean).join(" · ") || "Unavailable";
}
