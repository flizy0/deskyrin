#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { collectAgaveReleases } from "./collectors/agave-releases.js";
import { collectCoinbaseMarket } from "./collectors/coinbase-market.js";
import { collectDexVolume } from "./collectors/defi-dex.js";
import { collectCoinGeckoPrice, collectDefiLlamaPrice } from "./collectors/defi-price.js";
import { collectStablecoins } from "./collectors/defi-stablecoins.js";
import { collectTvl } from "./collectors/defi-tvl.js";
import { collectJito } from "./collectors/jito.js";
import { collectMedianFee } from "./collectors/median-fee.js";
import { collectNews } from "./collectors/news.js";
import { collectSolanaCore } from "./collectors/solana-core.js";
import { collectSolanaData } from "./collectors/solana-data.js";
import { collectSolanaStatus } from "./collectors/solana-status.js";
import { collectTokenizedMarkets, TOKENIZED_MARKETS_METHODOLOGY } from "./collectors/tokens.js";
import { collectUpgrades } from "./collectors/upgrades.js";
import { parseCanonicalSnapshot, parsePreviousCanonicalSnapshot } from "./contracts/canonical.js";
import { createConfig } from "./config.js";
import { buildCoverageIncidents } from "./coverage.js";
import { asPipelineError, safeError } from "./lib/errors.js";
import { createHttpClient } from "./lib/http.js";
import { createRpcClient } from "./lib/rpc.js";
import { isoTimestamp } from "./lib/time.js";
import { calculateAlerts } from "./metrics/alerts.js";
import { calculateChainState, calculateNetworkPerformance } from "./metrics/network.js";
import { calculateProviderComparisons } from "./metrics/provider-comparisons.js";
import { calculateActiveAddresses, calculateRev } from "./metrics/rev.js";
import { calculateValidators } from "./metrics/validators.js";
import { publishOutputs } from "./outputs/publish.js";
import { renderReport } from "./outputs/report.js";
import {
  allDomains,
  buildPriceSourceResults,
  buildSourceRecord,
  mergeDomain,
  mergeOptionalDomain,
  sourceIsDue
} from "./outputs/snapshot.js";

async function readPrevious(root, config) {
  try {
    const text = await readFile(resolve(root, config.output.dataPath), "utf8");
    return parsePreviousCanonicalSnapshot(JSON.parse(text), config.history);
  } catch (error) {
    if (error?.code === "ENOENT") return undefined;
    throw asPipelineError(error, { code: "INVALID_PREVIOUS_SNAPSHOT", message: "Existing data.json is not a valid canonical snapshot" });
  }
}

async function attempt(operation) {
  try {
    return { state: "fresh", value: await operation() };
  } catch (error) {
    return { state: "failed", error: safeError(error) };
  }
}

function notDue() {
  return { state: "notDue" };
}

function metricAttempt(input, operation) {
  if (input.state !== "fresh") return input;
  try {
    return { state: "fresh", value: operation(input.value) };
  } catch (error) {
    return { state: "failed", error: safeError(error) };
  }
}

export function needsTokenizedSnapshotMigration(previous) {
  const active = previous?.ecosystem?.tokenizedAssets;
  return active?.methodology === TOKENIZED_MARKETS_METHODOLOGY
    && (!Array.isArray(active.categoryBreakdown) || !Array.isArray(active.topAssets));
}

function subResult(group, key) {
  if (group.state !== "fresh") return group;
  const item = group.value[key];
  return item?.ok ? { state: "fresh", value: item.value } : { state: "failed", error: safeError(item?.error) };
}

function sourceStateFromDomains(results, dataThrough) {
  if (results.every((result) => result.state === "notDue")) return notDue();
  const failed = results.find((result) => result.state === "failed");
  return failed || { state: "fresh", dataThrough };
}

