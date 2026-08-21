import { epochInfoSchema, performanceSamplesSchema, voteAccountsSchema } from "../contracts/providers.js";
import { PipelineError } from "../lib/errors.js";
import { asPipelineError } from "../lib/errors.js";

export async function collectSolanaCore(context) {
  const { rpc, config } = context;
  const outcomes = await rpc.batch([
    { key: "performance", method: "getRecentPerformanceSamples", params: [config.rpc.performanceSampleCount] },
    { key: "epoch", method: "getEpochInfo", params: [{ commitment: config.rpc.commitment }] },
    {
      key: "validators",
      method: "getVoteAccounts",
      params: [{
        commitment: config.rpc.commitment,
        keepUnstakedDelinquents: false,
        delinquentSlotDistance: config.rpc.delinquencyDistanceSlots
      }]
    }
  ], {
    timeoutMs: config.http.ordinaryTimeoutMs,
    maxBytes: config.http.maxBytes.ordinary
  });

  const parse = (key, schema) => {
    const outcome = outcomes[key];
    if (!outcome?.ok) return { ok: false, error: outcome?.error || new PipelineError("MISSING_RPC_DOMAIN", `RPC omitted ${key}`) };
    try {
      return { ok: true, value: schema.parse(outcome.value) };
    } catch (error) {
      return { ok: false, error: asPipelineError(error, { code: "INVALID_RPC_DOMAIN", message: `RPC ${key} result failed its contract`, sourceId: "solanaRpc" }) };
    }
  };
  return {
    performance: parse("performance", performanceSamplesSchema),
    epoch: parse("epoch", epochInfoSchema),
    validators: parse("validators", voteAccountsSchema)
  };
}
