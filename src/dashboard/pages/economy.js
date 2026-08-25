import { DATA_COLORS } from "../theme.js";
import { fmt } from "../format.js";
import { el } from "../ui.js";
import {
  chartPanel,
  historySpec,
  metricCard,
  metricGrid,
  pageHeader,
  panel
} from "../view-utils.js";

function evidencePanels(data) {
  const grid = el("div", "evidence-grid");
  const rev = panel({
    title: "REV evidence",
    note: "Same-date fee consensus plus gross Jito tips.",
    className: "evidence-panel",
    domain: data.rev
  });
  const revList = el("dl", "technical-list compact");
  const rows = [
    ["Shared completed date", fmt.date(data.rev.date)],
    ["Transaction fees", `${fmt.decimal(data.rev.components.transactionFeesSol)} SOL`],
    ["Gross Jito tips", `${fmt.decimal(data.rev.components.grossJitoTipsSol)} SOL`],
    ...data.rev.feeConsensus.providers.map((provider) => [`${provider.name} fees`, `${fmt.decimal(provider.valueSol)} SOL`])
  ];
  for (const [label, value] of rows) {
    const row = el("div");
    row.append(el("dt", undefined, label), el("dd", undefined, value));
    revList.append(row);
  }
  rev.append(revList);

  const fee = data.medianTransactionFee;
  const sample = panel({
    title: "Median-fee sample",
    note: "Finalized-block stratified estimate; not a network-wide scan.",
    className: "evidence-panel",
    domain: fee
  });
  const sampleList = el("dl", "technical-list compact");
  for (const [label, value] of [
    ["Selected blocks", fmt.integer(fee.sample.selectedBlockCount)],
    ["Transactions", fmt.integer(fee.sample.transactionCount)],
    ["Produced-slot population", fmt.integer(fee.sample.producedSlotCount)],
    ["Approximate window", `${fmt.integer(fee.sample.approximateWindowSeconds / 60)} min`],
    ["Commitment", fee.sample.commitment]
  ]) {
    const row = el("div");
    row.append(el("dt", undefined, label), el("dd", undefined, value));
    sampleList.append(row);
  }
  sample.append(sampleList);
  grid.append(rev, sample);
  return grid;
}

