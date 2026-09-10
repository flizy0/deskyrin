import assert from "node:assert/strict";
import test from "node:test";
import { fmt, formatUtcDateTime } from "../../src/dashboard/format.js";

test("UTC timestamps use an unambiguous 24-hour clock", () => {
  assert.equal(formatUtcDateTime("2026-09-02T00:34:05.253Z"), "Sep 2, 2026, 00:34");
  assert.equal(formatUtcDateTime("2026-09-02T12:31:57.796Z"), "Sep 2, 2026, 12:31");
  assert.equal(fmt.utc("2026-09-02T00:34:05.253Z"), "Sep 2, 2026, 00:34 UTC");
});
