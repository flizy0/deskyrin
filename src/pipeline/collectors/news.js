import { load } from "cheerio";
import { XMLParser } from "fast-xml-parser";
import { PipelineError } from "../lib/errors.js";
import { isoTimestamp } from "../lib/time.js";

function plainText(value, limit) {
  if (value === undefined || value === null) return undefined;
  const text = load(String(value)).text().replace(/\s+/g, " ").trim();
  return text ? text.slice(0, limit) : undefined;
}

function httpsUrl(value) {
  const url = new URL(String(value));
  if (url.protocol !== "https:") throw new PipelineError("INSECURE_CONTENT_URL", "Content link must use HTTPS");
  return url.toString();
}

export async function collectNews(context) {
  const { http, config, now } = context;
  const xml = await http.request(config.endpoints.solanaNews, {
    sourceId: "solanaNews", responseType: "text", expectedContentTypes: ["xml", "rss"],
    timeoutMs: config.http.ordinaryTimeoutMs, maxBytes: config.http.maxBytes.ordinary
  });
  let parsed;
  try {
    parsed = new XMLParser({ ignoreAttributes: false, trimValues: true }).parse(xml);
  } catch (error) {
    throw new PipelineError("INVALID_NEWS_XML", "Official news feed is malformed", { cause: error });
  }
  const channel = parsed?.rss?.channel;
  const rawItems = Array.isArray(channel?.item) ? channel.item : channel?.item ? [channel.item] : [];
  const items = [];
  for (const item of rawItems) {
    try {
      const title = plainText(item.title, 300);
      const url = httpsUrl(item.link);
      const publishedAt = isoTimestamp(item.pubDate, "news publication time");
      if (!title) continue;
      items.push({
        id: String(item.guid || item.link).slice(0, 500), title, url, publishedAt,
        ...(plainText(item.description, 1_000) ? { description: plainText(item.description, 1_000) } : {})
      });
    } catch {
      // One malformed item is discarded only while a valid bounded feed remains.
    }
  }
  const unique = [...new Map(items.map((item) => [item.id, item])).values()]
    .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt))
    .slice(0, config.display.newsItems);
  if (unique.length === 0) throw new PipelineError("EMPTY_NEWS_FEED", "Official news feed has no valid items");
  return {
    status: "fresh", observedAt: isoTimestamp(now), sourceIds: ["solanaNews"],
    ...(channel.lastBuildDate ? { feedUpdatedAt: isoTimestamp(channel.lastBuildDate, "feed build time") } : {}),
    items: unique
  };
}
