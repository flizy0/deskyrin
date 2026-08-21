import { mkdir, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { PipelineError } from "../lib/errors.js";
import { serializeCanonicalSnapshot } from "../contracts/canonical.js";

function requiredReportChecks(report, snapshot) {
  const headings = ["Network Performance", "Validator Status", "Economic Indicators", "Ecosystem Growth", "Alerts / notable changes"];
  if (!report.includes(snapshot.updatedAt) || headings.some((heading) => !report.includes(`## ${heading}`))) {
    throw new PipelineError("INVALID_REPORT", "Generated report is missing a required heading or timestamp");
  }
}

export async function publishOutputs(snapshot, report, config, options = {}) {
  const json = serializeCanonicalSnapshot(snapshot, config.history);
  const bytes = Buffer.byteLength(json);
  if (bytes > config.output.maxDataBytes) {
    throw new PipelineError("OUTPUT_TOO_LARGE", `data.json is ${bytes} bytes; limit is ${config.output.maxDataBytes}`);
  }
  requiredReportChecks(report, snapshot);
  if (options.dryRun) return { bytes, reportBytes: Buffer.byteLength(report), written: false };

  const dataPath = resolve(options.root || process.cwd(), config.output.dataPath);
  const reportPath = resolve(options.root || process.cwd(), config.output.reportPath);
  await mkdir(dirname(dataPath), { recursive: true });
  const suffix = `${process.pid}-${Date.now()}`;
  const dataTemp = `${dataPath}.${suffix}.tmp`;
  const reportTemp = `${reportPath}.${suffix}.tmp`;
  try {
    const writes = await Promise.allSettled([
      writeFile(dataTemp, json, { encoding: "utf8", flag: "wx" }),
      writeFile(reportTemp, `${report.trimEnd()}\n`, { encoding: "utf8", flag: "wx" })
    ]);
    const failedWrite = writes.find((result) => result.status === "rejected");
    if (failedWrite) throw failedWrite.reason;
    await rename(reportTemp, reportPath);
    await rename(dataTemp, dataPath);
  } catch (error) {
    await Promise.allSettled([unlink(dataTemp), unlink(reportTemp)]);
    throw error;
  }
  return { bytes, reportBytes: Buffer.byteLength(report), written: true };
}
