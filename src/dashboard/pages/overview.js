import { DATA_COLORS } from "../theme.js";
import { fmt } from "../format.js";
import { el } from "../ui.js";
import {
  chartPanel,
  checkStateLabel,
  formatCheckEvidence,
  formatCheckValue,
  formatStakeCompact,
  historySpec,
  metricCard,
  metricGrid,
  pageHeader,
  panel,
  routeLink
} from "../view-utils.js";

const CHECK_LABELS = {
  "tps-change": "TPS change",
  "slow-slot-time": "Slot time",
  "high-validator-delinquency": "Validator delinquency",
  "large-tvl-change": "TVL movement",
  "large-sol-price-move": "SOL movement"
};

function alertCheckGrid(snapshot) {
  const container = panel({
    title: "Notable-change checks",
    note: "Five deterministic checks evaluate only fresh evidence.",
    className: "alert-checks-panel",
    action: routeLink("Methodology", "sources", "panel-link")
  });

  if (snapshot.alerts.length) {
    const active = el("div", "active-alerts");
    for (const alert of snapshot.alerts) {
      const item = el("article", "active-alert");
      item.append(
        el("span", "status-dot"),
        el("div", "active-alert-copy")
      );
      item.lastElementChild.append(el("strong", undefined, alert.title), el("p", undefined, alert.message));
      active.append(item);
    }
    container.append(active);
  } else {
    const clear = el("div", "alert-summary clear");
    clear.append(el("span", "status-dot"), el("strong", undefined, "No active threshold warnings"), el("span", undefined, "Current checks are shown below."));
    container.append(clear);
  }

  const grid = el("div", "check-grid");
  for (const check of snapshot.alertChecks) {
    const card = el("article", `check-card ${check.status}`);
    const state = el("div", "check-card-state");
    state.append(el("span", "status-dot"), el("span", undefined, checkStateLabel(check)));
    card.append(
      state,
      el("h3", undefined, CHECK_LABELS[check.id] || check.id),
      el("p", "check-value", formatCheckValue(check)),
      el("p", "check-window", check.window),
      el("p", "check-evidence", formatCheckEvidence(check))
    );
    grid.append(card);
  }
  container.append(grid);
  return container;
}

function validatorSnapshot(snapshot) {
  const data = snapshot.validators;
  const card = panel({
    title: "Validator snapshot",
    note: "Current activated-stake health and concentration.",
    className: "validator-snapshot cut-corner",
    domain: data,
    action: routeLink("Open validators", "validators", "panel-link")
  });

  const stats = el("div", "validator-summary-stats");
  for (const [label, value, tone] of [
    ["Total stake", formatStakeCompact(data.stake.totalLamports), "validator"],
    ["Active", fmt.integer(data.counts.active), "positive"],
    ["Delinquent", `${fmt.integer(data.counts.delinquent)} · ${fmt.pct(data.stake.delinquentPct)}`, data.stake.delinquentPct >= 5 ? "negative" : "muted"]
  ]) {
    const stat = el("div", `summary-stat tone-${tone}`);
    stat.append(el("span", undefined, label), el("strong", undefined, value));
    stats.append(stat);
  }
  card.append(stats);

  const rows = data.stake.distribution.filter((point) => point.status !== "aggregate").slice(0, 5);
  const max = Math.max(1, ...rows.map((point) => point.sharePct));
  const list = el("div", "stake-mini-list");
  for (const point of rows) {
    const row = el("div", "stake-mini-row");
    const label = el("code", undefined, point.votePubkey ? fmt.shortKey(point.votePubkey) : point.label);
    label.title = point.votePubkey || point.label;
    const track = el("span", "stake-track");
    const fill = el("span", "stake-fill");
    fill.style.width = `${Math.max(2, point.sharePct / max * 100)}%`;
    track.append(fill);
    row.append(label, track, el("span", "stake-value", fmt.pct(point.sharePct)));
    list.append(row);
  }
  card.append(el("p", "subsection-label", `Top five vote accounts · Top 10 ${fmt.pct(data.stake.top10Pct)}`), list);
  return card;
}

