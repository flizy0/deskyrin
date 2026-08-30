import { tokensCuratedAssetsSchema } from "../contracts/providers.js";
import { PipelineError } from "../lib/errors.js";
import { appendHistory, uniqueByKey } from "../lib/history.js";
import { isoTimestamp } from "../lib/time.js";

export const TOKENIZED_MARKETS_METHODOLOGY = "tokens_xyz_spot_volume_v1";

const CURATED_LISTS = Object.freeze(["rwas", "stocks", "etfs", "metals"]);
const ACCEPTED_METRICS_SOURCES = Object.freeze(["birdeye", "clickhouse_trades"]);
const ACCEPTED_SOURCE_SET = new Set(ACCEPTED_METRICS_SOURCES);
const CATEGORY_GROUPS = Object.freeze(["equities", "funds", "commodities", "other-rwa"]);
const PAGE_LIMIT = 500;
const MAX_PAGES_PER_LIST = 10;
const LEGACY_SOURCE_URL = "https://app.rwa.xyz/networks/solana";

function pageUrl(base, listId, offset) {
  const url = new URL(base);
  url.searchParams.set("list", listId);
  url.searchParams.set("groupBy", "asset");
  url.searchParams.set("limit", String(PAGE_LIMIT));
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("primaryVariantStrategy", "liquidity");
  return url.toString();
}

async function fetchCuratedList(context, listId) {
  const { http, config } = context;
  const assets = [];
  let offset = 0;
  let expectedTotal;

  for (let page = 0; page < MAX_PAGES_PER_LIST; page += 1) {
    const payload = await http.request(pageUrl(config.endpoints.tokensAssets, listId, offset), {
      sourceId: "tokensXyz",
      expectedContentTypes: ["application/json"],
      timeoutMs: config.http.tokensTimeoutMs,
      maxBytes: config.http.maxBytes.tokensAssets
    });
    const parsed = tokensCuratedAssetsSchema.parse(payload);
    if (parsed.listId !== listId || parsed.pagination.offset !== offset || parsed.pagination.limit !== PAGE_LIMIT) {
      throw new PipelineError("TOKENS_PAGE_MISMATCH", `Tokens.xyz returned the wrong ${listId} page`);
    }
    if (parsed.primaryVariantStrategy !== "liquidity") {
      throw new PipelineError("TOKENS_STRATEGY_MISMATCH", "Tokens.xyz changed the requested primary-variant strategy");
    }
    if (parsed.stale === true) {
      throw new PipelineError("TOKENS_STALE_RESPONSE", `Tokens.xyz served stale ${listId} data`);
    }
    if (expectedTotal === undefined) expectedTotal = parsed.pagination.total;
    if (parsed.pagination.total !== expectedTotal) {
      throw new PipelineError("TOKENS_PAGINATION_CHANGED", `Tokens.xyz ${listId} total changed during pagination`);
    }
    assets.push(...parsed.assets);

    if (!parsed.pagination.hasMore) {
      if (parsed.pagination.nextOffset !== null || assets.length !== expectedTotal) {
        throw new PipelineError("TOKENS_PAGINATION_MISMATCH", `Tokens.xyz ${listId} pagination is incomplete`);
      }
      return uniqueByKey(assets, (asset) => asset.assetId, `Tokens.xyz ${listId} assets`);
    }

    const nextOffset = parsed.pagination.nextOffset;
    if (parsed.assets.length === 0 || nextOffset !== offset + parsed.assets.length) {
      throw new PipelineError("TOKENS_PAGINATION_MISMATCH", `Tokens.xyz ${listId} pagination did not advance contiguously`);
    }
    offset = nextOffset;
  }

  throw new PipelineError("TOKENS_PAGINATION_LIMIT", `Tokens.xyz ${listId} exceeded the bounded page limit`);
}

function metricsSource(asset) {
  return asset.primaryVariant?.market?.metricsSource;
}

function hasAcceptedProvenance(asset) {
  return ACCEPTED_SOURCE_SET.has(metricsSource(asset));
}

function hasThirtyDayVolume(asset) {
  return hasAcceptedProvenance(asset) && asset.stats?.volume30dUSD !== null && asset.stats?.volume30dUSD !== undefined;
}

function sumVolume(rows) {
  return rows.reduce((sum, asset) => sum + asset.stats.volume30dUSD, 0);
}

function categoryGroup(asset) {
  if (asset.category === "equity") return "equities";
  if (asset.category === "etf") return "funds";
  if (asset.category === "commodity") return "commodities";
  return "other-rwa";
}

function buildCategoryBreakdown(assets) {
  return CATEGORY_GROUPS.map((id) => {
    const indexed = assets.filter((asset) => categoryGroup(asset) === id);
    const covered = indexed.filter(hasThirtyDayVolume);
    return {
      id,
      indexedAssetCount: indexed.length,
      coveredAssetCount: covered.length,
      spotVolume30dUsd: sumVolume(covered)
    };
  });
}

