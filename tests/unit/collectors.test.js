import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_CONFIG } from "../../src/pipeline/config.js";
import { collectDexVolume } from "../../src/pipeline/collectors/defi-dex.js";
import { collectCoinGeckoPrice, collectDefiLlamaPrice } from "../../src/pipeline/collectors/defi-price.js";
import { collectStablecoins } from "../../src/pipeline/collectors/defi-stablecoins.js";
import { collectTvl } from "../../src/pipeline/collectors/defi-tvl.js";
import { collectJito } from "../../src/pipeline/collectors/jito.js";
import { collectMedianFee } from "../../src/pipeline/collectors/median-fee.js";
import { collectNews } from "../../src/pipeline/collectors/news.js";
import { collectSolanaCore } from "../../src/pipeline/collectors/solana-core.js";
import { collectSolanaData } from "../../src/pipeline/collectors/solana-data.js";
import { collectTokenizedMarkets } from "../../src/pipeline/collectors/tokens.js";
import { collectUpgrades } from "../../src/pipeline/collectors/upgrades.js";
import { PipelineError } from "../../src/pipeline/lib/errors.js";

const now = new Date("2026-08-20T12:00:00.000Z");
const epoch = (value) => Math.floor(Date.parse(value) / 1_000);

function httpContext(responder) {
  return { now, config: DEFAULT_CONFIG, http: { request: responder } };
}

test("DefiLlama collectors normalize completed daily series", async () => {
  const days = ["2026-08-18", "2026-08-19"].map(epoch);
  const context = httpContext(async (url) => {
    if (url === DEFAULT_CONFIG.endpoints.defiLlamaTvl) return [{ date: days[0], tvl: 10 }, { date: days[1], tvl: 12 }];
    if (url === DEFAULT_CONFIG.endpoints.defiLlamaStablecoins) return [
      { date: String(days[0]), totalCirculatingUSD: { peggedUSD: 20 } },
      { date: String(days[1]), totalCirculatingUSD: { peggedUSD: 21 } }
    ];
    if (url === DEFAULT_CONFIG.endpoints.defiLlamaDex) return {
      chain: "Solana", totalDataChart: [[days[0], 30], [days[1], 33]]
    };
    throw new Error(`Unexpected fixture URL ${url}`);
  });
  const [tvl, stablecoins, dex] = await Promise.all([
    collectTvl(context), collectStablecoins(context), collectDexVolume(context)
  ]);
  assert.ok(Math.abs(tvl.change1dPct - 20) < 1e-12);
  assert.equal(stablecoins.totalCirculatingUsd, 21);
  assert.equal(dex.dailyVolumeUsd, 33);
});

test("DefiLlama collector rejects conflicting duplicate dates", async () => {
  const context = httpContext(async () => [
    { date: epoch("2026-08-18"), tvl: 10 },
    { date: epoch("2026-08-18"), tvl: 11 },
    { date: epoch("2026-08-19"), tvl: 12 }
  ]);
  await assert.rejects(collectTvl(context), (error) => error.code === "CONFLICTING_DUPLICATE");
});

test("SOL price collector enforces a real 24-hour reference", async () => {
  const currentTimestamp = epoch("2026-08-20T11:59:00.000Z");
  const referenceTimestamp = currentTimestamp - 86_400;
  const context = httpContext(async (url) => {
    if (url.includes("/prices/current/")) return { coins: { "coingecko:solana": { symbol: "SOL", timestamp: currentTimestamp, price: 110 } } };
    if (url.includes("/prices/historical/")) return { coins: { "coingecko:solana": { symbol: "SOL", timestamp: referenceTimestamp, price: 100 } } };
    if (url.includes("/chart/")) return { coins: { "coingecko:solana": { symbol: "SOL", prices: [
      { timestamp: referenceTimestamp, price: 100 }, { timestamp: currentTimestamp, price: 110 }
    ] } } };
    throw new Error(`Unexpected fixture URL ${url}`);
  });
  const result = await collectDefiLlamaPrice(context);
  assert.equal(result.sourceId, "defiLlamaCoins");
  assert.ok(Math.abs(result.domain.change24hPct - 10) < 1e-12);
  assert.equal(result.domain.reference24h.elapsedSeconds, 86_400);
});

