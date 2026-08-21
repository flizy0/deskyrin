import { stablecoinHistorySchema } from "../contracts/providers.js";
import { PipelineError } from "../lib/errors.js";
import { uniqueByKey } from "../lib/history.js";
import { assertFreshObservation, epochSecondsToIso, isCompletedUtcDate, utcDateKey } from "../lib/time.js";

function sumPegValues(value) {
  return Object.values(value).reduce((sum, item) => sum + item, 0);
}

export async function collectStablecoins(context) {
  const { http, config, now } = context;
  const raw = await http.request(config.endpoints.defiLlamaStablecoins, {
    sourceId: "defiLlamaStablecoins", expectedContentTypes: ["application/json"], timeoutMs: config.http.largeTimeoutMs
  });
  const normalized = stablecoinHistorySchema.parse(raw).map((point) => ({
    date: utcDateKey(epochSecondsToIso(Number(point.date))),
    totalCirculatingUsd: sumPegValues(point.totalCirculatingUSD)
  })).filter((point) => isCompletedUtcDate(point.date, now))
    .sort((left, right) => left.date.localeCompare(right.date));
  const history = uniqueByKey(normalized, (point) => point.date, "Stablecoin history").slice(-config.history.dailyPoints);
  if (history.length < 2 || history.at(-1).totalCirculatingUsd <= 0) throw new PipelineError("INVALID_STABLECOIN_HISTORY", "Stablecoin history is incomplete or empty");
  const latest = history.at(-1);
  assertFreshObservation(`${latest.date}T23:59:59.999Z`, now, config.freshness.daily, "stablecoin date");
  return {
    status: "fresh", observedAt: `${latest.date}T23:59:59.999Z`, sourceIds: ["defiLlamaStablecoins"],
    currency: "USD", date: latest.date, totalCirculatingUsd: latest.totalCirculatingUsd, history
  };
}
