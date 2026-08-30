import { PipelineError } from "../lib/errors.js";
import { addMs, ageMs, isoTimestamp } from "../lib/time.js";

export const SOURCE_DEFINITIONS = Object.freeze({
  solanaRpc: { name: "Solana JSON-RPC", endpoint: "rpc", interval: "hourly" },
  defiLlamaCoins: { name: "DefiLlama Coins API", endpoint: "defiLlamaCurrentPrice", interval: "hourly" },
  coinGecko: { name: "CoinGecko Keyless API", endpoint: "coinGeckoPrice", interval: "hourly" },
  coinbaseExchange: { name: "Coinbase Exchange SOL-USD", endpoint: "coinbaseMarket", interval: "dailySourceCheck" },
  defiLlamaTvl: { name: "DefiLlama Chain TVL", endpoint: "defiLlamaTvl", interval: "dailySourceCheck" },
  defiLlamaStablecoins: { name: "DefiLlama Stablecoins", endpoint: "defiLlamaStablecoins", interval: "dailySourceCheck" },
  defiLlamaDex: { name: "DefiLlama DEX Dimensions", endpoint: "defiLlamaDex", interval: "dailySourceCheck" },
  solanaData: { name: "Solana Foundation Data", endpoint: "solanaData", interval: "dailySourceCheck" },
  jitoMev: { name: "Jito Daily MEV Rewards", endpoint: "jitoMev", interval: "dailySourceCheck" },
  tokensXyz: { name: "Tokens.xyz Curated Markets", endpoint: "tokensAssets", interval: "dailySourceCheck" },
  solanaNews: { name: "Solana News RSS", endpoint: "solanaNews", interval: "dailySourceCheck" },
  solanaUpgrades: { name: "Solana Upgrades Hub", endpoint: "solanaUpgrades", interval: "dailySourceCheck" },
  solanaStatus: { name: "Solana Status", endpoint: "solanaStatusSummary", interval: "hourly" },
  agaveReleases: { name: "Agave Releases", endpoint: "agaveReleases", interval: "dailySourceCheck" }
});

export function sourceUrl(id, config) {
  const definition = SOURCE_DEFINITIONS[id];
  if (!definition) throw new PipelineError("UNKNOWN_SOURCE", `Unknown source ${id}`);
  if (definition.endpoint === "rpc") return new URL(config.rpc.url).origin;
  const value = config.endpoints[definition.endpoint];
  return value.replace("{timestamp}", "0");
}

export function sourceInterval(id, config) {
  return config.intervals[SOURCE_DEFINITIONS[id].interval];
}

export function sourceIsDue(id, previous, now, config) {
  const source = previous?.sources?.[id];
  if (!source?.lastSuccessAt) return true;
  return new Date(now).getTime() >= new Date(source.nextDueAt).getTime() - config.intervals.schedulerGrace;
}

export function buildPriceSourceResults(defiLlamaResult, coinGeckoResult) {
  const state = (result) => result.state === "fresh"
    ? { state: "fresh", dataThrough: result.value.dataThrough }
    : result;
  return {
    defiLlamaCoins: state(defiLlamaResult),
    coinGecko: state(coinGeckoResult)
  };
}

export function buildSourceRecord(id, result, previous, now, config) {
  const prior = previous?.sources?.[id];
  const timestamp = isoTimestamp(now);
  const interval = sourceInterval(id, config);
  if (result.state === "notDue") {
    if (!prior) throw new PipelineError("MISSING_SOURCE_STATE", `Not-due source ${id} has no prior record`);
    return prior;
  }
  if (result.state === "fresh") {
    return {
      name: SOURCE_DEFINITIONS[id].name,
      url: sourceUrl(id, config),
      status: "fresh",
      lastAttemptAt: timestamp,
      lastSuccessAt: timestamp,
      nextDueAt: addMs(now, interval),
      ...(result.dataThrough ? { dataThrough: result.dataThrough } : {})
    };
  }
  return {
    name: SOURCE_DEFINITIONS[id].name,
    url: sourceUrl(id, config),
    status: prior?.lastSuccessAt ? "stale" : "unavailable",
    lastAttemptAt: timestamp,
    ...(prior?.lastSuccessAt ? { lastSuccessAt: prior.lastSuccessAt } : {}),
    nextDueAt: addMs(now, config.intervals.hourly),
    ...(prior?.dataThrough ? { dataThrough: prior.dataThrough } : {}),
    error: {
      code: String(result.error?.code || "SOURCE_FAILED").slice(0, 100),
      message: String(result.error?.message || "Source collection failed").slice(0, 300)
    }
  };
}

function staleCopy(previous, now) {
  return {
    ...previous,
    status: "stale",
    staleSince: previous.staleSince || isoTimestamp(now)
  };
}

function freshCopy(previous) {
  const copy = { ...previous, status: "fresh" };
  delete copy.staleSince;
  return copy;
}

export function mergeDomain(previous, result, now, freshnessMs, label) {
  if (result.state === "fresh") return result.value;
  if (!previous) {
    const detail = result.error?.code ? ` (${result.error.code}: ${result.error.message})` : "";
    throw new PipelineError("BOOTSTRAP_DOMAIN_FAILED", `${label} has no last-known-good value${detail}`, { cause: result.error });
  }
  if (result.state === "failed") return staleCopy(previous, now);
  if (previous.status === "stale") return staleCopy(previous, now);
  return ageMs(previous.observedAt, now) <= freshnessMs ? freshCopy(previous) : staleCopy(previous, now);
}

export function mergeOptionalDomain(previous, result, now, freshnessMs) {
  if (!previous && result.state !== "fresh") return undefined;
  return mergeDomain(previous, result, now, freshnessMs, "supplemental domain");
}

export function allDomains(snapshot) {
  return [
    snapshot.network.performance,
    snapshot.network.chain,
    snapshot.validators,
    snapshot.economics.solPrice,
    snapshot.economics.tvlAlertInput,
    snapshot.economics.stablecoinSupply,
    snapshot.economics.dexVolume,
    snapshot.economics.rev,
    snapshot.economics.medianTransactionFee,
    snapshot.ecosystem.tokenizedAssets,
    snapshot.ecosystem.dailyActiveAddresses,
    snapshot.ecosystem.news,
    snapshot.ecosystem.upgrades,
    snapshot.economics.coinGeckoPrice,
    snapshot.economics.coinbaseMarket,
    snapshot.providerComparisons,
    snapshot.observability?.solanaStatus,
    snapshot.observability?.agaveReleases
  ].filter(Boolean);
}
