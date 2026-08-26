import assert from "node:assert/strict";
import test from "node:test";

import { resolveRoute, routes } from "../../src/dashboard/router.js";

test("terminal routes and historical aliases resolve deterministically", () => {
  assert.deepEqual(routes.map((route) => route.id), ["overview", "network", "validators", "economy", "ecosystem", "sources"]);
  assert.equal(resolveRoute("#validators").id, "validators");
  assert.equal(resolveRoute("economics").id, "economy");
  assert.equal(resolveRoute("#alerts").id, "overview");
  assert.equal(resolveRoute("#unknown").id, "overview");
});
