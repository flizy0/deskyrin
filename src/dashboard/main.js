import "./styles.css";
import { renderDashboard, resetDashboard } from "./render.js";
import { initHashRouter } from "./router.js";
import { el, safeLink } from "./ui.js";

const root = document.querySelector("#view-root");
const errorPanel = document.querySelector("#load-error");
const status = document.querySelector("#overall-status");
const updatedAt = document.querySelector("#updated-at");
const snapshotState = document.querySelector(".snapshot-state");
const refreshButton = document.querySelector("[data-refresh-snapshot]");

let snapshot;
let activeRoute = { id: "overview" };
let loading = false;
let relativeTimeTimer;

function requiredArrays(data) {
  return [
    data.alerts,
    data.alertChecks,
    data.network?.performance?.history,
    data.validators?.history,
    data.validators?.stake?.distribution,
    data.validators?.table,
    data.validators?.commissionChanges,
    data.economics?.solPrice?.history,
    data.economics?.stablecoinSupply?.history,
    data.economics?.dexVolume?.history,
    data.economics?.rev?.history,
    data.economics?.medianTransactionFee?.history,
    data.economics?.tvlAlertInput?.history,
    data.ecosystem?.tokenizedAssets?.history,
    data.ecosystem?.dailyActiveAddresses?.history,
    data.ecosystem?.upgrades?.items,
    data.ecosystem?.news?.items
  ];
}

function hasInvalidOptionalArrays(data) {
  const optional = [
    data.coverageIncidents,
    data.providerComparisons?.metrics,
    data.economics?.coinGeckoPrice?.history,
    data.economics?.coinbaseMarket?.history,
    data.observability?.solanaStatus?.components,
    data.observability?.solanaStatus?.incidents,
    data.observability?.agaveReleases?.items
  ];
  if (optional.some((value) => value !== undefined && !Array.isArray(value))) return true;
  return Array.isArray(data.providerComparisons?.metrics) && data.providerComparisons.metrics.some((metric) =>
    !Array.isArray(metric.series) || metric.series.some((series) => !Array.isArray(series.history))
  );
}

function validateSnapshot(data) {
  if (
    data?.schemaVersion !== "1.2.0"
    || !data.network?.chain
    || !data.sources
    || Array.isArray(data.sources)
    || requiredArrays(data).some((value) => !Array.isArray(value))
    || hasInvalidOptionalArrays(data)
  ) throw new Error("data.json has an unsupported or incomplete schema");
  return data;
}

function relativeAge(value) {
  const elapsed = Math.max(0, Date.now() - Date.parse(value));
  if (!Number.isFinite(elapsed)) return "Unknown";
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function refreshTimestamp() {
  if (!snapshot?.updatedAt) return;
  updatedAt.textContent = relativeAge(snapshot.updatedAt);
  updatedAt.dateTime = snapshot.updatedAt;
  updatedAt.title = new Date(snapshot.updatedAt).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "long",
    timeZone: "UTC"
  });
}

function updateSnapshotUtility() {
  const complete = snapshot?.updateStatus === "complete";
  const label = complete ? "Snapshot complete" : "Snapshot partial";
  status.textContent = label;
  status.className = `status-badge ${complete ? "complete" : "partial"}`;
  snapshotState.dataset.status = complete ? "complete" : "partial";
  refreshTimestamp();
  clearInterval(relativeTimeTimer);
  relativeTimeTimer = window.setInterval(refreshTimestamp, 30_000);
}

function renderLoadingState() {
  resetDashboard(root);
  const skeleton = el("div", "view-skeleton");
  skeleton.setAttribute("aria-hidden", "true");
  const heading = el("div", "skeleton-heading");
  heading.append(el("span"), el("span"), el("span"));
  const metrics = el("div", "skeleton-metrics");
  for (let index = 0; index < 5; index += 1) metrics.append(el("span"));
  skeleton.append(heading, metrics, el("span", "skeleton-panel"));
  root.append(skeleton);
}

function renderCurrentView() {
  if (snapshot) renderDashboard(snapshot, activeRoute.id, root);
  else if (!loading) renderLoadingState();
}

function showLoadError(error, { retainSnapshot = false } = {}) {
  if (!retainSnapshot) resetDashboard(root);
  const copy = el("div", "load-error-copy");
  copy.append(
    el("strong", undefined, retainSnapshot ? "Refresh failed; showing the previous snapshot." : "Dashboard data is unavailable."),
    el("p", undefined, error instanceof Error ? error.message : String(error))
  );
  const actions = el("div", "load-error-actions");
  const retry = el("button", "control-button retry-button", "Retry");
  retry.type = "button";
  retry.addEventListener("click", loadSnapshot, { once: true });
  actions.append(retry, safeLink("Open raw JSON", "/data.json"), safeLink("Open report", "/report.md"));
  errorPanel.replaceChildren(copy, actions);
  errorPanel.hidden = false;
  if (!retainSnapshot) {
    status.textContent = "Snapshot unavailable";
    status.className = "status-badge unavailable";
    snapshotState.dataset.status = "unavailable";
    updatedAt.textContent = "No data";
  }
}

async function loadSnapshot() {
  if (loading) return;
  const retainingSnapshot = Boolean(snapshot);
  loading = true;
  errorPanel.hidden = true;
  refreshButton.disabled = true;
  refreshButton.dataset.loading = "true";
  if (!retainingSnapshot) {
    status.textContent = "Loading snapshot";
    status.className = "status-badge loading";
    snapshotState.dataset.status = "loading";
    renderLoadingState();
  }

  try {
    const response = await fetch("/data.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`data.json returned HTTP ${response.status}`);
    snapshot = validateSnapshot(await response.json());
    updateSnapshotUtility();
    renderCurrentView();
  } catch (error) {
    showLoadError(error, { retainSnapshot: retainingSnapshot });
  } finally {
    loading = false;
    refreshButton.disabled = false;
    delete refreshButton.dataset.loading;
  }
}

initHashRouter({
  onRouteChange(route) {
    activeRoute = route;
    renderCurrentView();
  }
});

refreshButton.addEventListener("click", loadSnapshot);
window.addEventListener("pagehide", () => clearInterval(relativeTimeTimer), { once: true });
loadSnapshot();
