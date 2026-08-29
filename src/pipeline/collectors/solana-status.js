import { z } from "zod";
import { PipelineError } from "../lib/errors.js";
import { uniqueByKey } from "../lib/history.js";
import { isoTimestamp } from "../lib/time.js";

const MAX_COMPONENTS = 50;
const MAX_INCIDENTS = 20;
const MAX_INCIDENT_UPDATES = 10;
const FUTURE_TOLERANCE_MS = 5 * 60_000;

const isoTime = z.string().datetime({ offset: true });
const httpsUrl = z.string().url().refine((value) => new URL(value).protocol === "https:", "Expected an HTTPS URL");
const componentStatus = z.enum(["operational", "degraded_performance", "partial_outage", "major_outage", "under_maintenance"]);
const impact = z.enum(["none", "minor", "major", "critical", "maintenance"]);

const pageSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  url: httpsUrl,
  updated_at: isoTime
});

const componentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  status: componentStatus,
  updated_at: isoTime,
  position: z.number().int().min(0).optional(),
  description: z.string().nullable().optional(),
  group: z.boolean().optional()
});

const incidentUpdateSchema = z.object({
  id: z.string().min(1),
  status: z.string().min(1),
  body: z.string(),
  created_at: isoTime,
  updated_at: isoTime
});

const incidentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  status: z.enum(["investigating", "identified", "monitoring", "resolved", "postmortem"]),
  impact,
  created_at: isoTime,
  updated_at: isoTime,
  started_at: isoTime.nullable().optional(),
  resolved_at: isoTime.nullable().optional(),
  shortlink: httpsUrl.optional(),
  incident_updates: z.array(incidentUpdateSchema).optional().default([])
});

const summarySchema = z.object({
  page: pageSchema,
  status: z.object({ indicator: impact, description: z.string().min(1) }),
  components: z.array(componentSchema).min(1)
});

const incidentsSchema = z.object({
  page: pageSchema,
  incidents: z.array(incidentSchema)
});

function cleanText(value, limit) {
  return String(value).replace(/\s+/g, " ").trim().slice(0, limit);
}

function assertNotFuture(value, now, label) {
  if (Date.parse(value) > new Date(now).getTime() + FUTURE_TOLERANCE_MS) {
    throw new PipelineError("FUTURE_STATUS_TIMESTAMP", `${label} is unexpectedly in the future`);
  }
}

function normalizeUpdates(updates, now) {
  const normalized = updates.map((update) => {
    const createdAt = isoTimestamp(update.created_at, "incident update creation time");
    const updatedAt = isoTimestamp(update.updated_at, "incident update time");
    assertNotFuture(updatedAt, now, "Incident update time");
    return {
      id: update.id,
      status: cleanText(update.status, 100),
      body: cleanText(update.body, 1_000),
      createdAt,
      updatedAt
    };
  });
  return uniqueByKey(normalized, (update) => update.id, "Solana status incident updates")
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || right.createdAt.localeCompare(left.createdAt))
    .slice(0, MAX_INCIDENT_UPDATES);
}

export async function collectSolanaStatus(context) {
  const { http, config, now } = context;
  const requestOptions = {
    sourceId: "solanaStatus",
    expectedContentTypes: ["application/json"],
    timeoutMs: config.http.ordinaryTimeoutMs,
    maxBytes: config.http.maxBytes.ordinary
  };
  const [summaryRaw, incidentsRaw] = await Promise.all([
    http.request(config.endpoints.solanaStatusSummary, requestOptions),
    http.request(config.endpoints.solanaStatusIncidents, requestOptions)
  ]);
  const summary = summarySchema.parse(summaryRaw);
  const incidentPayload = incidentsSchema.parse(incidentsRaw);
  if (summary.page.id !== incidentPayload.page.id) {
    throw new PipelineError("STATUS_PAGE_MISMATCH", "Solana status responses refer to different pages");
  }

  const pageUpdatedAt = isoTimestamp(summary.page.updated_at, "status page update time");
  assertNotFuture(pageUpdatedAt, now, "Status page update time");
  const components = uniqueByKey(summary.components.map((component) => {
    const updatedAt = isoTimestamp(component.updated_at, "status component update time");
    assertNotFuture(updatedAt, now, "Status component update time");
    return {
      id: component.id,
      name: cleanText(component.name, 200),
      status: component.status,
      updatedAt,
      position: component.position ?? Number.MAX_SAFE_INTEGER,
      group: component.group === true,
      ...(component.description ? { description: cleanText(component.description, 500) } : {})
    };
  }), (component) => component.id, "Solana status components")
    .sort((left, right) => left.position - right.position || left.name.localeCompare(right.name))
    .slice(0, MAX_COMPONENTS);

  const incidents = uniqueByKey(incidentPayload.incidents.map((incident) => {
    const createdAt = isoTimestamp(incident.created_at, "incident creation time");
    const updatedAt = isoTimestamp(incident.updated_at, "incident update time");
    const startedAt = isoTimestamp(incident.started_at || incident.created_at, "incident start time");
    assertNotFuture(updatedAt, now, "Incident update time");
    return {
      id: incident.id,
      name: cleanText(incident.name, 300),
      status: incident.status,
      impact: incident.impact,
      createdAt,
      startedAt,
      updatedAt,
      ...(incident.resolved_at ? { resolvedAt: isoTimestamp(incident.resolved_at, "incident resolution time") } : {}),
      ...(incident.shortlink ? { url: incident.shortlink } : {}),
      updates: normalizeUpdates(incident.incident_updates, now)
    };
  }), (incident) => incident.id, "Solana status incidents")
    .sort((left, right) => right.startedAt.localeCompare(left.startedAt) || right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, MAX_INCIDENTS);

  const observedAt = isoTimestamp(now);
  return {
    sourceId: "solanaStatus",
    observedAt,
    dataThrough: observedAt,
    page: {
      id: summary.page.id,
      name: cleanText(summary.page.name, 200),
      url: summary.page.url,
      updatedAt: pageUpdatedAt
    },
    status: {
      indicator: summary.status.indicator,
      description: cleanText(summary.status.description, 300)
    },
    components,
    incidents
  };
}
