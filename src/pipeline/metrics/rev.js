import { PipelineError } from "../lib/errors.js";
import { median } from "../lib/statistics.js";
import { isCompletedUtcDate } from "../lib/time.js";
import { assertFreshObservation } from "../lib/time.js";

function providerRows(rows, metricName, unit, now) {
  const allowed = new Set(["Allium", "Dune"]);
  const byDate = new Map();
  for (const row of rows) {
    if (row.metricName !== metricName || row.unit !== unit || !allowed.has(row.providerName)) continue;
    if (!isCompletedUtcDate(row.date, now)) continue;
    const date = byDate.get(row.date) || new Map();
    if (date.has(row.providerName) && date.get(row.providerName) !== row.value) {
      throw new PipelineError("CONFLICTING_PROVIDER_DUPLICATE", `${metricName} has conflicting ${row.providerName} rows for ${row.date}`);
    }
    date.set(row.providerName, row.value);
    byDate.set(row.date, date);
  }
  return [...byDate.entries()]
    .filter(([, providers]) => providers.size === 2)
    .map(([date, providers]) => ({
      date,
      allium: providers.get("Allium"),
      dune: providers.get("Dune"),
      value: median([providers.get("Allium"), providers.get("Dune")])
    }))
    .sort((left, right) => left.date.localeCompare(right.date));
}

export function calculateFeeConsensus(rows, now) {
  const result = providerRows(rows, "Fees", "SOL", now);
  if (result.length === 0) throw new PipelineError("MISSING_FEE_CONSENSUS", "No completed date has both required fee providers");
  return result;
}

export function calculateActiveAddressConsensus(rows, now) {
  const result = providerRows(rows, "Fee Payers", "Count", now).map((row) => {
    if (!Number.isInteger(row.allium) || !Number.isInteger(row.dune)) {
      throw new PipelineError("NON_INTEGER_ADDRESS_COUNT", "Fee-payer provider counts must be integers");
    }
    return row;
  });
  if (result.length === 0) throw new PipelineError("MISSING_ADDRESS_CONSENSUS", "No completed date has both required fee-payer providers");
  return result;
}

export function calculateRev(feeRows, jitoRows, now, config) {
  const feeSeries = calculateFeeConsensus(feeRows, now);
  const tips = new Map(jitoRows
    .filter((row) => isCompletedUtcDate(row.date, now))
    .map((row) => [row.date, row.grossTipsSol]));
  const joined = feeSeries.filter((row) => tips.has(row.date)).map((row) => ({
    date: row.date,
    totalSol: row.value + tips.get(row.date),
    transactionFeesSol: row.value,
    grossJitoTipsSol: tips.get(row.date),
    feeProviderCount: 2,
    feeProviderMinSol: Math.min(row.allium, row.dune),
    feeProviderMaxSol: Math.max(row.allium, row.dune),
    allium: row.allium,
    dune: row.dune
  })).sort((left, right) => left.date.localeCompare(right.date));
  if (joined.length === 0) throw new PipelineError("MISSING_REV_JOIN", "Fees and Jito tips have no completed common date");
  const history = joined.slice(-config.history.dailyPoints).map((row) => ({
    date: row.date,
    totalSol: row.totalSol,
    transactionFeesSol: row.transactionFeesSol,
    grossJitoTipsSol: row.grossJitoTipsSol,
    feeProviderCount: row.feeProviderCount,
    feeProviderMinSol: row.feeProviderMinSol,
    feeProviderMaxSol: row.feeProviderMaxSol
  }));
  const latest = joined.at(-1);
  if (latest.transactionFeesSol <= 0 || latest.grossJitoTipsSol <= 0 || latest.totalSol <= 0) {
    throw new PipelineError("EMPTY_REV_VALUE", "Latest completed REV components must be positive");
  }
  assertFreshObservation(`${latest.date}T23:59:59.999Z`, now, config.freshness.daily, "REV date");
  return {
    status: "fresh",
    observedAt: `${latest.date}T23:59:59.999Z`,
    sourceIds: ["solanaData", "jitoMev"],
    unit: "SOL",
    date: latest.date,
    totalSol: latest.totalSol,
    components: {
      transactionFeesSol: latest.transactionFeesSol,
      grossJitoTipsSol: latest.grossJitoTipsSol
    },
    feeConsensus: {
      method: "median",
      providers: [{ name: "Allium", valueSol: latest.allium }, { name: "Dune", valueSol: latest.dune }],
      minSol: latest.feeProviderMinSol,
      maxSol: latest.feeProviderMaxSol
    },
    history
  };
}

export function calculateActiveAddresses(rows, now, config) {
  const series = calculateActiveAddressConsensus(rows, now);
  const latest = series.at(-1);
  assertFreshObservation(`${latest.date}T23:59:59.999Z`, now, config.freshness.daily, "active-address date");
  return {
    status: "fresh",
    observedAt: `${latest.date}T23:59:59.999Z`,
    sourceIds: ["solanaData"],
    date: latest.date,
    value: latest.value,
    consensusMethod: "median",
    providers: [{ name: "Allium", value: latest.allium }, { name: "Dune", value: latest.dune }],
    history: series.slice(-config.history.dailyPoints).map((row) => ({
      date: row.date,
      value: row.value,
      allium: row.allium,
      dune: row.dune
    }))
  };
}
