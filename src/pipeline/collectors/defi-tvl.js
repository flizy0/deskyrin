import { tvlHistorySchema } from "../contracts/providers.js";
import { PipelineError } from "../lib/errors.js";
import { uniqueByKey } from "../lib/history.js";
import { percentageChange } from "../lib/statistics.js";
import { assertFreshObservation, epochSecondsToIso, isCompletedUtcDate, utcDateKey } from "../lib/time.js";

export async function collectTvl(context) {
  const { http, config, now } = context;
  const raw = await http.request(config.endpoints.defiLlamaTvl, {
    sourceId: "defiLlamaTvl", expectedContentTypes: ["application/json"], timeoutMs: config.http.largeTimeoutMs
  });
  const normalized = tvlHistorySchema.parse(raw).map((point) => ({
    date: utcDateKey(epochSecondsToIso(point.date)), valueUsd: point.tvl
  })).filter((point) => isCompletedUtcDate(point.date, now))
    .sort((left, right) => left.date.localeCompare(right.date));
  const history = uniqueByKey(normalized, (point) => point.date, "TVL history").slice(-config.history.dailyPoints);
  if (history.length < 2) throw new PipelineError("INSUFFICIENT_TVL_HISTORY", "TVL needs two completed daily points");
  const latest = history.at(-1);
  const previous = history.at(-2);
  if (new Date(`${latest.date}T00:00:00Z`) - new Date(`${previous.date}T00:00:00Z`) !== 86_400_000) {
    throw new PipelineError("NON_ADJACENT_TVL", "Newest completed TVL dates are not adjacent");
  }
  assertFreshObservation(`${latest.date}T23:59:59.999Z`, now, config.freshness.daily, "TVL date");
  return {
    status: "fresh", observedAt: `${latest.date}T23:59:59.999Z`, sourceIds: ["defiLlamaTvl"], currency: "USD",
    latest, previous, change1dPct: percentageChange(latest.valueUsd, previous.valueUsd), history
  };
}
