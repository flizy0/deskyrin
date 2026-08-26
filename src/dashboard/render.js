import { renderEconomy } from "./pages/economy.js";
import { renderEcosystem } from "./pages/ecosystem.js";
import { renderNetwork } from "./pages/network.js";
import { renderOverview } from "./pages/overview.js";
import { renderSources } from "./pages/sources.js";
import { renderValidators } from "./pages/validators.js";
import { resetView } from "./view-utils.js";

const VIEW_RENDERERS = Object.freeze({
  overview: renderOverview,
  network: renderNetwork,
  validators: renderValidators,
  economy: renderEconomy,
  ecosystem: renderEcosystem,
  sources: renderSources
});

function viewRoot(root) {
  return root || document.querySelector("#view-root");
}

export function resetDashboard(root) {
  const target = viewRoot(root);
  resetView(target);
  if (target) {
    delete target.dataset.view;
    target.setAttribute("aria-busy", "true");
  }
}

/** Render only the active analytical view so large tables and charts stay lazy. */
export function renderDashboard(snapshot, route = "overview", root) {
  const target = viewRoot(root);
  if (!target) throw new Error("Dashboard view root is missing");
  const routeId = typeof route === "string" ? route : route?.id;
  const render = VIEW_RENDERERS[routeId] || VIEW_RENDERERS.overview;

  resetView(target);
  target.dataset.view = VIEW_RENDERERS[routeId] ? routeId : "overview";
  target.setAttribute("aria-busy", "true");
  render(snapshot, target);
  target.setAttribute("aria-busy", "false");
  document.body.dataset.dashboardReady = "true";
  return target;
}

export const renderView = renderDashboard;
