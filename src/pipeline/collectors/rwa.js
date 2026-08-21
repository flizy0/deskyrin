import { load } from "cheerio";
import { rwaNextDataSchema } from "../contracts/providers.js";
import { PipelineError } from "../lib/errors.js";
import { appendHistory } from "../lib/history.js";
import { assertFreshObservation, isoTimestamp } from "../lib/time.js";

function parseTimestamp(value) {
  const normalized = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value) ? value : `${value}Z`;
  return isoTimestamp(normalized, "RWA update timestamp");
}

function parseEmbedded(html) {
  const $ = load(html);
  const text = $("#__NEXT_DATA__").text();
  if (!text) throw new PipelineError("MISSING_RWA_NEXT_DATA", "RWA page has no embedded Next data");
  let value;
  try {
    value = JSON.parse(text);
  } catch (error) {
    throw new PipelineError("INVALID_RWA_NEXT_DATA", "RWA embedded data is invalid JSON", { cause: error });
  }
  return rwaNextDataSchema.parse(value);
}

export async function collectRwa(context, previousHistory) {
  const { http, config } = context;
  const html = await http.request(config.endpoints.rwaPage, {
    sourceId: "rwa", responseType: "text", expectedContentTypes: ["text/html"],
    timeoutMs: config.http.largeTimeoutMs, maxBytes: config.http.maxBytes.rwa
  });
  const parsed = parseEmbedded(html);
  const network = parsed.props.pageProps.network;
  const nonStable = network.asset_class_stats.filter((row) => row.slug !== "stablecoins");
  const stocks = network.asset_class_stats.find((row) => row.slug === "stocks" && row.name === "Stocks");
  if (!stocks || nonStable.length === 0) throw new PipelineError("MISSING_RWA_SEMANTICS", "RWA payload lacks the Solana Stocks or non-stablecoin categories");
  const totalTransferVolumeUsd = nonStable.reduce((sum, row) => sum + row.trailing_30_day_transfer_volume.val, 0);
  const equityTransferVolumeUsd = stocks.trailing_30_day_transfer_volume.val;
  if (totalTransferVolumeUsd <= 0 || equityTransferVolumeUsd <= 0 || totalTransferVolumeUsd < equityTransferVolumeUsd) {
    throw new PipelineError("INVALID_RWA_TOTAL", "RWA total and Stocks subset must be positive and internally consistent");
  }
  const observedAt = parseTimestamp(network._updated_at);
  assertFreshObservation(observedAt, context.now, config.freshness.daily, "RWA update");
  const point = { observedAt, totalTransferVolumeUsd, equityTransferVolumeUsd };
  return {
    status: "fresh", observedAt, sourceIds: ["rwa"], currency: "USD", windowDays: 30,
    totalTransferVolumeUsd, equityTransferVolumeUsd,
    history: appendHistory(previousHistory, point, { key: (item) => item.observedAt, limit: config.history.rwaPoints })
  };
}