test("CoinGecko current quote supersedes a chart point at the same timestamp", async () => {
  const currentTimestamp = epoch("2026-08-20T11:59:00.000Z");
  const observedAt = new Date(currentTimestamp * 1_000).toISOString();
  const context = httpContext(async (url) => {
    if (url.includes("/simple/price")) return {
      solana: { usd: 110, usd_24h_change: 10, last_updated_at: currentTimestamp }
    };
    if (url.includes("/market_chart")) return { prices: [
      [Date.parse("2026-08-19T00:00:00.000Z"), 100],
      [currentTimestamp * 1_000, 109.5]
    ] };
    throw new Error(`Unexpected fixture URL ${url}`);
  });

  const result = await collectCoinGeckoPrice(context);
  const currentPoints = result.domain.history.filter((point) => point.observedAt === observedAt);
  assert.deepEqual(currentPoints, [{ observedAt, priceUsd: 110 }]);
});

test("Solana Data and Jito collectors normalize fresh completed data", async () => {
  const rows = [
    { date: "2026-08-19", metricName: "Fees", unit: "SOL", providerName: "Allium", value: 100 },
    { date: "2026-08-19", metricName: "Fees", unit: "SOL", providerName: "Dune", value: 102 },
    { date: "2026-08-19", metricName: "Fee Payers", unit: "Count", providerName: "Allium", value: 1_000 },
    { date: "2026-08-19", metricName: "Fee Payers", unit: "Count", providerName: "Dune", value: 1_002 }
  ];
  const solanaData = await collectSolanaData(httpContext(async () => ({ generatedAt: now.toISOString(), rows })));
  const jito = await collectJito(httpContext(async () => [{ day: "2026-08-19T00:00:00Z", jito_tips: 4, validator_tips: 5 }]));
  assert.equal(solanaData.rows.length, 4);
  assert.deepEqual(jito, [{ date: "2026-08-19", grossTipsSol: 9 }]);
});

test("Solana Data transport does not freeze independent metrics when one consensus is absent", async () => {
  const rows = [
    { date: "2026-08-19", metricName: "SOL Price", unit: "USD", providerName: "Birdeye", value: 150 },
    { date: "2026-08-19", metricName: "DEX Volume", unit: "USD", providerName: "DexPaprika", value: 2_000_000_000 }
  ];

  const result = await collectSolanaData(httpContext(async () => ({ generatedAt: now.toISOString(), rows })));

  assert.deepEqual(result.rows, rows);
});

