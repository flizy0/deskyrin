#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createConfig } from "../src/pipeline/config.js";
import { parseCanonicalSnapshot } from "../src/pipeline/contracts/canonical.js";
import { publishOutputs } from "../src/pipeline/outputs/publish.js";
import { renderReport } from "../src/pipeline/outputs/report.js";
import { postProcessSnapshot } from "../src/pipeline/post-process.js";

export async function pruneSnapshotHistory(options = {}) {
  const root = options.root || process.cwd();
  const config = options.config || createConfig({});
  const previous = options.snapshot || parseCanonicalSnapshot(
    JSON.parse(await readFile(resolve(root, config.output.dataPath), "utf8")), config.history
  );
  // This is a retention-only rewrite, not a collection. Preserve observation,
  // publication, and source-health timestamps instead of claiming new data.
  const processed = await postProcessSnapshot(previous, {
    config,
    context: "snapshot_prune",
    notify: options.notify
  });
  const snapshot = processed.snapshot;
  const published = await publishOutputs(snapshot, renderReport(snapshot), config, {
    root, dryRun: options.write !== true
  });
  return { snapshot, published, autoRepair: processed.autoRepair };
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  try {
    const args = process.argv.slice(2);
    if (args.some((argument) => argument !== "--write")) throw new Error("Only --write is supported");
    const result = await pruneSnapshotHistory({ write: args.includes("--write") });
    console.log(JSON.stringify({
      snapshotStartAt: createConfig({}).history.snapshotStartAt,
      updatedAt: result.snapshot.updatedAt,
      autoRepairs: result.autoRepair.repairs,
      dataBytes: result.published.bytes,
      written: result.published.written
    }));
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
