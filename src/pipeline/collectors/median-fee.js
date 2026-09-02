import { blockSchema, blockSlotsSchema } from "../contracts/providers.js";
import { PipelineError } from "../lib/errors.js";
import { appendHistory } from "../lib/history.js";
import { median } from "../lib/statistics.js";
import { isoTimestamp } from "../lib/time.js";

function stratifiedSlots(slots, count) {
  if (slots.length < count) throw new PipelineError("INSUFFICIENT_PRODUCED_BLOCKS", `Expected at least ${count} produced blocks`);
  return Array.from({ length: count }, (_, index) => slots[Math.min(
    slots.length - 1,
    Math.floor((index + 0.5) * slots.length / count)
  )]);
}

export async function collectMedianFee(context, previousHistory) {
  const { rpc, config, now } = context;
  const endSlot = await rpc.call("getSlot", [{ commitment: config.rpc.commitment }], {
    timeoutMs: config.http.ordinaryTimeoutMs,
    maxBytes: config.http.maxBytes.ordinary
  });
  if (!Number.isSafeInteger(endSlot) || endSlot < config.rpc.feeWindowSlots) {
    throw new PipelineError("INVALID_FINALIZED_SLOT", "RPC returned an invalid finalized slot");
  }
  const startSlot = endSlot - config.rpc.feeWindowSlots;
  const produced = blockSlotsSchema.parse(await rpc.call("getBlocks", [
    startSlot,
    endSlot,
    { commitment: config.rpc.commitment }
  ], {
    timeoutMs: config.http.blockTimeoutMs,
    maxBytes: config.http.maxBytes.ordinary
  }));
  const selected = stratifiedSlots(produced, config.rpc.feeSampleBlocks);
  const blocks = [];
  for (let offset = 0; offset < selected.length; offset += config.rpc.feeBlockBatchSize) {
    const batchSlots = selected.slice(offset, offset + config.rpc.feeBlockBatchSize);
    const result = await rpc.batch(batchSlots.map((slot, index) => ({
      key: `block-${offset + index}`,
      method: "getBlock",
      params: [slot, {
        commitment: config.rpc.commitment,
        encoding: "json",
        transactionDetails: "accounts",
        rewards: false,
        maxSupportedTransactionVersion: 0
      }]
    })), {
      timeoutMs: config.http.blockTimeoutMs,
      maxBytes: config.http.maxBytes.rpcBlockBatch,
      attempts: 3
    });
    for (let index = 0; index < batchSlots.length; index += 1) {
      const outcome = result[`block-${offset + index}`];
      if (!outcome) {
        throw new PipelineError("INCOMPLETE_FEE_BLOCK_SAMPLE", `Selected block ${batchSlots[index]} was unavailable`, { retryable: true });
      }
      if (!outcome.ok) throw outcome.error;
      if (outcome.value === null) {
        throw new PipelineError("INCOMPLETE_FEE_BLOCK_SAMPLE", `Selected block ${batchSlots[index]} was unavailable`, { retryable: true });
      }
      blocks.push(blockSchema.parse(outcome.value));
    }
  }
  const fees = [];
  for (const block of blocks) {
    for (const transaction of block.transactions) {
      if (!transaction.meta) throw new PipelineError("MISSING_TRANSACTION_META", "A sampled finalized transaction has no metadata");
      fees.push(transaction.meta.fee);
    }
  }
  if (fees.length === 0) throw new PipelineError("EMPTY_FEE_SAMPLE", "Selected blocks contain no transaction fees");
  const observedAt = isoTimestamp(now);
  const medianLamports = median(fees, "transaction fees");
  const historyPoint = { observedAt, medianLamports, transactionCount: fees.length, selectedBlockCount: selected.length };
  return {
    status: "fresh",
    observedAt,
    sourceIds: ["solanaRpc"],
    unit: "lamports",
    medianLamports,
    sample: {
      commitment: "finalized",
      startSlot: String(startSlot),
      endSlot: String(endSlot),
      producedSlotCount: produced.length,
      selectedBlockCount: selected.length,
      transactionCount: fees.length,
      approximateWindowSeconds: Math.round(config.rpc.feeWindowSlots * 0.4)
    },
    history: appendHistory(previousHistory, historyPoint, {
      key: (point) => point.observedAt,
      limit: config.history.hourlyPoints
    })
  };
}