test("Tokens.xyz and RSS collectors preserve provenance and legacy boundaries", async () => {
  const asset = (assetId, category, volume30dUSD, metricsSource, mint) => ({
    assetId,
    name: `${assetId} name`,
    symbol: assetId.toUpperCase(),
    category,
    stats: { volume24hUSD: 1, volume30dUSD, marketCap: 10 },
    primaryVariant: {
      mint,
      market: { source: "birdeye", metricsSource, volume24hUSD: 1, marketCap: 10, lastFetchedAt: 1_788_088_681_865 }
    }
  });
  const byList = {
    rwas: [
      asset("tbill", "rwa", 100, "birdeye", "11111111111111111111111111111111"),
      asset("excluded-rwa", "rwa", 900, "rwa_xyz", "22222222222222222222222222222222")
    ],
    stocks: [
      asset("equity", "equity", 200, "clickhouse_trades", "33333333333333333333333333333333"),
      asset("tbill", "rwa", 999, "birdeye", "11111111111111111111111111111111")
    ],
    etfs: [asset("etf", "etf", 50, "birdeye", "44444444444444444444444444444444")],
    metals: [asset("gold", "commodity", 60, "future_provider", "55555555555555555555555555555555")]
  };
  const rss = `<?xml version="1.0"?><rss><channel><lastBuildDate>Thu, 20 Aug 2026 11:00:00 GMT</lastBuildDate><item><guid>one</guid><title>Official update</title><link>https://solana.com/news/update</link><pubDate>Wed, 19 Aug 2026 10:00:00 GMT</pubDate><description><![CDATA[<p>Source-authored text.</p>]]></description></item></channel></rss>`;
  const context = httpContext(async (url) => {
    if (url.startsWith("https://www.tokens.xyz/")) {
      const listId = new URL(url).searchParams.get("list");
      const assets = byList[listId];
      return {
        listId,
        primaryVariantStrategy: "liquidity",
        pagination: { offset: 0, limit: 500, total: assets.length, hasMore: false, nextOffset: null },
        assets
      };
    }
    return rss;
  });
  const previous = {
    status: "fresh",
    observedAt: "2026-08-19T00:00:00.000Z",
    sourceIds: ["rwa"],
    currency: "USD",
    windowDays: 30,
    totalTransferVolumeUsd: 300,
    equityTransferVolumeUsd: 200,
    history: [{ observedAt: "2026-08-19T00:00:00.000Z", totalTransferVolumeUsd: 300, equityTransferVolumeUsd: 200 }]
  };
  const [tokenized, news] = await Promise.all([collectTokenizedMarkets(context, previous), collectNews(context)]);
  assert.equal(tokenized.totalSpotVolume30dUsd, 350);
  assert.equal(tokenized.equitySpotVolume30dUsd, 200);
  assert.equal(tokenized.indexedAssetCount, 5);
  assert.equal(tokenized.coveredAssetCount, 3);
  assert.deepEqual(tokenized.provenanceCoverage, {
    rwaXyzExcludedCount: 1,
    unknownSourceExcludedCount: 1,
    missingVolumeExcludedCount: 0
  });
  assert.deepEqual(tokenized.categoryBreakdown, [
    { id: "equities", indexedAssetCount: 1, coveredAssetCount: 1, spotVolume30dUsd: 200 },
    { id: "funds", indexedAssetCount: 1, coveredAssetCount: 1, spotVolume30dUsd: 50 },
    { id: "commodities", indexedAssetCount: 1, coveredAssetCount: 0, spotVolume30dUsd: 0 },
    { id: "other-rwa", indexedAssetCount: 2, coveredAssetCount: 1, spotVolume30dUsd: 100 }
  ]);
  assert.deepEqual(tokenized.topAssets, [
    { rank: 1, assetId: "equity", name: "equity name", symbol: "EQUITY", categoryGroup: "equities", spotVolume30dUsd: 200, metricsSource: "clickhouse_trades" },
    { rank: 2, assetId: "tbill", name: "tbill name", symbol: "TBILL", categoryGroup: "other-rwa", spotVolume30dUsd: 100, metricsSource: "birdeye" },
    { rank: 3, assetId: "etf", name: "etf name", symbol: "ETF", categoryGroup: "funds", spotVolume30dUsd: 50, metricsSource: "birdeye" }
  ]);
  assert.equal(tokenized.legacyTransferVolume.endedAt, previous.observedAt);
  assert.equal(news.items[0].title, "Official update");
  assert.equal(news.items[0].description, "Source-authored text.");
});

