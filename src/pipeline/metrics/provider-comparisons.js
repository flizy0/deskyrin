import { uniqueByKey } from "../lib/history.js";
import { isCompletedUtcDate, isoTimestamp } from "../lib/time.js";

const ALLOWED_PROVIDERS = Object.freeze([
  "Allium",
  "Dune",
  "DeFiLlama",
  "Artemis",
  "Birdeye",
  "Blockworks",
  "DexPaprika",
  "Solscan",
  "Token Terminal"
]);

const METRICS = Object.freeze([
  Object.freeze({
    id: "sol-price",
    name: "SOL Price",
    unit: "USD",
    description: "Daily SOL price in USD as reported by each provider."
  }),
  Object.freeze({
    id: "fees",
    name: "Fees",
    unit: "SOL",
    description: "Daily Solana transaction fees in native SOL as reported by each provider."
  }),
  Object.freeze({
    id: "fee-payers",
    name: "Fee Payers",
    unit: "Count",
    description: "Daily provider-reported fee-payer or active-address proxy; provider methodologies may differ."
  }),
  Object.freeze({
    id: "dex-volume",
    name: "DEX Volume",
    unit: "USD",
    description: "Daily Solana DEX volume in USD; indexed venues and filtering methodologies may differ by provider."
  })
]);

const PROVIDER_SET = new Set(ALLOWED_PROVIDERS);
const METRIC_BY_KEY = new Map(METRICS.map((metric) => [`${metric.name}|${metric.unit}`, metric]));

function comparisonRows(rows, now) {
  return uniqueByKey(rows.filter((row) =>
    PROVIDER_SET.has(row.providerName) &&
    METRIC_BY_KEY.has(`${row.metricName}|${row.unit}`) &&
    isCompletedUtcDate(row.date, now)
  ), (row) => `${row.date}|${row.metricName}|${row.unit}|${row.providerName}`, "Provider comparison rows");
}

export function calculateProviderComparisons(rows, generatedAt, now, config) {
  const retainedPoints = config.history.dailyPoints;
  const normalizedRows = comparisonRows(rows, now);

  const metrics = METRICS.map((metric) => {
    const series = ALLOWED_PROVIDERS.flatMap((providerName) => {
      const history = normalizedRows
        .filter((row) =>
          row.metricName === metric.name &&
          row.unit === metric.unit &&
          row.providerName === providerName
        )
        .map((row) => ({ date: row.date, value: row.value }))
        .sort((left, right) => left.date < right.date ? -1 : left.date > right.date ? 1 : 0)
        .slice(-retainedPoints);

      if (history.length === 0) return [];
      return [{
        providerName,
        dataThrough: history.at(-1).date,
        history
      }];
    });

    return {
      id: metric.id,
      name: metric.name,
      unit: metric.unit,
      description: metric.description,
      series
    };
  });

  return {
    status: "fresh",
    observedAt: isoTimestamp(generatedAt, "Solana Data generation"),
    sourceIds: ["solanaData"],
    metrics
  };
}
