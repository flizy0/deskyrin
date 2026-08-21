import { PipelineError } from "../lib/errors.js";
import { appendHistory } from "../lib/history.js";
import { durationWeightedRate, median, slotIntervalMs } from "../lib/statistics.js";
import { isoTimestamp } from "../lib/time.js";

function aggregate(samples) {
  const total = durationWeightedRate(samples, "numTransactions");
  const nonVote = durationWeightedRate(samples, "numNonVoteTransactions");
  const slot = slotIntervalMs(samples);
  return {
    totalTps: total.value,
    nonVoteTps: nonVote.value,
    slotTimeMs: slot.value,
    seconds: total.duration
  };
}

function bins(samples, size) {
  const result = [];
  for (let index = 0; index + size <= samples.length; index += size) {
    result.push(aggregate(samples.slice(index, index + size)));
  }
  return result;
}

export function calculateNetworkPerformance(samples, now, previousHistory, config) {
  const required = Math.max(
    config.rpc.headlineSampleCount,
    config.rpc.alertRecentBinSamples * 2 + config.rpc.alertBaselineSamples
  );
  if (samples.length < required) {
    throw new PipelineError("INSUFFICIENT_PERFORMANCE_SAMPLES", `Expected at least ${required} complete performance samples`);
  }
  const observedAt = isoTimestamp(now);
  const headlineSamples = samples.slice(0, config.rpc.headlineSampleCount);
  const headline = aggregate(headlineSamples);
  const historyPoint = {
    observedAt,
    totalTps: headline.totalTps,
    nonVoteTps: headline.nonVoteTps,
    slotTimeMs: headline.slotTimeMs
  };

  const recentSize = config.rpc.alertRecentBinSamples;
  const recentBins = bins(samples.slice(0, recentSize * 2), recentSize);
  const baselineBins = bins(
    samples.slice(recentSize * 2, recentSize * 2 + config.rpc.alertBaselineSamples),
    recentSize
  );
  const evidence = {
    observedAt,
    recent: recentBins,
    baseline: {
      totalTps: median(baselineBins.map((point) => point.totalTps), "TPS baseline bins"),
      slotTimeMs: median(baselineBins.map((point) => point.slotTimeMs), "slot-time baseline bins")
    }
  };

  return {
    domain: {
      status: "fresh",
      observedAt,
      sourceIds: ["solanaRpc"],
      sample: {
        count: headlineSamples.length,
        windowSeconds: headline.seconds,
        endingSlot: String(headlineSamples[0].slot)
      },
      tps: { total: headline.totalTps, nonVote: headline.nonVoteTps },
      slotTimeMs: headline.slotTimeMs,
      history: appendHistory(previousHistory, historyPoint, {
        key: (point) => point.observedAt,
        limit: config.history.hourlyPoints
      })
    },
    evidence
  };
}

export function calculateChainState(epochInfo, now) {
  const observedAt = isoTimestamp(now);
  return {
    status: "fresh",
    observedAt,
    sourceIds: ["solanaRpc"],
    commitment: "finalized",
    slot: String(epochInfo.absoluteSlot),
    blockHeight: String(epochInfo.blockHeight),
    epoch: {
      number: epochInfo.epoch,
      slotIndex: epochInfo.slotIndex,
      slotsInEpoch: epochInfo.slotsInEpoch,
      progressPct: epochInfo.slotIndex / epochInfo.slotsInEpoch * 100
    }
  };
}