export function renderEconomy(snapshot, root) {
  const data = snapshot.economics;
  root.append(pageHeader({
    eyebrow: "Markets and value capture",
    title: "Economy",
    copy: "Price, liquidity, completed-day trading, economic value, and sampled transaction costs.",
    meta: ["Mixed source cadences", "Every panel carries its own observation time"]
  }));

  root.append(metricGrid([
    metricCard({
      label: "SOL price",
      value: fmt.usd(data.solPrice.currentUsd),
      note: "USD reference price",
      domain: data.solPrice,
      tone: "sol",
      change: { value: data.solPrice.change24hPct, tone: data.solPrice.change24hPct >= 0 ? "positive" : "negative", label: `${fmt.pct(data.solPrice.change24hPct, true)} · 24h` },
      series: data.solPrice.history.map((point) => point.priceUsd)
    }),
    metricCard({
      label: "Stablecoin supply",
      value: fmt.usd(data.stablecoinSupply.totalCirculatingUsd),
      note: `USD-equivalent circulating · ${fmt.date(data.stablecoinSupply.date)}`,
      domain: data.stablecoinSupply,
      tone: "sage",
      series: data.stablecoinSupply.history.map((point) => point.totalCirculatingUsd)
    }),
    metricCard({
      label: "DEX volume",
      value: fmt.usd(data.dexVolume.dailyVolumeUsd),
      note: `Completed UTC day · ${fmt.date(data.dexVolume.date)}`,
      domain: data.dexVolume,
      tone: "network",
      series: data.dexVolume.history.map((point) => point.dailyVolumeUsd)
    }),
    metricCard({
      label: "Real Economic Value",
      value: `${fmt.compact(data.rev.totalSol)} SOL`,
      note: `Fees + gross Jito tips · ${fmt.date(data.rev.date)}`,
      domain: data.rev,
      tone: "neutral",
      series: data.rev.history.map((point) => point.totalSol)
    }),
    metricCard({
      label: "Median transaction fee",
      value: `${fmt.decimal(data.medianTransactionFee.medianLamports)} lamports`,
      note: `${fmt.integer(data.medianTransactionFee.sample.transactionCount)} transactions sampled`,
      domain: data.medianTransactionFee,
      tone: "network-secondary",
      series: data.medianTransactionFee.history.map((point) => point.medianLamports)
    })
  ], "metric-grid-five"));

  const solSpec = historySpec(snapshot, {
    title: "SOL price",
    note: "USD reference price",
    domain: data.solPrice,
    history: data.solPrice.history,
    time: (point) => point.observedAt,
    series: [{ label: "SOL price", field: "priceUsd", color: DATA_COLORS.sol, fill: true }],
    formatter: fmt.usd
  });
  const tvl = data.tvlAlertInput;
  const tvlSpec = historySpec(snapshot, {
    title: "TVL alert evidence",
    note: "DefiLlama Solana TVL · supporting series for the documented daily movement check",
    domain: tvl,
    history: tvl.history,
    time: (point) => `${point.date}T00:00:00.000Z`,
    series: [{ label: "TVL", field: "valueUsd", color: DATA_COLORS.solMuted || DATA_COLORS.warning, fill: true }],
    formatter: fmt.usd
  });
  const stableSpec = historySpec(snapshot, {
    title: "Stablecoin supply",
    note: "USD-equivalent circulating supply",
    domain: data.stablecoinSupply,
    history: data.stablecoinSupply.history,
    time: (point) => `${point.date}T00:00:00.000Z`,
    series: [{ label: "Stablecoin supply", field: "totalCirculatingUsd", color: DATA_COLORS.sage || DATA_COLORS.categorical[4], fill: true }],
    formatter: fmt.usd
  });
  const dexSpec = historySpec(snapshot, {
    title: "DEX volume",
    note: "Direct DEX volume per completed UTC day",
    domain: data.dexVolume,
    history: data.dexVolume.history,
    time: (point) => `${point.date}T00:00:00.000Z`,
    series: [{ label: "DEX volume", field: "dailyVolumeUsd", color: DATA_COLORS.network, fill: true }],
    formatter: fmt.usd
  });
  const revSpec = historySpec(snapshot, {
    title: "Real Economic Value",
    note: "Transaction fees plus gross Jito tips · completed UTC days",
    domain: data.rev,
    history: data.rev.history,
    time: (point) => `${point.date}T00:00:00.000Z`,
    series: [
      { label: "Transaction fees", field: "transactionFeesSol", color: DATA_COLORS.networkSecondary },
      { label: "Gross Jito tips", field: "grossJitoTipsSol", color: DATA_COLORS.sol }
    ],
    formatter: (value) => `${fmt.compact(value)} SOL`,
    beginAtZero: true,
    type: "stackedBar"
  });
  const feeSpec = historySpec(snapshot, {
    title: "Median transaction fee",
    note: "Stratified finalized-block sample",
    domain: data.medianTransactionFee,
    history: data.medianTransactionFee.history,
    time: (point) => point.observedAt,
    series: [{ label: "Median transaction fee", field: "medianLamports", color: DATA_COLORS.networkSecondary, fill: true }],
    formatter: (value) => `${fmt.decimal(value)} lamports`
  });

  const sol = chartPanel(solSpec, { className: "span-7 chart-primary cut-corner" });
  const tvlChart = chartPanel(tvlSpec, {
    className: "span-5",
    meta: [`Current ${fmt.usd(tvl.latest.valueUsd)}`, `${fmt.pct(tvl.change1dPct, true)} day/day`, `Data through ${fmt.date(tvl.latest.date)}`]
  });
  const stable = chartPanel(stableSpec, { className: "span-6" });
  const dex = chartPanel(dexSpec, { className: "span-6" });
  const rev = chartPanel(revSpec, {
    className: "span-8 chart-primary",
    type: "stackedBar",
    meta: [`Total ${fmt.compact(data.rev.totalSol)} SOL`, `Data through ${fmt.date(data.rev.date)}`]
  });
  const fee = chartPanel(feeSpec, { className: "span-4" });

  const rowOne = el("div", "analytics-grid");
  rowOne.append(sol.card, tvlChart.card);
  const rowTwo = el("div", "analytics-grid");
  rowTwo.append(stable.card, dex.card);
  const rowThree = el("div", "analytics-grid");
  rowThree.append(rev.card, fee.card);
  root.append(rowOne, rowTwo, rowThree, evidencePanels(data));
  for (const chart of [sol, tvlChart, stable, dex, rev, fee]) chart.draw();
}
