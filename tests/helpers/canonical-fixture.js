export function canonicalFixture() {
  const observedAt = "2026-08-20T00:00:00.000Z";
  const validatorRows = [
    {
      rank: 1,
      votePubkey: "11111111111111111111111111111111111111111111",
      nodePubkey: "22222222222222222222222222222222222222222222",
      status: "active",
      activatedStakeLamports: "100",
      stakeSharePct: 90.909090909,
      commissionPct: 5
    },
    {
      rank: 2,
      votePubkey: "33333333333333333333333333333333333333333333",
      nodePubkey: "44444444444444444444444444444444444444444444",
      status: "delinquent",
      activatedStakeLamports: "10",
      stakeSharePct: 9.0909090909,
      commissionPct: 10
    }
  ];
  const domain = { status: "fresh", observedAt, sourceIds: ["solanaRpc"] };

  return {
    schemaVersion: "1.4.0",
    methodologyVersion: "1.4.0",
    updatedAt: observedAt,
    updateStatus: "complete",
    sources: {
      solanaRpc: {
        name: "Test source",
        url: "https://example.com/source",
        status: "fresh",
        lastAttemptAt: observedAt,
        lastSuccessAt: observedAt,
        nextDueAt: "2026-08-20T01:00:00.000Z",
        dataThrough: observedAt
      },
      tokensXyz: {
        name: "Tokens.xyz Curated Markets",
        url: "https://www.tokens.xyz/api/v1/assets/curated",
        status: "fresh",
        lastAttemptAt: observedAt,
        lastSuccessAt: observedAt,
        nextDueAt: "2026-08-20T06:00:00.000Z",
        dataThrough: observedAt
      }
    },
    network: {
      performance: {
        ...domain,
        sample: { count: 5, windowSeconds: 300, endingSlot: "1000" },
        tps: { total: 3_000, nonVote: 2_000 },
        slotTimeMs: 405,
        history: [{ observedAt, totalTps: 3_000, nonVoteTps: 2_000, slotTimeMs: 405 }]
      },
      chain: {
        ...domain,
        commitment: "finalized",
        slot: "1000",
        blockHeight: "900",
        epoch: { number: 10, slotIndex: 50, slotsInEpoch: 100, progressPct: 50 }
      }
    },
    validators: {
      ...domain,
      delinquencyDistanceSlots: 128,
      counts: { active: 1, delinquent: 1, total: 2 },
      stake: {
        activeLamports: "100",
        delinquentLamports: "10",
        totalLamports: "110",
        delinquentPct: 9.0909090909,
        top10Pct: 100,
        distribution: [
          { label: "Top 1", votePubkey: validatorRows[0].votePubkey, stakeLamports: "100", sharePct: 90.909090909, status: "active" },
          { label: "Top 2", votePubkey: validatorRows[1].votePubkey, stakeLamports: "10", sharePct: 9.0909090909, status: "delinquent" }
        ]
      },
      top: validatorRows,
      table: validatorRows,
      commissionChanges: [],
      history: [{ observedAt, activeCount: 1, delinquentCount: 1, totalStakeLamports: "110", delinquentStakeLamports: "10", delinquentStakePct: 9.0909090909 }]
    },
    economics: {
      solPrice: {
        ...domain,
        currency: "USD",
        currentUsd: 100,
        change24hPct: 5.2631578947,
        reference24h: { observedAt: "2026-08-19T00:00:00.000Z", priceUsd: 95, elapsedSeconds: 86_400 },
        confidence: 0.99,
        history: [
          { observedAt: "2026-08-19T00:00:00.000Z", priceUsd: 95 },
          { observedAt, priceUsd: 100 }
        ]
      },
      tvlAlertInput: {
        ...domain,
        currency: "USD",
        latest: { date: "2026-08-19", valueUsd: 5_000 },
        previous: { date: "2026-08-18", valueUsd: 4_500 },
        change1dPct: 11.1111111111,
        history: [
          { date: "2026-08-18", valueUsd: 4_500 },
          { date: "2026-08-19", valueUsd: 5_000 }
        ]
      },
      stablecoinSupply: {
        ...domain,
        currency: "USD",
        date: "2026-08-19",
        totalCirculatingUsd: 10_000,
        history: [
          { date: "2026-08-18", totalCirculatingUsd: 9_900 },
          { date: "2026-08-19", totalCirculatingUsd: 10_000 }
        ]
      },
      dexVolume: {
        ...domain,
        currency: "USD",
        date: "2026-08-19",
        dailyVolumeUsd: 2_000,
        history: [
          { date: "2026-08-18", dailyVolumeUsd: 1_900 },
          { date: "2026-08-19", dailyVolumeUsd: 2_000 }
        ]
      },
      rev: {
        ...domain,
        unit: "SOL",
        date: "2026-08-18",
        totalSol: 1_100,
        components: { transactionFeesSol: 1_000, grossJitoTipsSol: 100 },
        feeConsensus: {
          method: "median",
          providers: [{ name: "Allium", valueSol: 990 }, { name: "Dune", valueSol: 1_010 }],
          minSol: 990,
          maxSol: 1_010
        },
        history: [{ date: "2026-08-18", totalSol: 1_100, transactionFeesSol: 1_000, grossJitoTipsSol: 100, feeProviderCount: 2, feeProviderMinSol: 990, feeProviderMaxSol: 1_010 }]
      },
      medianTransactionFee: {
        ...domain,
        unit: "lamports",
        medianLamports: 5_000,
        sample: { commitment: "finalized", startSlot: "1", endSlot: "9001", producedSlotCount: 8_000, selectedBlockCount: 16, transactionCount: 10_000, approximateWindowSeconds: 3_600 },
        history: [{ observedAt, medianLamports: 5_000, transactionCount: 10_000, selectedBlockCount: 16 }]
      }
    },
    ecosystem: {
      tokenizedAssets: {
        ...domain,
        sourceIds: ["tokensXyz"],
        methodology: "tokens_xyz_spot_volume_v1",
        currency: "USD",
        windowDays: 30,
        curatedLists: ["rwas", "stocks", "etfs", "metals"],
        acceptedMetricsSources: ["birdeye", "clickhouse_trades"],
        totalSpotVolume30dUsd: 3_000,
        equitySpotVolume30dUsd: 2_000,
        indexedAssetCount: 10,
        indexedEquityCount: 4,
        coveredAssetCount: 8,
        coveredEquityCount: 3,
        provenanceCoverage: { rwaXyzExcludedCount: 1, unknownSourceExcludedCount: 1, missingVolumeExcludedCount: 0 },
        listCoverage: { rwas: 2, stocks: 4, etfs: 2, metals: 2 },
        categoryBreakdown: [
          { id: "equities", indexedAssetCount: 4, coveredAssetCount: 3, spotVolume30dUsd: 2_000 },
          { id: "funds", indexedAssetCount: 2, coveredAssetCount: 2, spotVolume30dUsd: 500 },
          { id: "commodities", indexedAssetCount: 2, coveredAssetCount: 1, spotVolume30dUsd: 300 },
          { id: "other-rwa", indexedAssetCount: 2, coveredAssetCount: 2, spotVolume30dUsd: 200 }
        ],
        topAssets: [
          { rank: 1, assetId: "equity-1", name: "Equity One", symbol: "EQ1", categoryGroup: "equities", spotVolume30dUsd: 900, metricsSource: "birdeye" },
          { rank: 2, assetId: "equity-2", name: "Equity Two", symbol: "EQ2", categoryGroup: "equities", spotVolume30dUsd: 700, metricsSource: "clickhouse_trades" },
          { rank: 3, assetId: "equity-3", name: "Equity Three", symbol: "EQ3", categoryGroup: "equities", spotVolume30dUsd: 400, metricsSource: "birdeye" },
          { rank: 4, assetId: "commodity-1", name: "Commodity One", symbol: "CMD1", categoryGroup: "commodities", spotVolume30dUsd: 300, metricsSource: "birdeye" },
          { rank: 5, assetId: "fund-1", name: "Fund One", symbol: "FND1", categoryGroup: "funds", spotVolume30dUsd: 300, metricsSource: "clickhouse_trades" },
          { rank: 6, assetId: "fund-2", name: "Fund Two", symbol: "FND2", categoryGroup: "funds", spotVolume30dUsd: 200, metricsSource: "birdeye" },
          { rank: 7, assetId: "other-1", name: "Other One", symbol: "OTH1", categoryGroup: "other-rwa", spotVolume30dUsd: 150, metricsSource: "birdeye" },
          { rank: 8, assetId: "other-2", name: "Other Two", symbol: "OTH2", categoryGroup: "other-rwa", spotVolume30dUsd: 50, metricsSource: "clickhouse_trades" }
        ],
        history: [{
          observedAt,
          totalSpotVolume30dUsd: 3_000,
          equitySpotVolume30dUsd: 2_000,
          indexedAssetCount: 10,
          indexedEquityCount: 4,
          coveredAssetCount: 8,
          coveredEquityCount: 3
        }],
        legacyTransferVolume: {
          sourceName: "RWA.xyz Solana Network",
          sourceUrl: "https://app.rwa.xyz/networks/solana",
          methodology: "rwa_xyz_trailing_30d_transfer_volume",
          currency: "USD",
          windowDays: 30,
          endedAt: "2026-08-19T00:00:00.000Z",
          history: [{ observedAt: "2026-08-19T00:00:00.000Z", totalTransferVolumeUsd: 2_900, equityTransferVolumeUsd: 1_900 }]
        }
      },
      dailyActiveAddresses: {
        ...domain,
        date: "2026-08-18",
        value: 2_000_100,
        consensusMethod: "median",
        providers: [{ name: "Allium", value: 2_000_000 }, { name: "Dune", value: 2_000_200 }],
        history: [{ date: "2026-08-18", value: 2_000_100, allium: 2_000_000, dune: 2_000_200 }]
      },
      news: {
        ...domain,
        feedUpdatedAt: observedAt,
        items: [{ id: "news-1", title: "Test news", url: "https://example.com/news", publishedAt: observedAt, description: "Source description." }]
      },
      upgrades: {
        ...domain,
        items: [{
          id: "alpenglow",
          title: "Alpenglow",
          subtitle: "Faster consensus",
          url: "https://solana.com/upgrades/alpenglow",
          stage: "in_development",
          stageLabel: "In Development",
          releaseId: "agave-4-3",
          releaseLabel: "Agave 4.3",
          metrics: [{ value: "150ms", label: "Target finality" }],
          simds: [{ id: "0326", title: "SIMD-0326", url: "https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0326-alpenglow.md" }]
        }]
      }
    },
    alertChecks: [
      { id: "tps-change", kind: "tps_change", status: "normal", metricPath: "network.performance.tps.total", unit: "TPS", window: "two adjacent five-minute bins vs prior hour", threshold: { relativePct: 30, absoluteTps: 500 }, observedAt, currentValue: 3_000, referenceValue: 2_900, changePct: 3.448 },
      { id: "slow-slot-time", kind: "slow_slot_time", status: "normal", metricPath: "network.performance.slotTimeMs", unit: "ms", window: "two adjacent five-minute bins vs prior hour", threshold: { relativePct: 50, absoluteMs: 75 }, observedAt, currentValue: 405, referenceValue: 400, changePct: 1.25 },
      { id: "high-validator-delinquency", kind: "validator_delinquency", status: "normal", metricPath: "validators.stake.delinquentPct", unit: "% activated stake", window: "two fresh scheduled observations", threshold: { percent: 5, confirmations: 2 }, observedAt, currentValue: 9.0909 },
      { id: "large-tvl-change", kind: "tvl_change", status: "normal", metricPath: "economics.tvlAlertInput.change1dPct", unit: "%", window: "adjacent completed UTC days", threshold: { absolutePct: 10 }, observedAt, currentValue: 11.1111 },
      { id: "large-sol-price-move", kind: "sol_price_move", status: "normal", metricPath: "economics.solPrice.change24hPct", unit: "%", window: "24 hours", threshold: { absolutePct: 10 }, observedAt, currentValue: 5.2632 }
    ],
    alerts: []
  };
}