function compareTopAssets(left, right) {
  const volumeDifference = right.stats.volume30dUSD - left.stats.volume30dUSD;
  if (volumeDifference !== 0) return volumeDifference;
  if (left.assetId === right.assetId) return 0;
  return left.assetId < right.assetId ? -1 : 1;
}

function buildTopAssets(coveredAssets) {
  return [...coveredAssets]
    .sort(compareTopAssets)
    .slice(0, 10)
    .map((asset, index) => ({
      rank: index + 1,
      assetId: asset.assetId,
      name: asset.name,
      symbol: asset.symbol,
      categoryGroup: categoryGroup(asset),
      spotVolume30dUsd: asset.stats.volume30dUSD,
      metricsSource: metricsSource(asset)
    }));
}

function unionByAssetId(lists) {
  const byAssetId = new Map();
  for (const assets of lists) {
    for (const asset of assets) {
      if (!byAssetId.has(asset.assetId)) byAssetId.set(asset.assetId, asset);
    }
  }
  return [...byAssetId.values()];
}

function legacyTransferVolume(previous) {
  if (!previous) return undefined;
  if (previous.methodology === TOKENIZED_MARKETS_METHODOLOGY) return previous.legacyTransferVolume;
  if (previous.windowDays !== 30 || !Array.isArray(previous.history) || previous.history.length === 0) return undefined;
  const history = previous.history.map((point) => ({
    observedAt: point.observedAt,
    totalTransferVolumeUsd: point.totalTransferVolumeUsd,
    equityTransferVolumeUsd: point.equityTransferVolumeUsd
  }));
  return {
    sourceName: "RWA.xyz Solana Network",
    sourceUrl: LEGACY_SOURCE_URL,
    methodology: "rwa_xyz_trailing_30d_transfer_volume",
    currency: "USD",
    windowDays: 30,
    endedAt: history.at(-1).observedAt,
    history
  };
}

export async function collectTokenizedMarkets(context, previous) {
  const lists = await Promise.all(CURATED_LISTS.map((listId) => fetchCuratedList(context, listId)));
  if (lists.some((assets) => assets.length === 0)) {
    throw new PipelineError("TOKENS_INSUFFICIENT_COVERAGE", "Tokens.xyz returned an empty required curated list");
  }
  const byList = Object.fromEntries(CURATED_LISTS.map((listId, index) => [listId, lists[index]]));
  // The requests are not atomic. First-list precedence prevents double counting
  // without treating harmless cross-list refresh drift as a canonical conflict.
  const assets = unionByAssetId(lists);
  const equities = assets.filter((asset) => asset.category === "equity");
  const coveredAssets = assets.filter(hasThirtyDayVolume);
  const coveredEquities = equities.filter(hasThirtyDayVolume);

  if (assets.length === 0 || equities.length === 0 || coveredAssets.length === 0 || coveredEquities.length === 0) {
    throw new PipelineError("TOKENS_INSUFFICIENT_COVERAGE", "Tokens.xyz lacks covered tokenized-market or equity spot-volume data");
  }

  const observedAt = isoTimestamp(context.now);
  const point = {
    observedAt,
    totalSpotVolume30dUsd: sumVolume(coveredAssets),
    equitySpotVolume30dUsd: sumVolume(coveredEquities),
    indexedAssetCount: assets.length,
    indexedEquityCount: equities.length,
    coveredAssetCount: coveredAssets.length,
    coveredEquityCount: coveredEquities.length
  };
  const previousHistory = previous?.methodology === TOKENIZED_MARKETS_METHODOLOGY ? previous.history : [];
  const legacy = legacyTransferVolume(previous);

  return {
    status: "fresh",
    observedAt,
    sourceIds: ["tokensXyz"],
    methodology: TOKENIZED_MARKETS_METHODOLOGY,
    currency: "USD",
    windowDays: 30,
    curatedLists: [...CURATED_LISTS],
    acceptedMetricsSources: [...ACCEPTED_METRICS_SOURCES],
    ...point,
    provenanceCoverage: {
      rwaXyzExcludedCount: assets.filter((asset) => metricsSource(asset) === "rwa_xyz").length,
      unknownSourceExcludedCount: assets.filter((asset) => {
        const source = metricsSource(asset);
        return source !== "rwa_xyz" && !ACCEPTED_SOURCE_SET.has(source);
      }).length,
      missingVolumeExcludedCount: assets.filter((asset) =>
        hasAcceptedProvenance(asset) && (asset.stats?.volume30dUSD === null || asset.stats?.volume30dUSD === undefined)
      ).length
    },
    listCoverage: Object.fromEntries(CURATED_LISTS.map((listId) => [listId, byList[listId].length])),
    categoryBreakdown: buildCategoryBreakdown(assets),
    topAssets: buildTopAssets(coveredAssets),
    history: appendHistory(previousHistory, point, {
      key: (item) => item.observedAt,
      limit: context.config.history.tokenizedPoints
    }),
    ...(legacy ? { legacyTransferVolume: legacy } : {})
  };
}