function parseCli(argv) {
  const options = { dryRun: false };
  for (const argument of argv) {
    if (argument === "--dry-run") options.dryRun = true;
    else if (argument.startsWith("--now=")) options.now = new Date(argument.slice(6));
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (options.now && Number.isNaN(options.now.getTime())) throw new Error("--now must be an ISO timestamp");
  return options;
}

export async function runUpdate(options = {}) {
  const root = options.root || process.cwd();
  const config = options.config || createConfig(process.env);
  const now = options.now || new Date();
  const runObservedAt = isoTimestamp(now);
  const previous = options.previous === undefined ? await readPrevious(root, config) : options.previous;
  const http = options.http || createHttpClient({
    allowedHosts: config.allowedHosts,
    attempts: config.http.attempts,
    retryDelaysMs: config.http.retryDelaysMs,
    maxRetryAfterMs: config.http.maxRetryAfterMs
  });
  const rpc = options.rpc || createRpcClient({
    url: config.rpc.url,
    http,
    sourceId: "solanaRpc",
    retryDelaysMs: config.http.retryDelaysMs,
    rateLimitRetryDelayMs: config.rpc.rateLimitRetryDelayMs
  });
  const context = { now, config, previous, http, rpc };

  const due = (id) => !previous || sourceIsDue(id, previous, now, config);
  const previousTokenizedMarkets = previous?.ecosystem.tokenizedAssets?.methodology === TOKENIZED_MARKETS_METHODOLOGY
    ? previous.ecosystem.tokenizedAssets
    : undefined;
  const tokenizedNeedsMigration = needsTokenizedSnapshotMigration(previous);
  const rpcDue = due("solanaRpc");
  const revDue = due("solanaData") || due("jitoMev");
  const coreResult = rpcDue ? await attempt(() => collectSolanaCore(context)) : notDue();
  const coreTask = Promise.resolve(coreResult);
  const feeTask = rpcDue
    ? coreTask.then(() => attempt(() => collectMedianFee(context, previous?.economics.medianTransactionFee.history)))
    : Promise.resolve(notDue());
  const tasks = {
    core: coreTask,
    fee: feeTask,
    priceDefiLlama: due("defiLlamaCoins") ? attempt(() => collectDefiLlamaPrice(context)) : Promise.resolve(notDue()),
    priceCoinGecko: due("coinGecko") ? attempt(() => collectCoinGeckoPrice(context)) : Promise.resolve(notDue()),
    coinbase: due("coinbaseExchange") ? attempt(() => collectCoinbaseMarket(context)) : Promise.resolve(notDue()),
    tvl: due("defiLlamaTvl") ? attempt(() => collectTvl(context)) : Promise.resolve(notDue()),
    stablecoins: due("defiLlamaStablecoins") ? attempt(() => collectStablecoins(context)) : Promise.resolve(notDue()),
    dex: due("defiLlamaDex") ? attempt(() => collectDexVolume(context)) : Promise.resolve(notDue()),
    solanaData: revDue ? attempt(() => collectSolanaData(context)) : Promise.resolve(notDue()),
    jito: revDue ? attempt(() => collectJito(context)) : Promise.resolve(notDue()),
    tokenized: due("tokensXyz") || tokenizedNeedsMigration
      ? attempt(() => collectTokenizedMarkets(context, previousTokenizedMarkets))
      : Promise.resolve(notDue()),
    news: due("solanaNews") ? attempt(() => collectNews(context)) : Promise.resolve(notDue()),
    upgrades: due("solanaUpgrades") ? attempt(() => collectUpgrades(context)) : Promise.resolve(notDue()),
    status: due("solanaStatus") ? attempt(() => collectSolanaStatus(context)) : Promise.resolve(notDue()),
    releases: due("agaveReleases") ? attempt(() => collectAgaveReleases(context)) : Promise.resolve(notDue())
  };
  const collected = Object.fromEntries(await Promise.all(Object.entries(tasks).map(async ([key, promise]) => [key, await promise])));

  const performanceInput = subResult(collected.core, "performance");
  const epochInput = subResult(collected.core, "epoch");
  const validatorInput = subResult(collected.core, "validators");
  let performanceEvidence;
  const performanceResult = metricAttempt(performanceInput, (value) => {
    const result = calculateNetworkPerformance(value, now, previous?.network.performance.history, config);
    performanceEvidence = result.evidence;
    return result.domain;
  });
  const chainResult = metricAttempt(epochInput, (value) => calculateChainState(value, now));
  const validatorResult = metricAttempt(validatorInput, (value) => calculateValidators(value, now, previous?.validators, config));

  const defiLlamaPriceResult = collected.priceDefiLlama.state === "fresh"
    ? { state: "fresh", value: collected.priceDefiLlama.value.domain }
    : collected.priceDefiLlama;
  const coinGeckoPriceResult = collected.priceCoinGecko.state === "fresh"
    ? { state: "fresh", value: collected.priceCoinGecko.value.domain }
    : collected.priceCoinGecko;
  const priceResult = defiLlamaPriceResult.state === "fresh"
    ? defiLlamaPriceResult
    : defiLlamaPriceResult.state === "failed" && coinGeckoPriceResult.state === "fresh"
      ? coinGeckoPriceResult
      : defiLlamaPriceResult;
  const revResult = collected.solanaData.state === "fresh" && collected.jito.state === "fresh"
    ? metricAttempt({ state: "fresh", value: [collected.solanaData.value, collected.jito.value] }, ([data, jito]) => calculateRev(data.rows, jito, now, config))
    : collected.solanaData.state === "failed" ? collected.solanaData : collected.jito;
  const addressesResult = collected.solanaData.state === "fresh"
    ? metricAttempt(collected.solanaData, (data) => calculateActiveAddresses(data.rows, now, config))
    : collected.solanaData;
  const providerComparisonsResult = collected.solanaData.state === "fresh"
    ? metricAttempt(collected.solanaData, (data) => calculateProviderComparisons(data.rows, data.generatedAt, now, config))
    : collected.solanaData;
  const coinbaseResult = metricAttempt(collected.coinbase, (value) => ({
    status: "fresh",
    observedAt: `${value.dataThrough}T23:59:59.999Z`,
    sourceIds: ["coinbaseExchange"],
    productId: value.productId,
    granularitySeconds: value.granularitySeconds,
    dataThrough: value.dataThrough,
    history: value.history
  }));
  const statusResult = metricAttempt(collected.status, (value) => ({
    status: "fresh",
    observedAt: value.observedAt,
    sourceIds: ["solanaStatus"],
    page: value.page,
    condition: value.status,
    components: value.components,
    incidents: value.incidents
  }));
  const releasesResult = metricAttempt(collected.releases, (value) => ({
    status: "fresh",
    observedAt: value.observedAt,
    sourceIds: ["agaveReleases"],
    repository: value.repository,
    items: value.items
  }));

  const network = {
    performance: mergeDomain(previous?.network.performance, performanceResult, now, config.freshness.live, "network performance"),
    chain: mergeDomain(previous?.network.chain, chainResult, now, config.freshness.live, "chain state")
  };
  const validators = mergeDomain(previous?.validators, validatorResult, now, config.freshness.live, "validators");
  const coinGeckoPrice = mergeOptionalDomain(previous?.economics.coinGeckoPrice, coinGeckoPriceResult, now, config.freshness.price);
  const coinbaseMarket = mergeOptionalDomain(previous?.economics.coinbaseMarket, coinbaseResult, now, config.freshness.daily);
  const economics = {
    solPrice: mergeDomain(previous?.economics.solPrice, priceResult, now, config.freshness.price, "SOL price"),
    tvlAlertInput: mergeDomain(previous?.economics.tvlAlertInput, collected.tvl, now, config.freshness.daily, "TVL"),
    stablecoinSupply: mergeDomain(previous?.economics.stablecoinSupply, collected.stablecoins, now, config.freshness.daily, "stablecoin supply"),
    dexVolume: mergeDomain(previous?.economics.dexVolume, collected.dex, now, config.freshness.daily, "DEX volume"),
    rev: mergeDomain(previous?.economics.rev, revResult, now, config.freshness.daily, "REV"),
    medianTransactionFee: mergeDomain(previous?.economics.medianTransactionFee, collected.fee, now, config.freshness.live, "median transaction fee"),
    ...(coinGeckoPrice ? { coinGeckoPrice } : {}),
    ...(coinbaseMarket ? { coinbaseMarket } : {})
  };
  const ecosystem = {
    tokenizedAssets: mergeDomain(previousTokenizedMarkets, collected.tokenized, now, config.freshness.daily, "tokenized markets"),
    dailyActiveAddresses: mergeDomain(previous?.ecosystem.dailyActiveAddresses, addressesResult, now, config.freshness.daily, "daily active addresses"),
    news: mergeDomain(previous?.ecosystem.news, collected.news, now, config.freshness.content, "news"),
    upgrades: mergeDomain(previous?.ecosystem.upgrades, collected.upgrades, now, config.freshness.content, "upgrades")
  };
  const providerComparisons = mergeOptionalDomain(previous?.providerComparisons, providerComparisonsResult, now, config.freshness.daily);
  const solanaStatus = mergeOptionalDomain(previous?.observability?.solanaStatus, statusResult, now, config.freshness.live);
  const agaveReleases = mergeOptionalDomain(previous?.observability?.agaveReleases, releasesResult, now, config.freshness.content);
  const observability = {
    ...(solanaStatus ? { solanaStatus } : {}),
    ...(agaveReleases ? { agaveReleases } : {})
  };

  const sourceResults = {
    solanaRpc: sourceStateFromDomains([performanceResult, chainResult, validatorResult, collected.fee], runObservedAt),
    ...buildPriceSourceResults(collected.priceDefiLlama, collected.priceCoinGecko),
    coinbaseExchange: collected.coinbase.state === "fresh" ? { state: "fresh", dataThrough: collected.coinbase.value.dataThrough } : collected.coinbase,
    defiLlamaTvl: collected.tvl.state === "fresh" ? { state: "fresh", dataThrough: collected.tvl.value.latest.date } : collected.tvl,
    defiLlamaStablecoins: collected.stablecoins.state === "fresh" ? { state: "fresh", dataThrough: collected.stablecoins.value.date } : collected.stablecoins,
    defiLlamaDex: collected.dex.state === "fresh" ? { state: "fresh", dataThrough: collected.dex.value.date } : collected.dex,
    solanaData: collected.solanaData.state === "fresh" ? { state: "fresh", dataThrough: collected.solanaData.value.generatedAt } : collected.solanaData,
    jitoMev: collected.jito.state === "fresh" ? { state: "fresh", dataThrough: collected.jito.value.at(-1)?.date } : collected.jito,
    tokensXyz: collected.tokenized.state === "fresh" ? { state: "fresh", dataThrough: collected.tokenized.value.observedAt } : collected.tokenized,
    solanaNews: collected.news.state === "fresh" ? { state: "fresh", dataThrough: collected.news.value.feedUpdatedAt || collected.news.value.observedAt } : collected.news,
    solanaUpgrades: collected.upgrades.state === "fresh" ? { state: "fresh", dataThrough: collected.upgrades.value.observedAt } : collected.upgrades,
    solanaStatus: collected.status.state === "fresh" ? { state: "fresh", dataThrough: collected.status.value.dataThrough } : collected.status,
    agaveReleases: collected.releases.state === "fresh" ? { state: "fresh", dataThrough: collected.releases.value.dataThrough } : collected.releases
  };

  const publicationNow = options.now || new Date();
  const updatedAt = isoTimestamp(publicationNow);
  const coverageIncidents = buildCoverageIncidents(
    previous?.coverageIncidents,
    performanceResult.state === "fresh" && validatorResult.state === "fresh" && collected.fee.state === "fresh",
    runObservedAt,
    previous?.sources?.solanaRpc?.nextDueAt
  );
  const sources = {};
  for (const [id, result] of Object.entries(sourceResults)) sources[id] = buildSourceRecord(id, result, previous, now, config);
  const preliminary = {
    schemaVersion: config.schemaVersion,
    methodologyVersion: config.methodologyVersion,
    updatedAt,
    updateStatus: "complete",
    sources,
    coverageIncidents,
    network,
    validators,
    economics,
    ecosystem,
    observability,
    ...(providerComparisons ? { providerComparisons } : {}),
    alertChecks: [],
    alerts: []
  };
  preliminary.updateStatus = allDomains(preliminary).some((domain) => domain.status === "stale") ? "partial" : "complete";
  const alertResult = calculateAlerts(preliminary, {
    performance: performanceResult.state === "fresh" ? performanceEvidence : undefined,
    previousChecks: previous?.alertChecks
  }, config);
  preliminary.alertChecks = alertResult.checks;
  preliminary.alerts = alertResult.alerts;
  const snapshot = parseCanonicalSnapshot(preliminary, config.history);
  const report = renderReport(snapshot);
  const published = await publishOutputs(snapshot, report, config, { root, dryRun: options.dryRun });
  return { snapshot, report, published };
}

async function main() {
  const cli = parseCli(process.argv.slice(2));
  const result = await runUpdate(cli);
  console.log(JSON.stringify({
    updatedAt: result.snapshot.updatedAt,
    updateStatus: result.snapshot.updateStatus,
    alerts: result.snapshot.alerts.length,
    dataBytes: result.published.bytes,
    written: result.published.written
  }));
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  try {
    await main();
  } catch (error) {
    const normalized = asPipelineError(error);
    console.error(JSON.stringify({ error: safeError(normalized) }));
    process.exitCode = 1;
  }
}
