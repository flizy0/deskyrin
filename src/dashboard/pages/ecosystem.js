import { DATA_COLORS } from "../charts.js";
import { fmt } from "../format.js";
import { providerComparisonPanel } from "../provider-selector.js";
import { el, emptyStatePanel, safeLink } from "../ui.js";
import {
  chartPanel,
  historySpec,
  metricCard,
  metricGrid,
  pageHeader,
  panel
} from "../view-utils.js";

function providerEvidence(data) {
  const card = panel({
    title: "Address consensus",
    note: `${data.consensusMethod} of provider observations for the latest completed UTC day.`,
    className: "span-4 provider-evidence-panel",
    domain: data
  });
  const list = el("dl", "technical-list");
  for (const provider of data.providers) {
    const row = el("div");
    row.append(el("dt", undefined, provider.name), el("dd", undefined, fmt.integer(provider.value)));
    list.append(row);
  }
  const result = el("div", "consensus-result");
  result.append(el("span", undefined, "Published median"), el("strong", undefined, fmt.integer(data.value)));
  card.append(list, result);
  return card;
}

function upgradeCard(upgrade) {
  const card = el("article", "upgrade-card");
  const head = el("div", "upgrade-head");
  const copy = el("div", "upgrade-heading");
  copy.append(safeLink(upgrade.title, upgrade.url, "upgrade-title"));
  if (upgrade.subtitle) copy.append(el("p", "upgrade-subtitle", upgrade.subtitle));
  const stage = el("span", "upgrade-stage", upgrade.stageLabel);
  head.append(copy, stage);
  card.append(head);

  if (upgrade.metrics?.length) {
    const metrics = el("div", "upgrade-metrics");
    for (const metric of upgrade.metrics) {
      const item = el("div", "upgrade-metric");
      item.append(el("strong", undefined, metric.value), el("span", undefined, metric.label));
      metrics.append(item);
    }
    card.append(metrics);
  }

  const footer = el("div", "upgrade-footer");
  if (upgrade.releaseLabel) footer.append(el("span", "upgrade-release", upgrade.releaseLabel));
  if (upgrade.simds?.length) {
    const simds = el("div", "simd-links");
    for (const simd of upgrade.simds) simds.append(safeLink(simd.title, simd.url, "simd-link"));
    footer.append(simds);
  }
  if (footer.childElementCount) card.append(footer);
  return card;
}

function upgradesPanel(data) {
  const card = panel({
    title: "Upcoming protocol work",
    note: "Officially listed Solana upgrades and linked improvement documents.",
    className: "upgrades-panel cut-corner",
    domain: data
  });
  if (!data.items.length) {
    card.append(emptyStatePanel("No official upcoming upgrades are present in this snapshot.", { title: "No upgrade records" }));
    return card;
  }
  const grid = el("div", "upgrade-grid");
  for (const upgrade of data.items) grid.append(upgradeCard(upgrade));
  card.append(grid);
  return card;
}

function newsPanel(data) {
  const card = panel({
    title: "Official ecosystem updates",
    note: "Latest records from the official Solana news feed.",
    className: "news-panel",
    domain: data
  });
  if (!data.items.length) {
    card.append(emptyStatePanel("The official feed contains no items in this snapshot.", { title: "No feed items" }));
    return card;
  }
  const list = el("div", "news-list");
  for (const item of data.items) {
    const article = el("article", "news-item");
    const time = document.createElement("time");
    time.dateTime = item.publishedAt;
    time.textContent = fmt.date(item.publishedAt);
    article.append(time, safeLink(item.title, item.url, "news-title"));
    if (item.description) article.append(el("p", "news-description", item.description));
    list.append(article);
  }
  card.append(list);
  return card;
}

