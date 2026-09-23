#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createConfig } from "../src/pipeline/config.js";
import { parsePreviousCanonicalSnapshot } from "../src/pipeline/contracts/canonical.js";
import { nearlyEqual } from "../src/pipeline/lib/numbers.js";
import { publishOutputs } from "../src/pipeline/outputs/publish.js";
import { renderReport } from "../src/pipeline/outputs/report.js";
import { postProcessSnapshot } from "../src/pipeline/post-process.js";

const RECOVERY_RESULTS_PATH = "scripts/history-gap-recovery-results.json";

function recoveredNetworkPoints(results) {
  if (results?.method !== "getRecentPerformanceSamples" || !Array.isArray(results.repairs)) {
    throw new Error("Invalid performance-sample recovery evidence");
  }
  return results.repairs.map(({ point, evidence }) => {
    const samples = evidence?.samples;
    if (!Array.isArray(samples) || samples.length !== evidence.sampleCount || samples.length !== 5) {
      throw new Error(`Recovered point ${point?.observedAt || "unknown"} does not have five samples`);
    }
    const seconds = samples.reduce((sum, sample) => sum + sample.samplePeriodSecs, 0);
    const slots = samples.reduce((sum, sample) => sum + sample.numSlots, 0);
    const totalTps = samples.reduce((sum, sample) => sum + sample.numTransactions, 0) / seconds;
    const nonVoteTps = samples.reduce((sum, sample) => sum + sample.numNonVoteTransactions, 0) / seconds;
    const slotTimeMs = seconds * 1_000 / slots;
    if (
      evidence.endingSlot !== String(samples[0].slot)
      || evidence.windowSeconds !== seconds
      || !nearlyEqual(point.totalTps, totalTps)
      || !nearlyEqual(point.nonVoteTps, nonVoteTps)
      || !nearlyEqual(point.slotTimeMs, slotTimeMs)
    ) throw new Error(`Recovered point ${point.observedAt} does not match its RPC evidence`);
    return point;
  });
}

export async function repairSnapshotGaps(options = {}) {
  const root = options.root || process.cwd();
  const config = options.config || createConfig({});
  const previous = options.snapshot || parsePreviousCanonicalSnapshot(
    JSON.parse(await readFile(resolve(root, config.output.dataPath), "utf8")),
    config.history
  );
  const evidence = options.evidence || JSON.parse(await readFile(resolve(root, RECOVERY_RESULTS_PATH), "utf8"));
  const candidate = {
    ...previous,
    schemaVersion: config.schemaVersion,
    methodologyVersion: config.methodologyVersion
  };
  // This is a historical repair, not a live collection. Preserve updatedAt,
  // domain observations, source health, current values, and alert evidence.
  const processed = await postProcessSnapshot(candidate, {
    config,
    context: "manual_history_repair",
    notify: options.notify,
    recoveredNetworkPoints: recoveredNetworkPoints(evidence)
  });
  const snapshot = processed.snapshot;
  const published = await publishOutputs(snapshot, renderReport(snapshot), config, {
    root,
    dryRun: options.write !== true
  });
  return { snapshot, summary: processed.autoRepair.summary, published, autoRepair: processed.autoRepair };
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  try {
    const args = process.argv.slice(2);
    if (args.some((argument) => argument !== "--write")) throw new Error("Only --write is supported");
    const result = await repairSnapshotGaps({ write: args.includes("--write") });
    console.log(JSON.stringify({
      updatedAt: result.snapshot.updatedAt,
      summary: result.summary,
      autoRepairs: result.autoRepair.repairs,
      dataBytes: result.published.bytes,
      written: result.published.written
    }));
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
