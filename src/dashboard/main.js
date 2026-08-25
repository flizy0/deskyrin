import "./styles.css";
import { renderDashboard, resetDashboard } from "./render.js";
import { initSectionNavigation } from "./navigation.js";
import { el, safeLink } from "./ui.js";

const sectionIds = ["alerts", "network", "validators", "economics", "ecosystem", "sources"];
let loading = false;

function renderLoadingState() {
  for (const id of sectionIds) {
    const root = document.getElementById(id);
    if (root.childElementCount > 0) continue;
    const panel = el("div", "loading-panel");
    panel.setAttribute("aria-hidden", "true");
    panel.append(el("span"), el("span"), el("span"));
    root.append(panel);
  }
}

function clearLoadingState() {
  for (const node of document.querySelectorAll(".loading-panel")) node.remove();
}

function showLoadError(error) {
  resetDashboard();
  clearLoadingState();
  const panel = document.querySelector("#load-error");
  const copy = el("div");
  copy.append(
    el("strong", undefined, "Dashboard data is unavailable."),
    el("p", undefined, error.message)
  );
  const actions = el("div", "load-error-actions");
  const retry = el("button", "retry-button", "Retry");
  retry.type = "button";
  retry.addEventListener("click", load, { once: true });
  actions.append(retry, safeLink("Open raw JSON", "/data.json"), safeLink("Open report", "/report.md"));
  panel.replaceChildren(copy, actions);
  panel.hidden = false;
  const status = document.querySelector("#overall-status");
  status.textContent = "unavailable";
  status.className = "status-badge unavailable";
}

async function load() {
  if (loading) return;
  loading = true;
  document.querySelector("#load-error").hidden = true;
  const status = document.querySelector("#overall-status");
  status.textContent = "loading";
  status.className = "status-badge";
  renderLoadingState();
  try {
    const response = await fetch("/data.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`data.json returned HTTP ${response.status}`);
    const data = await response.json();
    const requiredArrays = [
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
      data.ecosystem?.tokenizedAssets?.history,
      data.ecosystem?.dailyActiveAddresses?.history,
      data.ecosystem?.upgrades?.items,
      data.ecosystem?.news?.items
    ];
    if (data.schemaVersion !== "1.0.0" || !data.network?.chain || !data.sources || requiredArrays.some((value) => !Array.isArray(value))) {
      throw new Error("data.json has an unsupported or incomplete schema");
    }
    clearLoadingState();
    renderDashboard(data);
  } catch (error) {
    showLoadError(error);
  } finally {
    loading = false;
  }
}

initSectionNavigation();
load();