test("official upgrades fixture retains SIMD links and partially activated cards", async () => {
  const hub = `<html><body><section><h2>Agave 4.3</h2><a href="/upgrades/alpenglow"><span>In Development</span><h3>Alpenglow</h3><p>Consensus upgrade</p></a><a href="/upgrades/reduced-slot-times"><span>Pending Feature Activation</span><h3>Reduced Slot Times</h3><p>Faster slots</p></a><a href="/upgrades/reduced-rent"><span>Partially Activated</span><h3>Reduced Rent</h3><p>Lower account costs</p></a></section></body></html>`;
  const detail = (id) => `<html><body><a href="https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/${id}-proposal.md">SIMD-${id}</a></body></html>`;
  const context = httpContext(async (url) => {
    if (url === DEFAULT_CONFIG.endpoints.solanaUpgrades) return hub;
    if (url.endsWith("/alpenglow")) return detail("0326");
    if (url.endsWith("/reduced-slot-times")) return detail("0525");
    if (url.endsWith("/reduced-rent")) return "<html><body></body></html>";
    throw new Error(`Unexpected fixture URL ${url}`);
  });
  const upgrades = await collectUpgrades(context);
  assert.equal(upgrades.items.length, 3);
  assert.ok(upgrades.items.some((item) => item.simds.some((simd) => simd.id === "0525")));
  assert.deepEqual(
    upgrades.items.find((item) => item.id === "reduced-rent"),
    {
      id: "reduced-rent",
      title: "Reduced Rent",
      subtitle: "Lower account costs",
      url: "https://solana.com/upgrades/reduced-rent",
      stage: "pending_activation",
      stageLabel: "Partially Activated",
      releaseId: "agave-4-3",
      releaseLabel: "Agave 4.3",
      metrics: [],
      simds: []
    }
  );
});

test("Solana RPC collectors validate batch domains and a complete fee sample", async () => {
  const performance = Array.from({ length: 80 }, (_, index) => ({
    numNonVoteTransactions: 120_000,
    numSlots: 150,
    numTransactions: 180_000,
    samplePeriodSecs: 60,
    slot: 10_000 - index
  }));
  const vote = { activatedStake: 1_000n, commission: 5, epochVoteAccount: true, lastVote: 9_999, rootSlot: 9_998, nodePubkey: "11111111111111111111111111111111", votePubkey: "22222222222222222222222222222222" };
  const rpc = {
    batch: async (requests) => requests[0].key === "performance"
      ? {
          performance: { ok: true, value: performance },
          epoch: { ok: true, value: { absoluteSlot: 10_000, blockHeight: 9_000, epoch: 4, slotIndex: 100, slotsInEpoch: 400 } },
          validators: { ok: true, value: { current: [vote], delinquent: [] } }
        }
      : Object.fromEntries(requests.map((request) => [request.key, { ok: true, value: { transactions: [{ meta: { fee: 5_000 } }] } }])),
    call: async (method) => method === "getSlot" ? 10_000 : Array.from({ length: 100 }, (_, index) => 1_001 + index * 80)
  };
  const context = { now, config: DEFAULT_CONFIG, rpc };
  const core = await collectSolanaCore(context);
  const fee = await collectMedianFee(context, []);
  assert.equal(core.performance.ok, true);
  assert.equal(core.validators.ok, true);
  assert.equal(fee.sample.selectedBlockCount, 16);
  assert.equal(fee.medianLamports, 5_000);
});

test("median fee collector preserves an exhausted RPC error", async () => {
  const rpcError = new PipelineError("RPC_429", "RPC error 429: Too many requests for a specific RPC call", {
    sourceId: "solanaRpc",
    retryable: true
  });
  const rpc = {
    call: async (method) => method === "getSlot"
      ? 10_000
      : Array.from({ length: 100 }, (_, index) => 1_001 + index * 80),
    batch: async (requests) => Object.fromEntries(requests.map((request, index) => [
      request.key,
      index === 0 ? { ok: false, error: rpcError } : { ok: true, value: { transactions: [{ meta: { fee: 5_000 } }] } }
    ]))
  };

  await assert.rejects(
    collectMedianFee({ now, config: DEFAULT_CONFIG, rpc }, []),
    (error) => error === rpcError
  );
});
