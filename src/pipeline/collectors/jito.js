import { jitoDailySchema } from "../contracts/providers.js";
import { PipelineError } from "../lib/errors.js";
import { uniqueByKey } from "../lib/history.js";
import { assertFreshObservation, isCompletedUtcDate } from "../lib/time.js";

export async function collectJito(context) {
  const { http, config, now } = context;
  const raw = await http.request(config.endpoints.jitoMev, {
    sourceId: "jitoMev", expectedContentTypes: ["application/json"],
    timeoutMs: config.http.largeTimeoutMs, maxBytes: config.http.maxBytes.ordinary
  });
  const rows = jitoDailySchema.parse(raw).map((row) => {
    const date = row.day.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new PipelineError("INVALID_JITO_DATE", "Jito returned an invalid day");
    return { date, grossTipsSol: row.jito_tips + row.validator_tips };
  }).filter((row) => isCompletedUtcDate(row.date, now));
  const unique = uniqueByKey(rows, (row) => row.date, "Jito daily rewards").sort((left, right) => left.date.localeCompare(right.date));
  const latest = unique.at(-1);
  if (!latest || latest.grossTipsSol <= 0) throw new PipelineError("EMPTY_JITO_HISTORY", "Jito has no positive completed daily tip value");
  assertFreshObservation(`${latest.date}T23:59:59.999Z`, now, config.freshness.daily, "Jito tip date");
  return unique;
}