export function renderEcosystem(snapshot, root) {
  const data = snapshot.ecosystem;
  const addresses = data.dailyActiveAddresses;
  const assets = data.tokenizedAssets;
  root.append(pageHeader({
    eyebrow: "Adoption and protocol development",
    title: "Ecosystem",
    copy: "Address activity, tokenized-market trading, and official protocol developments from the canonical snapshot.",
    meta: [`Address data through ${fmt.date(addresses.date)}`, `Official feed observed ${fmt.utc(data.news.observedAt)}`]
  }));

  root.append(metricGrid([
    metricCard({
      label: "Daily active addresses",
      value: fmt.integer(addresses.value),
      note: `Initiating signers · ${fmt.date(addresses.date)}`,
      domain: addresses,
      tone: "sage",
      series: addresses.history.map((point) => point.value)
    }),
    metricCard({
      label: "Tokenized-market spot volume",
      value: fmt.usd(assets.totalSpotVolume30dUsd),
      note: `${assets.windowDays}d · ${assets.coveredAssetCount}/${assets.indexedAssetCount} assets covered`,
      domain: assets,
      tone: "network",
      series: assets.history.map((point) => point.totalSpotVolume30dUsd)
    }),
    metricCard({
      label: "Tokenized-equity spot volume",
      value: fmt.usd(assets.equitySpotVolume30dUsd),
      note: `${assets.windowDays}d · ${assets.coveredEquityCount}/${assets.indexedEquityCount} equities covered`,
      domain: assets,
      tone: "sage",
      series: assets.history.map((point) => point.equitySpotVolume30dUsd)
    }),
    metricCard({
      label: "Upcoming upgrades",
      value: fmt.integer(data.upgrades.items.length),
      note: "Official upgrade-hub records",
      domain: data.upgrades,
      tone: "neutral"
    }),
    metricCard({
      label: "Official updates",
      value: fmt.integer(data.news.items.length),
      note: "Current bounded RSS snapshot",
      domain: data.news,
      tone: "neutral"
    })
  ], "metric-grid-five"));

  const addressSpec = historySpec(snapshot, {
    title: "Daily active addresses",
    note: "Visible Allium and Dune initiating-signer evidence",
    domain: addresses,
    history: addresses.history,
    time: (point) => `${point.date}T00:00:00.000Z`,
    series: [
      { label: "Allium", field: "allium", color: DATA_COLORS.networkSecondary },
      { label: "Dune", field: "dune", color: DATA_COLORS.categorical[5] }
    ],
    formatter: fmt.integer,
    beginAtZero: true
  });
  const assetSpec = historySpec(snapshot, {
    title: "Tokenized-market spot volume",
    note: `Tokens.xyz ${assets.windowDays}-day spot activity; only Birdeye and on-chain trade provenance is included`,
    domain: assets,
    history: assets.history,
    time: (point) => point.observedAt,
    series: [
      { label: "Covered tokenized assets", field: "totalSpotVolume30dUsd", color: DATA_COLORS.network, fill: true },
      { label: "Covered tokenized equities", field: "equitySpotVolume30dUsd", color: DATA_COLORS.categorical[5] }
    ],
    formatter: fmt.usd,
    beginAtZero: true
  });

  const addressesChart = providerComparisonPanel(snapshot, "fee-payers", {
    title: "Daily active addresses · provider comparison",
    note: "Provider-reported fee-payer proxies can differ; each line retains its source methodology.",
    formatter: fmt.integer,
    beginAtZero: true,
    className: "span-8 chart-primary cut-corner",
    meta: [`${addresses.history.length} canonical days`, "Provider methodologies may differ"]
  }) || chartPanel(addressSpec, {
    className: "span-8 chart-primary cut-corner",
    meta: [`${addresses.history.length} completed UTC days`, `Consensus: ${addresses.consensusMethod}`]
  });
  const addressGrid = el("div", "analytics-grid");
  addressGrid.append(addressesChart.card, providerEvidence(addresses));
  const assetsChart = chartPanel(assetSpec, {
    className: "chart-wide",
    meta: [
      `${assets.history.length} retained observations`,
      `${assets.coveredAssetCount}/${assets.indexedAssetCount} indexed assets with accepted volume provenance`
    ]
  });
  const legacy = assets.legacyTransferVolume;
  const legacySpec = legacy ? historySpec(snapshot, {
    title: "Retired RWA.xyz transfer-volume evidence",
    note: `Historical ${legacy.windowDays}-day transfer volume retained without joining it to Tokens.xyz spot volume`,
    domain: { observedAt: legacy.endedAt },
    history: legacy.history,
    time: (point) => point.observedAt,
    series: [
      { label: "All tokenized assets", field: "totalTransferVolumeUsd", color: DATA_COLORS.network, fill: true },
      { label: "Tokenized equities", field: "equityTransferVolumeUsd", color: DATA_COLORS.categorical[5] }
    ],
    formatter: fmt.usd,
    beginAtZero: true
  }) : null;
  const legacyChart = legacy ? chartPanel(legacySpec, {
    className: "chart-wide",
    meta: [`Ended ${fmt.utc(legacy.endedAt)}`, "Different methodology · intentionally separate"]
  }) : null;
  root.append(
    addressGrid,
    assetsChart.card,
    ...(legacyChart ? [legacyChart.card] : []),
    upgradesPanel(data.upgrades),
    newsPanel(data.news)
  );
  addressesChart.draw();
  assetsChart.draw();
  legacyChart?.draw();
}
