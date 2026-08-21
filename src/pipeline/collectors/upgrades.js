import { load } from "cheerio";
import { PipelineError } from "../lib/errors.js";
import { isoTimestamp } from "../lib/time.js";

const STAGES = new Map([
  ["In Development", "in_development"],
  ["Pending Feature Activation", "pending_activation"],
  ["Action Required", "action_required"]
]);
const LIVE_STAGES = new Set(["Live", "Live on Mainnet"]);

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function text($, node, selector, limit) {
  return $(node).find(selector).first().text().replace(/\s+/g, " ").trim().slice(0, limit);
}

function parseHub(html) {
  const $ = load(html);
  const cards = [];
  const seen = new Set();
  $("a[href^='/upgrades/']").each((_index, node) => {
    const href = $(node).attr("href");
    const title = text($, node, "h3", 200);
    if (!title || seen.has(href)) return;
    const stageLabel = $(node).find("span").first().text().replace(/\s+/g, " ").trim();
    if (LIVE_STAGES.has(stageLabel)) {
      seen.add(href);
      return;
    }
    const stage = STAGES.get(stageLabel);
    if (!stage) throw new PipelineError("UNKNOWN_UPGRADE_STAGE", `Unknown official upgrade stage: ${stageLabel || "missing"}`);
    const section = $(node).closest("section");
    const releaseLabel = section.find("h2,h3").first().text().replace(/\s+/g, " ").trim();
    if (!releaseLabel) throw new PipelineError("MISSING_UPGRADE_RELEASE", `Upgrade ${title} has no release group`);
    const metricContainer = $(node).find("div").filter((_i, child) => ($(child).attr("class") || "").split(/\s+/).includes("mt-6")).first();
    const metrics = metricContainer.children("div").toArray().map((metric) => {
      const parts = $(metric).children("div").toArray().map((part) => $(part).text().replace(/\s+/g, " ").trim());
      return { value: (parts[0] || "").slice(0, 1_000), label: (parts[1] || "").slice(0, 1_000) };
    }).filter((metric) => metric.value && metric.label).slice(0, 4);
    cards.push({
      id: href.split("/").filter(Boolean).at(-1),
      title,
      subtitle: text($, node, "p", 500),
      url: new URL(href, "https://solana.com").toString(),
      stage,
      stageLabel,
      releaseId: slug(releaseLabel),
      releaseLabel,
      metrics
    });
    seen.add(href);
  });
  if (cards.length === 0) throw new PipelineError("EMPTY_UPGRADE_LIST", "Official upgrades hub has no upcoming cards");
  return cards;
}

async function collectSimds(context, card) {
  const { http, config } = context;
  const html = await http.request(card.url, {
    sourceId: "solanaUpgrades", responseType: "text", expectedContentTypes: ["text/html"],
    timeoutMs: config.http.ordinaryTimeoutMs, maxBytes: config.http.maxBytes.ordinary
  });
  const $ = load(html);
  const simds = [];
  $("a[href^='https://github.com/solana-foundation/solana-improvement-documents']").each((_index, node) => {
    const title = $(node).text().replace(/\s+/g, " ").trim();
    const match = title.match(/SIMD-(\d{4})/i) || ($(node).attr("href") || "").match(/(?:proposals\/|pull\/)(\d{3,4})/);
    if (!match) return;
    const id = match[1].padStart(4, "0");
    const url = new URL($(node).attr("href")).toString();
    simds.push({ id, ...(title ? { title: title.slice(0, 200) } : {}), url });
  });
  return [...new Map(simds.map((simd) => [simd.id, simd])).values()].slice(0, 12);
}

export async function collectUpgrades(context) {
  const { http, config, now } = context;
  const html = await http.request(config.endpoints.solanaUpgrades, {
    sourceId: "solanaUpgrades", responseType: "text", expectedContentTypes: ["text/html"],
    timeoutMs: config.http.largeTimeoutMs, maxBytes: config.http.maxBytes.ordinary
  });
  const cards = parseHub(html);
  const items = await Promise.all(cards.map(async (card) => ({ ...card, simds: await collectSimds(context, card) })));
  const alpenglow = items.find((item) => item.id === "alpenglow" && item.simds.some((simd) => simd.id === "0326"));
  const reduced = items.find((item) => item.id === "reduced-slot-times" && item.simds.some((simd) => simd.id === "0525"));
  if (!alpenglow || !reduced) {
    throw new PipelineError("LISTING_UPGRADE_ASSERTION_FAILED", "Current official upcoming data must contain Alpenglow/SIMD-0326 and Reduced Slot Times/SIMD-0525");
  }
  return {
    status: "fresh", observedAt: isoTimestamp(now), sourceIds: ["solanaUpgrades"], items
  };
}
