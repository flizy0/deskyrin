import { DATA_COLORS } from "../charts.js";
import { fmt } from "../format.js";
import { providerComparisonPanel } from "../provider-selector.js";
import { appendTableRow, createTable } from "../table.js";
import { el, emptyStatePanel, safeLink } from "../ui.js";
import {
  chartPanel,
  historySpec,
  metricCard,
  metricGrid,
  pageHeader,
  panel
} from "../view-utils.js";

export const MIN_TOKENIZED_HISTORY_POINTS = 8;

const TOKENIZED_CATEGORY_META = {
  equities: { label: "Equities", className: "equities" },
  funds: { label: "ETFs", className: "funds" },
  commodities: { label: "Commodities", className: "commodities" },
  "other-rwa": { label: "Other RWA", className: "other-rwa" }
};

function tokenizedHistoryReady(assets) {
  return Array.isArray(assets.history) && assets.history.length >= MIN_TOKENIZED_HISTORY_POINTS;
}

function percentOf(value, total) {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) return 0;
  return (value / total) * 100;
}

function categoryMeta(id) {
  return TOKENIZED_CATEGORY_META[id] || {
    label: String(id).replaceAll("-", " "),
    className: "other-rwa"
  };
}

function metricsSourceLabel(source) {
  if (source === "birdeye") return "Birdeye";
  if (source === "clickhouse_trades") return "On-chain trades";
  return String(source).replaceAll("_", " ");
}

function tokenizedSnapshotPanel(assets) {
  const card = panel({
    title: "Tokenized market snapshot",
    note: `Current trailing ${assets.windowDays}-day spot activity from assets with accepted provenance.`,
    className: "span-5 tokenized-snapshot-panel cut-corner",
    domain: assets
  });

  const coverage = percentOf(assets.coveredAssetCount, assets.indexedAssetCount);
  const summary = el("div", "tokenized-summary");
  const volume = el("div", "tokenized-summary-item");
  volume.append(
    el("span", "tokenized-summary-label", `${assets.windowDays}D spot volume`),
    el("strong", "tokenized-summary-value", fmt.usd(assets.totalSpotVolume30dUsd))
  );
  const coverageItem = el("div", "tokenized-summary-item");
  coverageItem.append(
    el("span", "tokenized-summary-label", "Provenance coverage"),
    el("strong", "tokenized-summary-value", fmt.pct(coverage)),
    el("span", "tokenized-summary-meta", `${fmt.integer(assets.coveredAssetCount)} of ${fmt.integer(assets.indexedAssetCount)} indexed assets`)
  );
  summary.append(volume, coverageItem);
  card.append(summary);

  const breakdown = el("div", "tokenized-breakdown-list");
  for (const category of assets.categoryBreakdown) {
    const meta = categoryMeta(category.id);
    const share = percentOf(category.spotVolume30dUsd, assets.totalSpotVolume30dUsd);
    const row = el("div", `tokenized-breakdown-row category-${meta.className}`);
    const head = el("div", "tokenized-breakdown-head");
    const label = el("span", "tokenized-category-label", meta.label);
    label.prepend(el("span", "tokenized-category-marker"));
    head.append(label, el("strong", "tokenized-category-value", fmt.usd(category.spotVolume30dUsd)));
    const detail = el("div", "tokenized-breakdown-detail");
    detail.append(
      el("span", undefined, `${fmt.integer(category.coveredAssetCount)}/${fmt.integer(category.indexedAssetCount)} assets`),
      el("span", undefined, fmt.pct(share))
    );
    const track = el("div", "tokenized-breakdown-track");
    const fill = el("span", "tokenized-breakdown-fill");
    fill.style.width = `${Math.min(100, Math.max(0, share))}%`;
    track.append(fill);
    row.append(head, detail, track);
    breakdown.append(row);
  }
  card.append(breakdown);

  const excludedCount = Object.values(assets.provenanceCoverage).reduce((total, value) => total + value, 0);
  const provenance = el("div", "tokenized-provenance-note");
  provenance.append(
    el("span", undefined, `Accepted · ${assets.acceptedMetricsSources.map(metricsSourceLabel).join(" + ")}`),
    el("span", undefined, `${fmt.integer(excludedCount)} assets excluded by provenance checks`)
  );
  card.append(provenance);

  if (!tokenizedHistoryReady(assets)) {
    const count = assets.history?.length || 0;
    card.append(el(
      "p",
      "tokenized-history-state",
      `History collecting · ${Math.min(count, MIN_TOKENIZED_HISTORY_POINTS)}/${MIN_TOKENIZED_HISTORY_POINTS} genuine observations`
    ));
  }
  return card;
}

