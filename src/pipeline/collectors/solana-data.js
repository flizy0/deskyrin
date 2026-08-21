import { solanaDataSchema } from "../contracts/providers.js";
import { PipelineError } from "../lib/errors.js";
import { uniqueByKey } from "../lib/history.js";
import { assertFreshObservation, isCompletedUtcDate } from "../lib/time.js";

function latestConsensusDate(rows, metricName, unit, now) {
  const byDate = new Map();
  for (const row of rows) {
    if (row.metricName !== metricName || row.unit !== unit || !isCompletedUtcDate(row.date, now)) continue;
    const providers = byDate.get(row.date) || new Set();
    providers.add(row.providerName);
    byDate.set(row.date, providers);
  }
  return [...byDate.entries()]
    .filter(([, providers]) => providers.has("Allium") && providers.has("Dune"))
    .map(([date]) => date)
    .sort()
    .at(-1);
}

export async function collectSolanaData(context) {
  const { http, config, now } = context;
  const raw = await http.request(config.endpoints.solanaData, {
    sourceId: "solanaData",
    expectedContentTypes: ["application/json"],
    timeoutMs: config.http.largeTimeoutMs,
    maxBytes: config.http.maxBytes.solanaData
  });
  const parsed = solanaDataSchema.parse(raw);
  const rows = uniqueByKey(parsed.rows.filter((row) =>
    (row.metricName === "Fees" && row.unit === "SOL" || row.metricName === "Fee Payers" && row.unit === "Count") &&
    (row.providerName === "Allium" || row.providerName === "Dune")
  ), (row) => `${row.date}|${row.metricName}|${row.unit}|${row.providerName}`, "Solana Data rows");
  if (rows.length === 0) throw new PipelineError("MISSING_SOLANA_DATA_ROWS", "Solana Data contains no required metric rows");
  assertFreshObservation(parsed.generatedAt, now, config.freshness.daily, "Solana Data generation");
  for (const [metricName, unit] of [["Fees", "SOL"], ["Fee Payers", "Count"]]) {
    const latestDate = latestConsensusDate(rows, metricName, unit, now);
    if (!latestDate) throw new PipelineError("MISSING_SOLANA_DATA_CONSENSUS", `${metricName} has no completed two-provider date`);
    assertFreshObservation(`${latestDate}T23:59:59.999Z`, now, config.freshness.daily, `${metricName} date`);
  }
  return { rows, generatedAt: new Date(parsed.generatedAt).toISOString() };
}
