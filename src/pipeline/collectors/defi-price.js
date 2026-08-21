import {
  coinGeckoChartSchema,
  coinGeckoPriceSchema,
  defiLlamaCurrentPriceSchema,
  defiLlamaPriceChartSchema
} from "../contracts/providers.js";
import { PipelineError } from "../lib/errors.js";
import { safeError } from "../lib/errors.js";
import { normalizeHistory } from "../lib/history.js";
import { percentageChange } from "../lib/statistics.js";
import { assertFreshObservation, epochSecondsToIso, isoTimestamp } from "../lib/time.js";

function boundedHistory(points, current, config) {
  return normalizeHistory([...points, current], {
    key: (point) => point.observedAt,
    limit: config.history.dailyPoints + 1
  });
}

async function collectDefiLlama(context) {
  const { http, config, now } = context;
  const currentRaw = await http.request(config.endpoints.defiLlamaCurrentPrice, {
    sourceId: "defiLlamaCoins", expectedContentTypes: ["application/json"], timeoutMs: config.http.ordinaryTimeoutMs
  });
  const current = defiLlamaCurrentPriceSchema.parse(currentRaw).coins["coingecko:solana"];
  const referenceTimestamp = current.timestamp - 86_400;
  const historyStart = current.timestamp - config.history.dailyPoints * 86_400;
  const referenceUrl = config.endpoints.defiLlamaHistoricalPrice.replace("{timestamp}", String(referenceTimestamp));
  const chartUrl = `${config.endpoints.defiLlamaPriceChart}?start=${historyStart}&span=${config.history.dailyPoints + 1}&period=1d`;
  const [referenceRaw, chartRaw] = await Promise.all([
    http.request(referenceUrl, { sourceId: "defiLlamaCoins", expectedContentTypes: ["application/json"], timeoutMs: config.http.ordinaryTimeoutMs }),
    http.request(chartUrl, { sourceId: "defiLlamaCoins", expectedContentTypes: ["application/json"], timeoutMs: config.http.ordinaryTimeoutMs })
  ]);
  const reference = defiLlamaCurrentPriceSchema.parse(referenceRaw).coins["coingecko:solana"];
  const chart = defiLlamaPriceChartSchema.parse(chartRaw).coins["coingecko:solana"];
  if (current.timestamp > Math.floor(new Date(now).getTime() / 1_000) + 300) throw new PipelineError("FUTURE_PRICE", "Price timestamp is in the future");
  const observedAt = epochSecondsToIso(current.timestamp);
  const elapsedSeconds = current.timestamp - reference.timestamp;
  if (elapsedSeconds < 82_800 || elapsedSeconds > 90_000) {
    throw new PipelineError("INVALID_PRICE_REFERENCE_WINDOW", `SOL price reference is ${elapsedSeconds} seconds old`);
  }
  assertFreshObservation(observedAt, now, config.freshness.price, "SOL price");
  const history = boundedHistory(chart.prices.map((point) => ({ observedAt: epochSecondsToIso(point.timestamp), priceUsd: point.price })), { observedAt, priceUsd: current.price }, config);
  return {
    sourceId: "defiLlamaCoins",
    domain: {
      status: "fresh", observedAt, sourceIds: ["defiLlamaCoins"], currency: "USD",
      currentUsd: current.price,
      change24hPct: percentageChange(current.price, reference.price),
      reference24h: {
        observedAt: epochSecondsToIso(reference.timestamp),
        priceUsd: reference.price,
        elapsedSeconds
      },
      ...(current.confidence !== undefined ? { confidence: current.confidence } : {}),
      history
    },
    dataThrough: observedAt
  };
}

async function collectCoinGecko(context) {
  const { http, config, now } = context;
  const priceUrl = `${config.endpoints.coinGeckoPrice}?ids=solana&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true`;
  const chartUrl = `${config.endpoints.coinGeckoChart}?vs_currency=usd&days=${config.history.dailyPoints}&interval=daily`;
  const [priceRaw, chartRaw] = await Promise.all([
    http.request(priceUrl, { sourceId: "coinGecko", expectedContentTypes: ["application/json"] }),
    http.request(chartUrl, { sourceId: "coinGecko", expectedContentTypes: ["application/json"] })
  ]);
  const price = coinGeckoPriceSchema.parse(priceRaw).solana;
  const chart = coinGeckoChartSchema.parse(chartRaw).prices.map(([milliseconds, value]) => ({ observedAt: isoTimestamp(milliseconds), priceUsd: value }));
  const observedAt = epochSecondsToIso(price.last_updated_at);
  assertFreshObservation(observedAt, now, config.freshness.price, "CoinGecko SOL price");
  const referencePrice = price.usd / (1 + price.usd_24h_change / 100);
  return {
    sourceId: "coinGecko",
    domain: {
      status: "fresh", observedAt, sourceIds: ["coinGecko"], currency: "USD",
      currentUsd: price.usd, change24hPct: price.usd_24h_change,
      reference24h: { observedAt: isoTimestamp(price.last_updated_at * 1_000 - 86_400_000), priceUsd: referencePrice, elapsedSeconds: 86_400 },
      history: boundedHistory(chart, { observedAt, priceUsd: price.usd }, config)
    },
    dataThrough: observedAt
  };
}

export async function collectPrice(context) {
  try {
    return await collectDefiLlama(context);
  } catch (primaryError) {
    try {
      return { ...(await collectCoinGecko(context)), primaryFailure: safeError(primaryError) };
    } catch (fallbackError) {
      throw new PipelineError("PRICE_SOURCES_FAILED", "Both keyless SOL price sources failed", { cause: new AggregateError([primaryError, fallbackError]) });
    }
  }
}