export function previousTokensCanonicalFixture() {
  const fixture = canonicalFixture();
  fixture.schemaVersion = "1.3.0";
  fixture.methodologyVersion = "1.3.0";
  delete fixture.ecosystem.tokenizedAssets.categoryBreakdown;
  delete fixture.ecosystem.tokenizedAssets.topAssets;
  return fixture;
}

export function legacyCanonicalFixture(version = "1.2.0") {
  const fixture = canonicalFixture();
  const active = fixture.ecosystem.tokenizedAssets;
  const legacy = active.legacyTransferVolume;
  fixture.schemaVersion = version;
  fixture.methodologyVersion = version;
  fixture.ecosystem.tokenizedAssets = {
    status: "fresh",
    observedAt: legacy.endedAt,
    sourceIds: ["rwa"],
    currency: "USD",
    windowDays: 30,
    totalTransferVolumeUsd: legacy.history.at(-1).totalTransferVolumeUsd,
    equityTransferVolumeUsd: legacy.history.at(-1).equityTransferVolumeUsd,
    history: legacy.history
  };
  const tokensSource = fixture.sources.tokensXyz;
  delete fixture.sources.tokensXyz;
  fixture.sources.rwa = {
    ...tokensSource,
    name: "RWA.xyz Solana Network",
    url: "https://app.rwa.xyz/networks/solana",
    dataThrough: legacy.endedAt
  };
  return fixture;
}
