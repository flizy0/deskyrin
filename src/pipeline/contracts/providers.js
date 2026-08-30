import { z } from "zod";

const finite = z.number().refine(Number.isFinite, "Expected a finite number");
const nonNegative = finite.min(0);
const positive = finite.positive();
const safeNonNegativeInteger = z.number().int().safe().min(0);
const providerInteger = z.union([safeNonNegativeInteger, z.bigint().min(0n)]);
const publicKey = z.string().min(32).max(64);
const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const performanceSampleSchema = z.object({
  numNonVoteTransactions: safeNonNegativeInteger,
  numSlots: z.number().int().positive(),
  numTransactions: safeNonNegativeInteger,
  samplePeriodSecs: positive.min(30).max(90),
  slot: safeNonNegativeInteger
}).strict().refine((value) => value.numNonVoteTransactions <= value.numTransactions, "Non-vote transactions exceed total transactions");

export const performanceSamplesSchema = z.array(performanceSampleSchema).min(1).superRefine((samples, context) => {
  for (let index = 1; index < samples.length; index += 1) {
    if (samples[index - 1].slot <= samples[index].slot) {
      context.addIssue({ code: "custom", message: "Performance samples must have unique descending slots", path: [index, "slot"] });
    }
  }
});

export const epochInfoSchema = z.object({
  absoluteSlot: safeNonNegativeInteger,
  blockHeight: safeNonNegativeInteger,
  epoch: safeNonNegativeInteger,
  slotIndex: safeNonNegativeInteger,
  slotsInEpoch: z.number().int().positive()
}).refine((value) => value.slotIndex <= value.slotsInEpoch, "slotIndex exceeds slotsInEpoch");

export const voteAccountSchema = z.object({
  activatedStake: providerInteger,
  commission: z.number().int().min(0).max(100),
  epochVoteAccount: z.boolean(),
  lastVote: safeNonNegativeInteger,
  nodePubkey: publicKey,
  rootSlot: safeNonNegativeInteger,
  votePubkey: publicKey
});

export const voteAccountsSchema = z.object({
  current: z.array(voteAccountSchema),
  delinquent: z.array(voteAccountSchema)
});

export const blockSlotsSchema = z.array(safeNonNegativeInteger).superRefine((slots, context) => {
  for (let index = 1; index < slots.length; index += 1) {
    if (slots[index - 1] >= slots[index]) {
      context.addIssue({ code: "custom", message: "Produced block slots must be unique and ascending", path: [index] });
    }
  }
});

export const blockSchema = z.object({
  blockTime: z.number().int().nullable().optional(),
  transactions: z.array(z.object({
    meta: z.object({ fee: safeNonNegativeInteger }).nullable()
  })).min(1)
});

const coinPointSchema = z.object({ timestamp: safeNonNegativeInteger, price: positive });
const coinSchema = z.object({
  symbol: z.literal("SOL"),
  confidence: nonNegative.optional(),
  timestamp: safeNonNegativeInteger.optional(),
  price: positive.optional(),
  prices: z.array(coinPointSchema).min(2).optional()
});

export const defiLlamaCurrentPriceSchema = z.object({
  coins: z.object({ "coingecko:solana": coinSchema.refine((coin) => coin.timestamp !== undefined && coin.price !== undefined) })
});

export const defiLlamaPriceChartSchema = z.object({
  coins: z.object({ "coingecko:solana": coinSchema.refine((coin) => Array.isArray(coin.prices)) })
});

export const coinGeckoPriceSchema = z.object({
  solana: z.object({
    usd: positive,
    usd_24h_change: finite,
    last_updated_at: safeNonNegativeInteger
  })
});

export const coinGeckoChartSchema = z.object({
  prices: z.array(z.tuple([safeNonNegativeInteger, positive])).min(2)
});

export const tvlHistorySchema = z.array(z.object({
  date: safeNonNegativeInteger,
  tvl: nonNegative
})).min(2);

const pegMap = z.record(z.string(), nonNegative);
export const stablecoinHistorySchema = z.array(z.object({
  date: z.union([z.string().regex(/^\d+$/), safeNonNegativeInteger]),
  totalCirculatingUSD: pegMap
})).min(2);

export const dexOverviewSchema = z.object({
  chain: z.literal("Solana"),
  totalDataChart: z.array(z.tuple([safeNonNegativeInteger, nonNegative])).min(2),
  total24h: nonNegative.optional(),
  total48hto24h: nonNegative.optional()
});

export const solanaDataSchema = z.object({
  generatedAt: z.string().datetime({ offset: true }),
  rows: z.array(z.object({
    date: dateKey,
    metricName: z.string().min(1),
    unit: z.string().min(1),
    providerName: z.string().min(1),
    value: nonNegative
  })).min(1)
});

export const jitoDailySchema = z.array(z.object({
  day: z.string().min(10),
  jito_tips: nonNegative,
  validator_tips: nonNegative
})).min(1);

const tokensMetricsSourceSchema = z.string().min(1).max(100);
const nullableNonNegative = nonNegative.nullable();
const tokensMarketSchema = z.object({
  source: tokensMetricsSourceSchema.optional(),
  metricsSource: tokensMetricsSourceSchema.optional(),
  volume24hUSD: nullableNonNegative,
  marketCap: nullableNonNegative,
  asOf: safeNonNegativeInteger.nullable().optional(),
  lastFetchedAt: safeNonNegativeInteger.nullable()
});

export const tokensCuratedAssetsSchema = z.object({
  listId: z.enum(["rwas", "stocks", "etfs", "metals"]),
  primaryVariantStrategy: z.enum(["liquidity", "execution_quality", "stock_redeemability"]),
  stale: z.boolean().nullable().optional(),
  pagination: z.object({
    offset: safeNonNegativeInteger,
    limit: z.number().int().min(1).max(500),
    total: safeNonNegativeInteger,
    hasMore: z.boolean(),
    nextOffset: safeNonNegativeInteger.nullable()
  }).strict(),
  assets: z.array(z.object({
    assetId: z.string().min(1).max(200),
    name: z.string().trim().min(1).max(300),
    symbol: z.string().trim().min(1).max(100),
    category: z.string().min(1).max(100),
    stats: z.object({
      volume24hUSD: nullableNonNegative,
      volume30dUSD: nullableNonNegative,
      marketCap: nullableNonNegative
    }).nullable(),
    primaryVariant: z.object({
      mint: publicKey,
      market: tokensMarketSchema.nullable()
    }).nullable()
  })).max(500)
}).strict();
