import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_CONFIG } from "../../src/pipeline/config.js";
import { collectDexVolume } from "../../src/pipeline/collectors/defi-dex.js";
import { collectDefiLlamaPrice } from "../../src/pipeline/collectors/defi-price.js";
import { collectStablecoins } from "../../src/pipeline/collectors/defi-stablecoins.js";
import { collectTvl } from "../../src/pipeline/collectors/defi-tvl.js";
import { collectJito } from "../../src/pipeline/collectors/jito.js";
import { collectMedianFee } from "../../src/pipeline/collectors/median-fee.js";
import { collectNews } from "../../src/pipeline/collectors/news.js";
import { collectRwa } from "../../src/pipeline/collectors/rwa.js";
import { collectSolanaCore } from "../../src/pipeline/collectors/solana-core.js";
import { collectSolanaData } from "../../src/pipeline/collectors/solana-data.js";
import { collectUpgrades } from "../../src/pipeline/collectors/upgrades.js";

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

test("RWA and RSS collectors parse their public page contracts", async () => {
  const rwaPayload = {
    buildId: "fixture-build",
    props: { pageProps: { network: {
      id: 1, name: "Solana", slug: "solana", _updated_at: "2026-08-20T11:00:00.000Z",
      asset_class_stats: [
        { name: "Stablecoins", slug: "stablecoins", trailing_30_day_transfer_volume: { val: 1_000 } },
        { name: "Stocks", slug: "stocks", trailing_30_day_transfer_volume: { val: 200 } },
        { name: "Treasuries", slug: "treasuries", trailing_30_day_transfer_volume: { val: 50 } }
      ]
    } } }
  };
  const rss = `<?xml version="1.0"?><rss><channel><lastBuildDate>Thu, 20 Aug 2026 11:00:00 GMT</lastBuildDate><item><guid>one</guid><title>Official update</title><link>https://solana.com/news/update</link><pubDate>Wed, 19 Aug 2026 10:00:00 GMT</pubDate><description><![CDATA[<p>Source-authored text.</p>]]></description></item></channel></rss>`;
  const context = httpContext(async (url) => url === DEFAULT_CONFIG.endpoints.rwaPage
    ? `<html><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(rwaPayload)}</script></body></html>`
    : rss);
  const [rwa, news] = await Promise.all([collectRwa(context, []), collectNews(context)]);
  assert.equal(rwa.totalTransferVolumeUsd, 250);
  assert.equal(rwa.equityTransferVolumeUsd, 200);
  assert.equal(news.items[0].title, "Official update");
  assert.equal(news.items[0].description, "Source-authored text.");
});

test("official upgrades fixture retains listing-named SIMD links", async () => {
  const hub = `<html><body><section><h2>Agave 4.3</h2><a href="/upgrades/alpenglow"><span>In Development</span><h3>Alpenglow</h3><p>Consensus upgrade</p></a><a href="/upgrades/reduced-slot-times"><span>Pending Feature Activation</span><h3>Reduced Slot Times</h3><p>Faster slots</p></a></section></body></html>`;
  const detail = (id) => `<html><body><a href="https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/${id}-proposal.md">SIMD-${id}</a></body></html>`;
  const context = httpContext(async (url) => {
    if (url === DEFAULT_CONFIG.endpoints.solanaUpgrades) return hub;
    if (url.endsWith("/alpenglow")) return detail("0326");
    if (url.endsWith("/reduced-slot-times")) return detail("0525");
    throw new Error(`Unexpected fixture URL ${url}`);
  });
  const upgrades = await collectUpgrades(context);
  assert.equal(upgrades.items.length, 2);
  assert.ok(upgrades.items.some((item) => item.simds.some((simd) => simd.id === "0525")));
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
