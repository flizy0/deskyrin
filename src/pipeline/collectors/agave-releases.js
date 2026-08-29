import { z } from "zod";
import { PipelineError } from "../lib/errors.js";
import { uniqueByKey } from "../lib/history.js";
import { isoTimestamp } from "../lib/time.js";

const MAX_API_RELEASES = 100;
const MAX_PUBLISHED_RELEASES = 20;
const FUTURE_TOLERANCE_MS = 5 * 60_000;

const isoTime = z.string().datetime({ offset: true });
const httpsUrl = z.string().url().refine((value) => new URL(value).protocol === "https:", "Expected an HTTPS URL");

const releaseSchema = z.object({
  id: z.number().int().safe().positive(),
  tag_name: z.string().min(1),
  name: z.string().nullable(),
  html_url: httpsUrl,
  draft: z.boolean(),
  prerelease: z.boolean(),
  created_at: isoTime,
  published_at: isoTime.nullable(),
  body: z.string().nullable().optional()
});

const releasesSchema = z.array(releaseSchema).max(MAX_API_RELEASES);

function releaseUrl(value) {
  const url = new URL(value);
  if (url.hostname !== "github.com" || !url.pathname.startsWith("/anza-xyz/agave/releases/")) {
    throw new PipelineError("INVALID_AGAVE_RELEASE_URL", "Agave release must link to the official anza-xyz/agave repository");
  }
  return url.toString();
}

function cleanText(value, limit) {
  return String(value).replace(/\s+/g, " ").trim().slice(0, limit);
}

function requestUrl(endpoint) {
  const url = new URL(endpoint);
  if (!url.pathname.endsWith("/repos/anza-xyz/agave/releases")) {
    throw new PipelineError("INVALID_AGAVE_RELEASE_ENDPOINT", "Agave release endpoint must target anza-xyz/agave");
  }
  url.searchParams.set("per_page", String(MAX_API_RELEASES));
  return url.toString();
}

export async function collectAgaveReleases(context) {
  const { http, config, now } = context;
  const raw = await http.request(requestUrl(config.endpoints.agaveReleases), {
    sourceId: "agaveReleases",
    expectedContentTypes: ["application/json"],
    timeoutMs: config.http.ordinaryTimeoutMs,
    maxBytes: config.http.maxBytes.ordinary
  });
  const nowMs = new Date(now).getTime();
  const normalized = releasesSchema.parse(raw)
    .filter((release) => !release.draft && release.published_at)
    .map((release) => {
      const createdAt = isoTimestamp(release.created_at, "Agave release creation time");
      const publishedAt = isoTimestamp(release.published_at, "Agave release publication time");
      if (Date.parse(publishedAt) > nowMs + FUTURE_TOLERANCE_MS) {
        throw new PipelineError("FUTURE_AGAVE_RELEASE", "Agave release publication time is unexpectedly in the future");
      }
      const notes = release.body ? cleanText(release.body, 1_000) : "";
      return {
        id: String(release.id),
        tagName: cleanText(release.tag_name, 100),
        title: cleanText(release.name || release.tag_name, 200),
        url: releaseUrl(release.html_url),
        createdAt,
        publishedAt,
        prerelease: release.prerelease,
        ...(notes ? { notes } : {})
      };
    });
  const items = uniqueByKey(normalized, (release) => release.id, "Agave releases")
    .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt) || right.id.localeCompare(left.id))
    .slice(0, MAX_PUBLISHED_RELEASES);
  if (items.length === 0) {
    throw new PipelineError("EMPTY_AGAVE_RELEASES", "Official Agave repository has no published releases");
  }
  const observedAt = isoTimestamp(now);
  return {
    sourceId: "agaveReleases",
    observedAt,
    dataThrough: items[0].publishedAt,
    repository: "anza-xyz/agave",
    items
  };
}
