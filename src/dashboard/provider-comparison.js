const DAY_MS = 86_400_000;

export const PROVIDER_COLORS = Object.freeze({
  Allium: "#c58ab9",
  Artemis: "#49bfae",
  Birdeye: "#d0a03a",
  Blockworks: "#a876a2",
  DeFiLlama: "#5f8fc5",
  DexPaprika: "#c77a4e",
  Dune: "#c8766f",
  Solscan: "#b38a4d",
  "Token Terminal": "#7f9d86",
  Coinbase: "#6d91c7",
  CoinGecko: "#9bab62"
});

export const PROVIDER_ORDER = Object.freeze([
  "Allium",
  "Artemis",
  "Birdeye",
  "Blockworks",
  "DeFiLlama",
  "DexPaprika",
  "Dune",
  "Solscan",
  "Token Terminal",
  "Coinbase",
  "CoinGecko"
]);

const PROVIDER_RANK = new Map(PROVIDER_ORDER.map((name, index) => [name, index]));

function utcDay(value) {
  return Date.parse(`${value}T00:00:00.000Z`);
}

function completeDateRange(dates) {
  if (dates.length === 0) return [];
  const first = Math.min(...dates.map(utcDay));
  const last = Math.max(...dates.map(utcDay));
  const result = [];
  for (let time = first; time <= last; time += DAY_MS) result.push(new Date(time).toISOString().slice(0, 10));
  return result;
}

function alignedDataset(dates, history, options) {
  const values = new Map(history.map((point) => [point.date, point.value]));
  return {
    label: options.label,
    data: dates.map((date) => values.has(date) ? values.get(date) : null),
    color: options.color || PROVIDER_COLORS[options.providerName],
    fill: options.fill === true,
    spanGaps: false,
    borderWidth: options.borderWidth ?? (options.providerName ? 1.6 : 2.2),
    ...(options.providerName ? { providerName: options.providerName } : {}),
    ...(options.dataThrough ? { dataThrough: options.dataThrough } : {}),
    ...(options.hidden ? { hidden: true } : {})
  };
}

function orderedSeries(series) {
  return [...series].sort((left, right) => {
    const leftRank = PROVIDER_RANK.get(left.providerName) ?? Number.MAX_SAFE_INTEGER;
    const rightRank = PROVIDER_RANK.get(right.providerName) ?? Number.MAX_SAFE_INTEGER;
    return leftRank - rightRank || left.providerName.localeCompare(right.providerName);
  });
}

export function findProviderMetric(snapshot, metricId) {
  return snapshot?.providerComparisons?.metrics?.find((metric) => metric.id === metricId) || null;
}

export function buildProviderComparisonSpec(snapshot, metricId, options = {}) {
  const domain = snapshot?.providerComparisons;
  const metric = findProviderMetric(snapshot, metricId);
  if (!domain || !metric || metric.series.length === 0) return null;

  const references = options.references || [];
  const allDates = [
    ...metric.series.flatMap((series) => series.history.map((point) => point.date)),
    ...references.flatMap((series) => series.history.map((point) => point.date))
  ];
  const dates = completeDateRange(allDates);
  if (dates.length === 0) return null;

  const selectedProviders = options.selectedProviders ? new Set(options.selectedProviders) : null;
  const pinnedReferences = references.filter((series) => !series.providerName);
  const selectableSeries = orderedSeries([
    ...references.filter((series) => series.providerName),
    ...metric.series
  ]);
  const datasets = [
    ...pinnedReferences.map((series) => alignedDataset(dates, series.history, {
      label: series.label,
      color: series.color,
      fill: series.fill,
      borderWidth: series.borderWidth
    })),
    ...selectableSeries.map((series) => alignedDataset(dates, series.history, {
      label: series.label || series.providerName,
      providerName: series.providerName,
      color: series.color || PROVIDER_COLORS[series.providerName],
      fill: series.fill,
      borderWidth: series.borderWidth,
      dataThrough: series.dataThrough,
      hidden: selectedProviders ? !selectedProviders.has(series.providerName) : false
    }))
  ];

  return {
    title: options.title || `${metric.name} · provider comparison`,
    note: options.note || metric.description,
    labels: dates.map((date) => `${date}T00:00:00.000Z`),
    datasets,
    yFormatter: options.formatter,
    beginAtZero: options.beginAtZero === true,
    type: "line",
    legend: false,
    observedAt: domain.observedAt,
    updatedAt: snapshot.updatedAt,
    providerSeries: datasets.flatMap((series) => series.providerName ? [{
      providerName: series.providerName,
      dataThrough: series.dataThrough
    }] : [])
  };
}
