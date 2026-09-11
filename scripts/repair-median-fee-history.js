#!/usr/bin/env node
import { readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { collectMedianFee } from "../src/pipeline/collectors/median-fee.js";
import { createConfig } from "../src/pipeline/config.js";
import { parseCanonicalSnapshot } from "../src/pipeline/contracts/canonical.js";
import { appendHistory } from "../src/pipeline/lib/history.js";
import { createHttpClient } from "../src/pipeline/lib/http.js";
import { createRpcClient } from "../src/pipeline/lib/rpc.js";
import { isoTimestamp, sleep } from "../src/pipeline/lib/time.js";
import { publishOutputs } from "../src/pipeline/outputs/publish.js";
import { renderReport } from "../src/pipeline/outputs/report.js";

const REPAIR_INCIDENT_ID = "median-fee-gap-2026-09-02";
const REPAIR_BLOCK_BATCH_SIZE = 8;
const REPAIR_COOLDOWN_MS = 12_000;
const REPAIR_RESULTS_PATH = "scripts/median-fee-repair-results.json";

export const MEDIAN_FEE_REPAIR_TARGETS = Object.freeze([
  { observedAt: "2026-09-02T02:37:45.476Z", endSlot: 443584078, evidenceCommit: "0a193d8d5f98ecb59117d217ca57b79ac69d1f77" },
  { observedAt: "2026-09-02T04:26:58.364Z", endSlot: 443604894, evidenceCommit: "d1a61b463ba68feccbf81eb0dbb92181d25cfaac" },
  { observedAt: "2026-09-02T05:28:18.229Z", endSlot: 443616609, evidenceCommit: "9907763f4e4bf423c028e3361c322a5f9344499a" },
  { observedAt: "2026-09-02T06:35:04.688Z", endSlot: 443629378, evidenceCommit: "5b0a19ccf6e9f366593c8306aaabdaea7461a56a" },
  { observedAt: "2026-09-02T08:27:07.280Z", endSlot: 443650759, evidenceCommit: "6863009cd958a929f99164cb4a07309c2972ca63" },
  { observedAt: "2026-09-02T09:26:05.648Z", endSlot: 443661999, evidenceCommit: "ac3773f7ab0f3e02dc7913c7917515104089eb15" },
  { observedAt: "2026-09-02T10:26:53.856Z", endSlot: 443673595, evidenceCommit: "d11e6620242548414947357d60f2694a451efa43" },
  { observedAt: "2026-09-02T11:25:11.089Z", endSlot: 443684708, evidenceCommit: "5b6e0069a947fa61f480051d7baee0b11ccbb3d7" }
]);

function rpcAtFinalizedSlot(rpc, endSlot) {
  return Object.freeze({
    call(method, params, requestOptions) {
      return method === "getSlot"
        ? Promise.resolve(endSlot)
        : rpc.call(method, params, requestOptions);
    },
    batch: (requests, requestOptions) => rpc.batch(requests, {
      ...requestOptions,
      attempts: 6,
      retryDelaysMs: [10_000]
    })
  });
}

function cachedRepair(record, target) {
  if (
    record?.target?.observedAt !== target.observedAt
    || record?.target?.endSlot !== target.endSlot
    || record?.target?.evidenceCommit !== target.evidenceCommit
    || record?.point?.observedAt !== target.observedAt
    || !Number.isFinite(record?.point?.medianLamports)
    || !Number.isSafeInteger(record?.point?.transactionCount)
    || record?.point?.selectedBlockCount !== 16
    || record?.sample?.endSlot !== String(target.endSlot)
  ) return undefined;
  return { target, point: record.point, sample: record.sample };
}

async function readRepairResults(root) {
  try {
    const value = JSON.parse(await readFile(resolve(root, REPAIR_RESULTS_PATH), "utf8"));
    return MEDIAN_FEE_REPAIR_TARGETS.flatMap((target) => {
      const record = value?.repairs?.find((repair) => repair?.target?.observedAt === target.observedAt);
      const repair = cachedRepair(record, target);
      return repair ? [repair] : [];
    });
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

async function writeRepairResults(root, repairs) {
  const path = resolve(root, REPAIR_RESULTS_PATH);
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify({ repairs }, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  await rename(temporary, path);
}

async function collectRepair(target, rpc, config) {
  const domain = await collectMedianFee({
    rpc: rpcAtFinalizedSlot(rpc, target.endSlot),
    config,
    now: new Date(target.observedAt)
  }, []);
  const point = domain.history.at(-1);
  if (domain.sample.endSlot !== String(target.endSlot) || point?.observedAt !== target.observedAt) {
    throw new Error(`Median-fee repair did not preserve the recorded anchor for ${target.observedAt}`);
  }
  return { target, point, sample: domain.sample };
}

export function applyMedianFeeRepairs(snapshot, repairs, publishedAt, historyLimit = 720) {
  const repaired = structuredClone(snapshot);
  let history = repaired.economics.medianTransactionFee.history;
  for (const repair of repairs) {
    history = appendHistory(history, repair.point, {
      key: (point) => point.observedAt,
      limit: historyLimit
    });
  }
  repaired.economics.medianTransactionFee.history = history;
  repaired.coverageIncidents = (repaired.coverageIncidents || [])
    .filter((incident) => incident.id !== REPAIR_INCIDENT_ID);
  repaired.updatedAt = isoTimestamp(publishedAt, "repair publication time");
  return repaired;
}

export async function repairMedianFeeHistory(options = {}) {
  const root = options.root || process.cwd();
  const config = options.config || createConfig(process.env);
  const samplingConfig = {
    ...config,
    rpc: { ...config.rpc, feeBlockBatchSize: REPAIR_BLOCK_BATCH_SIZE }
  };
  const snapshot = options.snapshot || parseCanonicalSnapshot(
    JSON.parse(await readFile(resolve(root, config.output.dataPath), "utf8")),
    config.history
  );
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
  const repairs = await readRepairResults(root);
  for (const [index, target] of MEDIAN_FEE_REPAIR_TARGETS.entries()) {
    let repair = repairs.find((candidate) => candidate.target.observedAt === target.observedAt);
    const cached = Boolean(repair);
    if (!repair) {
      repair = await collectRepair(target, rpc, samplingConfig);
      repairs.push(repair);
      repairs.sort((left, right) => left.target.observedAt.localeCompare(right.target.observedAt));
      if (options.write === true) await writeRepairResults(root, repairs);
    }
    options.onProgress?.({ index: index + 1, total: MEDIAN_FEE_REPAIR_TARGETS.length, cached, ...repair });
    if (!cached && index < MEDIAN_FEE_REPAIR_TARGETS.length - 1) await sleep(REPAIR_COOLDOWN_MS);
  }
  const candidate = applyMedianFeeRepairs(
    snapshot,
    repairs,
    options.now || new Date(),
    config.history.hourlyPoints
  );
  const repairedSnapshot = parseCanonicalSnapshot(candidate, config.history);
  const report = renderReport(repairedSnapshot);
  const published = await publishOutputs(repairedSnapshot, report, config, {
    root,
    dryRun: options.write !== true
  });
  return { snapshot: repairedSnapshot, repairs, published };
}

function parseCli(argv) {
  let write = false;
  for (const argument of argv) {
    if (argument === "--write") write = true;
    else throw new Error(`Unknown argument: ${argument}`);
  }
  return { write };
}

async function main() {
  const cli = parseCli(process.argv.slice(2));
  const result = await repairMedianFeeHistory({
    ...cli,
    onProgress({ index, total, cached, target, point, sample }) {
      console.error(JSON.stringify({
        repair: `${index}/${total}`,
        cached,
        observedAt: target.observedAt,
        endSlot: String(target.endSlot),
        medianLamports: point.medianLamports,
        transactionCount: point.transactionCount,
        producedSlotCount: sample.producedSlotCount
      }));
    }
  });
  console.log(JSON.stringify({
    updatedAt: result.snapshot.updatedAt,
    repairedPoints: result.repairs.length,
    dataBytes: result.published.bytes,
    written: result.published.written
  }));
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  try {
    await main();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
