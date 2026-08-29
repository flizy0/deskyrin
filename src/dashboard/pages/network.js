import { DATA_COLORS } from "../charts.js";
import { coverageGapCallout } from "../coverage-callout.js";
import { fmt } from "../format.js";
import { el } from "../ui.js";
import {
  chartPanel,
  checkStateLabel,
  formatCheckEvidence,
  formatCheckValue,
  historySpec,
  metricCard,
  metricGrid,
  pageHeader,
  panel,
  progressBar
} from "../view-utils.js";

const LIVE_GAP_MS = 3 * 60 * 60 * 1_000;

function chainStatePanel(chain, performance) {
  const card = panel({
    title: "Finalized chain state",
    note: "Exact RPC position and sample provenance.",
    className: "span-4 chain-state-panel cut-corner",
    domain: chain
  });
  const list = el("dl", "technical-list");
  for (const [label, value] of [
    ["Finalized slot", fmt.integer(BigInt(chain.slot))],
    ["Block height", fmt.integer(BigInt(chain.blockHeight))],
    ["Epoch", fmt.integer(chain.epoch.number)],
    ["Sample window", `${fmt.integer(performance.sample.windowSeconds / 60)} min`],
    ["Performance samples", fmt.integer(performance.sample.count)],
    ["Ending sample slot", fmt.integer(BigInt(performance.sample.endingSlot))]
  ]) {
    const row = el("div");
    row.append(el("dt", undefined, label), el("dd", undefined, value));
    list.append(row);
  }
  card.append(list, progressBar(chain.epoch.progressPct, `Epoch ${chain.epoch.number} progress`, { tone: "network" }));
  return card;
}

function thresholdEvidence(snapshot) {
  const selected = snapshot.alertChecks.filter((check) => check.id === "tps-change" || check.id === "slow-slot-time");
  const card = panel({
    title: "Network checks",
    note: "Current evidence against documented thresholds.",
    className: "span-4 threshold-panel"
  });
  const list = el("div", "threshold-list");
  for (const check of selected) {
    const item = el("article", `threshold-item ${check.status}`);
    const head = el("div", "threshold-head");
    head.append(el("span", "status-dot"), el("strong", undefined, check.id === "tps-change" ? "TPS change" : "Slow slot time"), el("span", undefined, checkStateLabel(check)));
    item.append(head, el("p", "threshold-value", formatCheckValue(check)), el("p", "threshold-note", formatCheckEvidence(check)), el("small", undefined, check.window));
    list.append(item);
  }
  card.append(list);
  return card;
}

export function renderNetwork(snapshot, root) {
  const performance = snapshot.network.performance;
  const chain = snapshot.network.chain;

  root.append(pageHeader({
    eyebrow: "Consensus telemetry",
    title: "Network",
    copy: "Finalized chain position and duration-weighted RPC performance at their real observation times.",
    meta: [`Observed ${fmt.utc(performance.observedAt)}`, `${performance.history.length} stored observations`]
  }));

  const coverage = coverageGapCallout(snapshot, { affectedMetrics: ["TPS", "Non-vote TPS", "Slot time"] });
  if (coverage) root.append(coverage);

  root.append(metricGrid([
    metricCard({
      label: "Total TPS",
      value: fmt.integer(performance.tps.total),
      note: "All transactions · latest 5 minutes",
      domain: performance,
      tone: "network",
      series: performance.history.map((point) => ({ observedAt: point.observedAt, value: point.totalTps })),
      seriesGapMs: LIVE_GAP_MS
    }),
    metricCard({
      label: "Non-vote TPS",
      value: fmt.integer(performance.tps.nonVote),
      note: "Provenance for transaction composition",
      domain: performance,
      tone: "network-secondary",
      series: performance.history.map((point) => ({ observedAt: point.observedAt, value: point.nonVoteTps })),
      seriesGapMs: LIVE_GAP_MS
    }),
    metricCard({
      label: "Slot time",
      value: `${fmt.decimal(performance.slotTimeMs)} ms`,
      note: "Duration divided by produced slots",
      domain: performance,
      tone: "network-secondary",
      series: performance.history.map((point) => ({ observedAt: point.observedAt, value: point.slotTimeMs })),
      seriesGapMs: LIVE_GAP_MS
    }),
    metricCard({
      label: "Block height",
      value: fmt.integer(BigInt(chain.blockHeight)),
      note: `Finalized slot ${fmt.integer(BigInt(chain.slot))}`,
      domain: chain,
      tone: "neutral"
    }),
    metricCard({
      label: "Epoch progress",
      value: fmt.pct(chain.epoch.progressPct),
      note: `Epoch ${chain.epoch.number} · ${fmt.integer(chain.epoch.slotIndex)} / ${fmt.integer(chain.epoch.slotsInEpoch)}`,
      domain: chain,
      tone: "neutral"
    })
  ], "metric-grid-five"));

  const tpsSpec = historySpec(snapshot, {
    title: "TPS history",
    note: "Total and non-vote transactions per second",
    domain: performance,
    history: performance.history,
    time: (point) => point.observedAt,
    series: [
      { label: "Total TPS", field: "totalTps", color: DATA_COLORS.network, fill: true, spanGaps: LIVE_GAP_MS },
      { label: "Non-vote TPS", field: "nonVoteTps", color: DATA_COLORS.networkSecondary, spanGaps: LIVE_GAP_MS }
    ],
    formatter: fmt.integer
  });
  const slotSpec = historySpec(snapshot, {
    title: "Slot-time history",
    note: "Milliseconds per produced slot",
    domain: performance,
    history: performance.history,
    time: (point) => point.observedAt,
    series: [{ label: "Slot time", field: "slotTimeMs", color: DATA_COLORS.networkSecondary, fill: true, spanGaps: LIVE_GAP_MS }],
    formatter: (value) => `${fmt.decimal(value)} ms`
  });

  const tps = chartPanel(tpsSpec, {
    className: "span-8 chart-primary cut-corner",
    meta: ["Exact timestamps · UTC", "No synthetic points"]
  });
  const top = el("div", "analytics-grid");
  top.append(tps.card, chainStatePanel(chain, performance));

  const slot = chartPanel(slotSpec, {
    className: "span-8",
    meta: ["Produced-slot interval estimate", `${performance.history.length} observations`]
  });
  const bottom = el("div", "analytics-grid");
  bottom.append(slot.card, thresholdEvidence(snapshot));
  root.append(top, bottom);
  tps.draw();
  slot.draw();
}
