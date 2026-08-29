import { z } from "zod";
import { PipelineError } from "../lib/errors.js";
import { uniqueByKey } from "../lib/history.js";
import { assertFreshObservation, isCompletedUtcDate, isoTimestamp, utcDateKey } from "../lib/time.js";

const DAY_MS = 86_400_000;
const DAY_SECONDS = 86_400;
const MAX_CANDLES = 300;

const finite = z.number().refine(Number.isFinite, "Expected a finite number");
const positive = finite.positive();
const nonNegative = finite.min(0);

const coinbaseCandleSchema = z.tuple([
  z.number().int().safe().min(0),
  positive,
  positive,
  positive,
  positive,
  nonNegative
]).superRefine(([timestamp, low, high, open, close], context) => {
  if (timestamp % DAY_SECONDS !== 0) {
    context.addIssue({ code: "custom", message: "Daily candle timestamp must be aligned to 00:00 UTC", path: [0] });
  }
  if (low > high) {
    context.addIssue({ code: "custom", message: "Candle low must not exceed high", path: [1] });
  }
  if (open < low || open > high) {
    context.addIssue({ code: "custom", message: "Candle open must be within the low/high range", path: [3] });
  }
  if (close < low || close > high) {
    context.addIssue({ code: "custom", message: "Candle close must be within the low/high range", path: [4] });
  }
});

const coinbaseCandlesSchema = z.array(coinbaseCandleSchema).min(1).max(MAX_CANDLES);

function historyLimit(config) {
  const value = config.history?.dailyPoints ?? 90;
  if (!Number.isInteger(value) || value < 2) {
    throw new PipelineError("INVALID_COINBASE_HISTORY_LIMIT", "Coinbase history limit must be an integer of at least two days");
  }
  return Math.min(value, MAX_CANDLES);
}

function requestUrl(endpoint, now, limit) {
  const url = new URL(endpoint);
  if (!url.pathname.endsWith("/products/SOL-USD/candles")) {
    throw new PipelineError("INVALID_COINBASE_PRODUCT", "Coinbase market endpoint must target SOL-USD candles");
  }
  const endMs = Date.parse(`${utcDateKey(now)}T00:00:00.000Z`);
  url.searchParams.set("granularity", String(DAY_SECONDS));
  url.searchParams.set("start", new Date(endMs - limit * DAY_MS).toISOString());
  url.searchParams.set("end", new Date(endMs).toISOString());
  return url.toString();
}

export async function collectCoinbaseMarket(context) {
  const { http, config, now } = context;
  const limit = historyLimit(config);
  const raw = await http.request(requestUrl(config.endpoints.coinbaseMarket, now, limit), {
    sourceId: "coinbaseExchange",
    expectedContentTypes: ["application/json"],
    timeoutMs: config.http.ordinaryTimeoutMs,
    maxBytes: config.http.maxBytes.ordinary
  });
  const normalized = coinbaseCandlesSchema.parse(raw).map(([timestamp, low, high, open, close, volume]) => {
    const date = isoTimestamp(timestamp * 1_000, "Coinbase candle timestamp").slice(0, 10);
    return { date, openUsd: open, highUsd: high, lowUsd: low, closeUsd: close, volumeSol: volume };
  }).filter((point) => isCompletedUtcDate(point.date, now));
  const history = uniqueByKey(normalized, (point) => point.date, "Coinbase daily candles")
    .sort((left, right) => left.date.localeCompare(right.date))
    .slice(-limit);
  if (history.length < 2) {
    throw new PipelineError("EMPTY_COINBASE_HISTORY", "Coinbase has fewer than two completed SOL-USD daily candles");
  }
  const latest = history.at(-1);
  assertFreshObservation(`${latest.date}T23:59:59.999Z`, now, config.freshness.daily, "Coinbase SOL-USD candle date");
  return {
    sourceId: "coinbaseExchange",
    observedAt: isoTimestamp(now),
    dataThrough: latest.date,
    productId: "SOL-USD",
    granularitySeconds: DAY_SECONDS,
    history
  };
}
