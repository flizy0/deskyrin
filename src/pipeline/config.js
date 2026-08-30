const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export const SCHEMA_VERSION = "1.4.0";
export const METHODOLOGY_VERSION = "1.4.0";

export const SOURCE_IDS = Object.freeze({
  solanaRpc: "solanaRpc",
  defiLlamaCoins: "defiLlamaCoins",
  coinGecko: "coinGecko",
  coinbaseExchange: "coinbaseExchange",
  defiLlamaTvl: "defiLlamaTvl",
  defiLlamaStablecoins: "defiLlamaStablecoins",
  defiLlamaDex: "defiLlamaDex",
  solanaData: "solanaData",
  jitoMev: "jitoMev",
  tokensXyz: "tokensXyz",
  solanaNews: "solanaNews",
  solanaUpgrades: "solanaUpgrades",
  solanaStatus: "solanaStatus",
  agaveReleases: "agaveReleases"
});

const DEFAULT_RPC_URL = "https://api.mainnet-beta.solana.com";

function requireHttpsUrl(value, label) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch (error) {
    throw new Error(`${label} must be a valid URL`, { cause: error });
  }
  if (parsed.protocol !== "https:") {
    throw new Error(`${label} must use HTTPS`);
  }
  return parsed.toString();
}

function integerSetting(value, fallback, label, minimum, maximum) {
  if (value === undefined || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${label} must be an integer between ${minimum} and ${maximum}`);
  }
  return parsed;
}

export function createConfig(env = process.env) {
  const rpcUrl = requireHttpsUrl(env.SOLANA_RPC_URL || DEFAULT_RPC_URL, "SOLANA_RPC_URL");
  const rpcHost = new URL(rpcUrl).hostname;
  const liveRefreshMinutes = integerSetting(env.LIVE_REFRESH_MINUTES, 60, "LIVE_REFRESH_MINUTES", 60, 1_440);
  const dailyRefreshHours = integerSetting(env.DAILY_REFRESH_HOURS, 6, "DAILY_REFRESH_HOURS", 1, 48);

  return Object.freeze({
    schemaVersion: SCHEMA_VERSION,
    methodologyVersion: METHODOLOGY_VERSION,
    rpc: Object.freeze({
      url: rpcUrl,
      commitment: "finalized",
      delinquencyDistanceSlots: 128,
      performanceSampleCount: 80,
      headlineSampleCount: 5,
      alertRecentBinSamples: 5,
      alertBaselineSamples: 60,
      feeWindowSlots: 9_000,
      feeSampleBlocks: 16,
      feeBlockBatchSize: 8,
      minimumValidatorCount: 100,
      minimumValidatorRetentionPct: 80
    }),
    endpoints: Object.freeze({
      defiLlamaCurrentPrice: "https://coins.llama.fi/prices/current/coingecko:solana",
      defiLlamaHistoricalPrice: "https://coins.llama.fi/prices/historical/{timestamp}/coingecko:solana",
      defiLlamaPriceChart: "https://coins.llama.fi/chart/coingecko:solana",
      coinGeckoPrice: "https://api.coingecko.com/api/v3/simple/price",
      coinGeckoChart: "https://api.coingecko.com/api/v3/coins/solana/market_chart",
      coinbaseMarket: "https://api.exchange.coinbase.com/products/SOL-USD/candles",
      defiLlamaTvl: "https://api.llama.fi/v2/historicalChainTvl/Solana",
      defiLlamaStablecoins: "https://stablecoins.llama.fi/stablecoincharts/Solana",
      defiLlamaDex: "https://api.llama.fi/overview/dexs/Solana?excludeTotalDataChart=false&excludeTotalDataChartBreakdown=true",
      solanaData: "https://solana.com/api/databricks/data?days=120",
      jitoMev: "https://kobe.mainnet.jito.network/api/v1/daily_mev_rewards",
      tokensAssets: "https://www.tokens.xyz/api/v1/assets/curated?groupBy=asset&limit=500&primaryVariantStrategy=liquidity",
      solanaNews: "https://solana.com/news/rss.xml",
      solanaUpgrades: "https://solana.com/upgrades",
      solanaStatusSummary: "https://status.solana.com/api/v2/summary.json",
      solanaStatusIncidents: "https://status.solana.com/api/v2/incidents.json",
      agaveReleases: "https://api.github.com/repos/anza-xyz/agave/releases"
    }),
    allowedHosts: Object.freeze([...new Set([
      "api.mainnet-beta.solana.com",
      rpcHost,
      "coins.llama.fi",
      "api.llama.fi",
      "stablecoins.llama.fi",
      "api.coingecko.com",
      "api.exchange.coinbase.com",
      "solana.com",
      "status.solana.com",
      "kobe.mainnet.jito.network",
      "www.tokens.xyz",
      "github.com",
      "api.github.com"
    ])]),
    intervals: Object.freeze({
      hourly: liveRefreshMinutes * MINUTE_MS,
      dailySourceCheck: dailyRefreshHours * HOUR_MS,
      schedulerGrace: 5 * MINUTE_MS
    }),
    freshness: Object.freeze({
      live: 3 * HOUR_MS,
      price: 2 * HOUR_MS,
      daily: 3 * DAY_MS,
      content: 18 * HOUR_MS,
      delinquencyConfirmationGap: 2.5 * HOUR_MS
    }),
    history: Object.freeze({
      hourlyPoints: 720,
      dailyPoints: 90,
      tokenizedPoints: 365,
      commissionEvents: 1_000
    }),
    display: Object.freeze({
      topValidators: 10,
      newsItems: 8
    }),
    alerts: Object.freeze({
      tpsRelativePct: 30,
      tpsAbsolute: 500,
      slotRelativePct: 50,
      slotAbsoluteMs: 75,
      validatorDelinquencyPct: 5,
      tvlChangePct: 10,
      solPriceChangePct: 10
    }),
    http: Object.freeze({
      attempts: 3,
      retryDelaysMs: Object.freeze([1_000, 3_000]),
      maxRetryAfterMs: 10_000,
      ordinaryTimeoutMs: 15_000,
      largeTimeoutMs: 30_000,
      tokensTimeoutMs: 90_000,
      blockTimeoutMs: 45_000,
      maxBytes: Object.freeze({
        ordinary: 10 * 1024 * 1024,
        solanaData: 30 * 1024 * 1024,
        tokensAssets: 8 * 1024 * 1024,
        rpcBlockBatch: 100 * 1024 * 1024
      })
    }),
    output: Object.freeze({
      dataPath: "public/data.json",
      reportPath: "public/report.md",
      maxDataBytes: 2 * 1024 * 1024
    })
  });
}

export const DEFAULT_CONFIG = createConfig({});