export function renderOverview(snapshot, root) {
  const network = snapshot.network.performance;
  const economics = snapshot.economics;
  const ecosystem = snapshot.ecosystem;
  const checks = new Map(snapshot.alertChecks.map((check) => [check.id, check]));

  root.append(pageHeader({
    eyebrow: "Solana intelligence terminal",
    title: "Overview",
    copy: "Current network, economic, validator, and adoption signals from one canonical snapshot.",
    meta: [snapshot.updateStatus === "complete" ? "All domains current" : "Some domains stale", `${Object.keys(snapshot.sources).length} source records`]
  }));

  root.append(metricGrid([
    metricCard({
      label: "Total TPS",
      value: fmt.integer(network.tps.total),
      note: "Latest duration-weighted 5-minute sample",
      domain: network,
      tone: "network",
      change: checks.get("tps-change")?.changePct === undefined ? undefined : { value: checks.get("tps-change").changePct, tone: "neutral", label: `${fmt.pct(checks.get("tps-change").changePct, true)} vs baseline` },
      series: network.history.map((point) => point.totalTps),
      href: "#network"
    }),
    metricCard({
      label: "Slot time",
      value: `${fmt.decimal(network.slotTimeMs)} ms`,
      note: "Average produced-slot interval",
      domain: network,
      tone: "network-secondary",
      change: checks.get("slow-slot-time")?.changePct === undefined ? undefined : { value: checks.get("slow-slot-time").changePct, tone: "neutral", label: `${fmt.pct(checks.get("slow-slot-time").changePct, true)} vs baseline` },
      series: network.history.map((point) => point.slotTimeMs),
      href: "#network"
    }),
    metricCard({
      label: "SOL price",
      value: fmt.usd(economics.solPrice.currentUsd),
      note: "USD reference price",
      domain: economics.solPrice,
      tone: "sol",
      change: { value: economics.solPrice.change24hPct, tone: economics.solPrice.change24hPct >= 0 ? "positive" : "negative", label: `${fmt.pct(economics.solPrice.change24hPct, true)} · 24h` },
      series: economics.solPrice.history.map((point) => point.priceUsd),
      href: "#economy"
    }),
    metricCard({
      label: "DEX volume",
      value: fmt.usd(economics.dexVolume.dailyVolumeUsd),
      note: `Completed UTC day · ${fmt.date(economics.dexVolume.date)}`,
      domain: economics.dexVolume,
      tone: "network",
      series: economics.dexVolume.history.map((point) => point.dailyVolumeUsd),
      href: "#economy"
    }),
    metricCard({
      label: "Daily active addresses",
      value: fmt.decimal(ecosystem.dailyActiveAddresses.value),
      note: `Initiating signers · ${fmt.date(ecosystem.dailyActiveAddresses.date)}`,
      domain: ecosystem.dailyActiveAddresses,
      tone: "sage",
      series: ecosystem.dailyActiveAddresses.history.map((point) => point.value),
      href: "#ecosystem"
    })
  ], "metric-grid-five"));

  const tpsSpec = historySpec(snapshot, {
    title: "Network activity",
    note: "Total and non-vote transactions per second · exact UTC observations",
    domain: network,
    history: network.history,
    time: (point) => point.observedAt,
    series: [
      { label: "Total TPS", field: "totalTps", color: DATA_COLORS.network, fill: true },
      { label: "Non-vote TPS", field: "nonVoteTps", color: DATA_COLORS.networkSecondary }
    ],
    formatter: fmt.integer
  });
  const activity = chartPanel(tpsSpec, {
    className: "span-8 chart-primary cut-corner",
    meta: [`${network.history.length} observations`, "No interpolation", `Observed ${fmt.utc(network.observedAt)}`]
  });
  const primaryGrid = el("div", "analytics-grid overview-primary-grid");
  primaryGrid.append(activity.card, validatorSnapshot(snapshot));
  root.append(primaryGrid, alertCheckGrid(snapshot));
  activity.draw();
}
