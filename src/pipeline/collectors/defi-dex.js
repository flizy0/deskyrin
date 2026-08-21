import { dexOverviewSchema } from "../contracts/providers.js";
import { PipelineError } from "../lib/errors.js";
import { uniqueByKey } from "../lib/history.js";
import { assertFreshObservation, epochSecondsToIso, isCompletedUtcDate, utcDateKey } from "../lib/time.js";

export async function collectDexVolume(context) {
  const { http, config, now } = context;
  const raw = await http.request(config.endpoints.defiLlamaDex, {
    sourceId: "defiLlamaDex", expectedContentTypes: ["application/json"], timeoutMs: config.http.largeTimeoutMs
  });
  const parsed = dexOverviewSchema.parse(raw);
  const normalized = parsed.totalDataChart.map(([timestamp, dailyVolumeUsd]) => ({
    date: utcDateKey(epochSecondsToIso(timestamp)), dailyVolumeUsd
  })).filter((point) => isCompletedUtcDate(point.date, now))
    .sort((left, right) => left.date.localeCompare(right.date));
  const history = uniqueByKey(normalized, (point) => point.date, "DEX history").slice(-config.history.dailyPoints);
  if (history.length < 2) throw new PipelineError("INSUFFICIENT_DEX_HISTORY", "DEX history needs two completed days");
  const latest = history.at(-1);
  if (latest.dailyVolumeUsd <= 0) throw new PipelineError("EMPTY_DEX_VOLUME", "Latest completed DEX volume must be positive");
  assertFreshObservation(`${latest.date}T23:59:59.999Z`, now, config.freshness.daily, "DEX-volume date");
  return {
    status: "fresh", observedAt: `${latest.date}T23:59:59.999Z`, sourceIds: ["defiLlamaDex"],
    currency: "USD", date: latest.date, dailyVolumeUsd: latest.dailyVolumeUsd, history
  };
}
