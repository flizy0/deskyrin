import assert from "node:assert/strict";
import test from "node:test";
import { createConfig } from "../../src/pipeline/config.js";
import { createHttpClient, parseJsonPreservingIntegers } from "../../src/pipeline/lib/http.js";
import { createRpcClient } from "../../src/pipeline/lib/rpc.js";

test("lossless parser keeps unsafe integers as BigInt", () => {
  const value = parseJsonPreservingIntegers('{"small":42,"u64":18446744073709551615,"price":1.25}');
  assert.equal(value.small, 42);
  assert.equal(value.u64, 18446744073709551615n);
  assert.equal(value.price, 1.25);
});

test("HTTP client retries retryable status and validates JSON", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    if (calls === 1) return new Response("busy", { status: 503, headers: { "content-type": "text/plain" } });
    return new Response('{"ok":true}', { status: 200, headers: { "content-type": "application/json" } });
  };
  const http = createHttpClient({ fetchImpl, retryDelaysMs: [0], allowedHosts: ["example.com"] });
  assert.deepEqual(await http.request("https://example.com/data", { expectedContentTypes: ["application/json"] }), { ok: true });
  assert.equal(calls, 2);
});

test("HTTP client enforces stream size", async () => {
  const http = createHttpClient({
    fetchImpl: async () => new Response("12345", { headers: { "content-type": "text/plain" } }),
    allowedHosts: ["example.com"]
  });
  await assert.rejects(http.request("https://example.com/data", { responseType: "text", maxBytes: 4 }), (error) => error.code === "RESPONSE_TOO_LARGE");
});

test("custom HTTPS RPC host is added to the request allowlist", () => {
  const config = createConfig({ SOLANA_RPC_URL: "https://rpc.example.com/path" });
  assert.equal(config.rpc.url, "https://rpc.example.com/path");
  assert.ok(config.allowedHosts.includes("rpc.example.com"));
});

test("source refresh intervals are configurable within scheduler bounds", () => {
  const config = createConfig({ LIVE_REFRESH_MINUTES: "120", DAILY_REFRESH_HOURS: "12" });
  assert.equal(config.intervals.hourly, 120 * 60_000);
  assert.equal(config.intervals.dailySourceCheck, 12 * 60 * 60_000);
  assert.throws(() => createConfig({ LIVE_REFRESH_MINUTES: "15" }), /LIVE_REFRESH_MINUTES/);
});

test("HTTP client rejects a redirect that leaves the host allowlist", async () => {
  const response = new Response('{"ok":true}', { status: 200, headers: { "content-type": "application/json" } });
  Object.defineProperty(response, "url", { value: "https://unapproved.example/data" });
  const http = createHttpClient({ fetchImpl: async () => response, allowedHosts: ["example.com"] });
  await assert.rejects(
    http.request("https://example.com/data", { expectedContentTypes: ["application/json"] }),
    (error) => error.code === "UNAPPROVED_HOST"
  );
});

test("RPC batch maps reordered items and reports missing items", async () => {
  const http = {
    request: async (_url, options) => {
      const requests = JSON.parse(options.body);
      return [{ jsonrpc: "2.0", id: requests[1].id, result: "second" }];
    }
  };
  const rpc = createRpcClient({ url: "https://example.com", http });
  const result = await rpc.batch([{ key: "one", method: "a" }, { key: "two", method: "b" }], { attempts: 1 });
  assert.equal(result.two.value, "second");
  assert.equal(result.one.ok, false);
  assert.equal(result.one.error.code, "MISSING_RPC_BATCH_ITEM");
});
