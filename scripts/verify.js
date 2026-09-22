#!/usr/bin/env node
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { validateOutputs } from "../src/pipeline/validate-output.js";

const root = process.cwd();
const requiredFiles = [
  "index.html", "public/data.json", "public/report.md", "public/methodology.md", "README.md", "LICENSE", "docs/methodology.md",
  ".github/workflows/ci.yml", ".github/workflows/update.yml", ".github/workflows/freshness.yml",
  "scripts/check-public-freshness.js", "scripts/check-update-due.js", "vercel.json"
];
for (const file of requiredFiles) await access(resolve(root, file));

let built = true;
try {
  await access(resolve(root, "dist/index.html"));
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
  built = false;
}
if (built) {
  for (const file of ["dist/data.json", "dist/report.md", "dist/methodology.md"]) await access(resolve(root, file));
}

const methodology = await readFile(resolve(root, "docs/methodology.md"), "utf8");
const publicMethodology = await readFile(resolve(root, "public/methodology.md"), "utf8");
if (methodology !== publicMethodology) throw new Error("Published methodology copy is out of sync");

const workflowRequirements = new Map([
  [".github/workflows/update.yml", [
    "cron: \"3,13,23,33,43,53 * * * *\"",
    "workflow_dispatch:",
    "node scripts/check-update-due.js",
    "steps.due.outputs.due == 'true'",
    "cancel-in-progress: false"
  ]],
  [".github/workflows/freshness.yml", [
    "cron: \"7,37 * * * *\"",
    "actions: write",
    "MAX_DATA_AGE_MINUTES: ${{ vars.MAX_DATA_AGE_MINUTES || '75' }}",
    "continue-on-error: true",
    "gh workflow run update.yml"
  ]]
]);
for (const [file, fragments] of workflowRequirements) {
  const workflow = await readFile(resolve(root, file), "utf8");
  for (const fragment of fragments) {
    if (!workflow.includes(fragment)) throw new Error(`${file} is missing recovery invariant: ${fragment}`);
  }
}

const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
const forbidden = ["next", "express", "@vercel/blob", "@vercel/kv", "postgres", "pg", "redis", "@supabase/supabase-js"];
const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
for (const name of forbidden) if (dependencies[name]) throw new Error(`Forbidden unnecessary dependency: ${name}`);

const vercel = JSON.parse(await readFile(resolve(root, "vercel.json"), "utf8"));
if (vercel.functions || vercel.crons) throw new Error("Vercel configuration must remain static-only");
const result = await validateOutputs(root);
console.log(JSON.stringify({ verified: true, schemaVersion: result.snapshot.schemaVersion, updateStatus: result.snapshot.updateStatus, dataBytes: result.dataBytes }));