function tokenizedAssetsPanel(assets) {
  const card = panel({
    title: "Most active tokenized assets",
    note: `Top assets by accepted trailing ${assets.windowDays}-day spot volume.`,
    className: "span-7 tokenized-assets-panel",
    domain: assets
  });
  if (!assets.topAssets.length) {
    card.append(emptyStatePanel("No asset-level spot-volume observations passed provenance checks.", { title: "No covered assets" }));
    return card;
  }

  const columns = [
    { label: "#", key: "rank", align: "right", width: "38px" },
    { label: "Asset", key: "asset" },
    { label: "Category", key: "category", width: "94px" },
    { label: "30D volume", key: "volume", align: "right", width: "112px" },
    { label: "Share", key: "share", align: "right", width: "68px" }
  ];
  const table = createTable(columns, "Most active tokenized assets by trailing 30-day spot volume");
  for (const asset of assets.topAssets) {
    const identity = el("div", "tokenized-asset-identity");
    const name = el("div", "tokenized-asset-name");
    name.append(
      el("strong", "tokenized-asset-symbol", asset.symbol),
      el("span", undefined, asset.name)
    );
    identity.append(name, el("span", "tokenized-asset-source", metricsSourceLabel(asset.metricsSource)));
    const category = categoryMeta(asset.categoryGroup);
    const categoryLabel = el("span", `tokenized-table-category category-${category.className}`, category.label);
    categoryLabel.prepend(el("span", "tokenized-category-marker"));
    appendTableRow(table.body, columns, [
      asset.rank,
      identity,
      categoryLabel,
      fmt.usd(asset.spotVolume30dUsd),
      fmt.pct(percentOf(asset.spotVolume30dUsd, assets.totalSpotVolume30dUsd))
    ]);
  }
  card.append(table.wrap);
  return card;
}

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
  const showTokenizedHistory = tokenizedHistoryReady(assets);
  root.append(pageHeader({
    eyebrow: "Adoption and protocol development",
    title: "Ecosystem",
    copy: "Address activity, tokenized-market trading, and official protocol developments from the canonical snapshot.",
    meta: [
      `Address data through ${fmt.date(addresses.date)}`,
      `Tokenized market observed ${fmt.utc(assets.observedAt)}`,
      `Official feed observed ${fmt.utc(data.news.observedAt)}`
    ]
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
      series: showTokenizedHistory ? assets.history.map((point) => point.totalSpotVolume30dUsd) : undefined
    }),
    metricCard({
      label: "Tokenized-equity spot volume",
      value: fmt.usd(assets.equitySpotVolume30dUsd),
      note: `${assets.windowDays}d · ${assets.coveredEquityCount}/${assets.indexedEquityCount} equities covered`,
      domain: assets,
      tone: "sage",
      series: showTokenizedHistory ? assets.history.map((point) => point.equitySpotVolume30dUsd) : undefined
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
  const assetSpec = showTokenizedHistory ? historySpec(snapshot, {
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
  }) : null;

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
  const tokenizedGrid = el("div", "analytics-grid tokenized-market-grid");
  tokenizedGrid.append(tokenizedSnapshotPanel(assets), tokenizedAssetsPanel(assets));
  const assetsChart = showTokenizedHistory ? chartPanel(assetSpec, {
    className: "chart-wide",
    meta: [
      `${assets.history.length} retained observations`,
      `${assets.coveredAssetCount}/${assets.indexedAssetCount} indexed assets with accepted volume provenance`
    ]
  }) : null;
  root.append(
    tokenizedGrid,
    ...(assetsChart ? [assetsChart.card] : []),
    addressGrid,
    upgradesPanel(data.upgrades),
    newsPanel(data.news)
  );
  addressesChart.draw();
  assetsChart?.draw();
}
