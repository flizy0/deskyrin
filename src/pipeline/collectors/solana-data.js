import { solanaDataSchema } from "../contracts/providers.js";
import { PipelineError } from "../lib/errors.js";
import { uniqueByKey } from "../lib/history.js";
import { assertFreshObservation } from "../lib/time.js";

const RETAINED_METRICS = new Set([
  "Fees|SOL",
  "Fee Payers|Count",
  "SOL Price|USD",
  "DEX Volume|USD"
]);

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
    RETAINED_METRICS.has(`${row.metricName}|${row.unit}`)
  ), (row) => `${row.date}|${row.metricName}|${row.unit}|${row.providerName}`, "Solana Data rows");
  if (rows.length === 0) throw new PipelineError("MISSING_SOLANA_DATA_ROWS", "Solana Data contains no required metric rows");
  assertFreshObservation(parsed.generatedAt, now, config.freshness.daily, "Solana Data generation");
  return { rows, generatedAt: new Date(parsed.generatedAt).toISOString() };
}
