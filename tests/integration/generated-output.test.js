import assert from "node:assert/strict";
import test from "node:test";
import { validateOutputs } from "../../src/pipeline/validate-output.js";

test("checked-in generated outputs satisfy the public contract", async () => {
  const result = await validateOutputs();
  assert.equal(result.snapshot.validators.table.length, result.snapshot.validators.counts.total);
  assert.ok(result.snapshot.ecosystem.upgrades.items.some((item) => item.id === "alpenglow"));
  assert.ok(result.snapshot.ecosystem.upgrades.items.some((item) => item.simds.some((simd) => simd.id === "0525")));
  assert.ok(result.dataBytes < 2 * 1024 * 1024);
});
