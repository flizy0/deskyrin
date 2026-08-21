#!/usr/bin/env node
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createConfig } from "./config.js";
import { parseCanonicalSnapshot } from "./contracts/canonical.js";
import { renderReport } from "./outputs/report.js";

export async function validateOutputs(root = process.cwd(), config = createConfig({})) {
  const dataPath = resolve(root, config.output.dataPath);
  const reportPath = resolve(root, config.output.reportPath);
  const [dataText, report, dataStat] = await Promise.all([
    readFile(dataPath, "utf8"),
    readFile(reportPath, "utf8"),
    stat(dataPath)
  ]);
  if (dataStat.size > config.output.maxDataBytes) throw new Error(`data.json exceeds ${config.output.maxDataBytes} bytes`);
  const snapshot = parseCanonicalSnapshot(JSON.parse(dataText), config.history);
  const expectedReport = `${renderReport(snapshot).trimEnd()}\n`;
  if (report !== expectedReport) throw new Error("report.md is not the exact deterministic rendering of data.json");
  return { snapshot, dataBytes: dataStat.size, reportBytes: Buffer.byteLength(report) };
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  try {
    const result = await validateOutputs();
    console.log(JSON.stringify({ updatedAt: result.snapshot.updatedAt, status: result.snapshot.updateStatus, dataBytes: result.dataBytes, reportBytes: result.reportBytes }));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
