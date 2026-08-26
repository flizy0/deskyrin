import { mountIcons } from "./icons.js";

export const routes = Object.freeze([
  Object.freeze({ id: "overview", label: "Overview", title: "Overview — Deskyrin" }),
  Object.freeze({ id: "network", label: "Network", title: "Network — Deskyrin" }),
  Object.freeze({ id: "validators", label: "Validators", title: "Validators — Deskyrin" }),
  Object.freeze({ id: "economy", label: "Economy", title: "Economy — Deskyrin" }),
  Object.freeze({ id: "ecosystem", label: "Ecosystem", title: "Ecosystem — Deskyrin" }),
  Object.freeze({ id: "sources", label: "Sources", title: "Sources — Deskyrin" })
]);

export const routeAliases = Object.freeze({
  alerts: "overview",
  economics: "economy",
  top: "overview"
});

const routeById = new Map(routes.map((route) => [route.id, route]));
const defaultRoute = routes[0];

function element(value, fallbackSelector) {
  if (value === null) return null;
  if (typeof value === "string") return document.querySelector(value);
  if (value?.nodeType === Node.ELEMENT_NODE) return value;
  return fallbackSelector ? document.querySelector(fallbackSelector) : null;
}

function hashId(hash = window.location.hash) {
  if (!hash || hash === "#") return "";
  try {
    return decodeURIComponent(hash.slice(1)).trim().toLowerCase();
  } catch {
    return "";
  }
}

/** Resolve a route id, historical alias, or hash to a canonical route. */
export function resolveRoute(value = window.location.hash) {
  const text = String(value);
  const candidate = text.startsWith("#") ? hashId(text) : text.trim().toLowerCase();
  const canonicalId = routeAliases[candidate] ?? candidate;
  return routeById.get(canonicalId) ?? defaultRoute;
}

/**
 * Initialize Deskyrin's dependency-free hash router and mobile navigation.
 *
 * `onRouteChange(route, context)` runs after navigation. It may return a
 * promise; the view receives focus once that promise settles. The returned
 * controller exposes `navigate`, drawer controls, the active route, and
 * `destroy` for tests or hot reload cleanup.
 */
export function initHashRouter({
  onRouteChange = () => {},
  view = "#view-root",
  sidebar = "#app-sidebar",
  openButton = "[data-nav-open]",
  closeButton = "[data-nav-close]",
  overlay = "[data-nav-overlay]",
  linkSelector = "[data-route-link]"
} = {}) {
  const viewRoot = element(view, "#view-root");
  const drawer = element(sidebar, "#app-sidebar");
  const drawerOpen = element(openButton, "[data-nav-open]");
  const drawerClose = element(closeButton, "[data-nav-close]");
  const drawerOverlay = element(overlay, "[data-nav-overlay]");
  const workspace = document.querySelector(".app-workspace");
  const links = [...document.querySelectorAll(linkSelector)];
  const labels = [...document.querySelectorAll("[data-current-view-label]")];
  const originalTitle = document.title;
  const mediaQuery = window.matchMedia?.("(min-width: 64rem)");
  let activeRoute;
  let drawerIsOpen = false;
  let previousFocus = null;
  let destroyed = false;
  let focusFrame;

  mountIcons(document);

  function updateRouteUi(route) {
    document.title = route.title;
    for (const label of labels) label.textContent = route.label;
    for (const link of links) {
      if (link.dataset.routeCurrent !== "false" && resolveRoute(link.dataset.routeLink).id === route.id) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }
    if (viewRoot) viewRoot.setAttribute("aria-label", route.label);
  }

  function focusView() {
    if (!viewRoot || destroyed) return;
    if (focusFrame !== undefined) cancelAnimationFrame(focusFrame);
    focusFrame = requestAnimationFrame(() => {
      focusFrame = undefined;
      viewRoot.focus({ preventScroll: true });
      viewRoot.scrollIntoView({ block: "start", behavior: "auto" });
    });
  }

  function applyRoute(route, { source = "location", focus = false, force = false } = {}) {
    if (destroyed || (!force && activeRoute?.id === route.id)) return activeRoute;
    activeRoute = route;
    updateRouteUi(route);
    const result = onRouteChange(route, { source, focus });
    if (focus) Promise.resolve(result).then(focusView, focusView);
    return route;
  }

  function canonicalizeLocation() {
    const candidate = hashId();
    const route = resolveRoute(candidate);
    if (candidate !== route.id) window.history.replaceState(window.history.state, "", `#${route.id}`);
    return route;
  }

  function handleLocationChange() {
    closeDrawer({ restoreFocus: false });
    applyRoute(canonicalizeLocation(), { source: "history" });
  }

  function openDrawer() {
    if (destroyed || drawerIsOpen || mediaQuery?.matches) return;
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    drawerIsOpen = true;
    drawer?.classList.add("is-open");
    document.body.classList.add("navigation-is-open");
    if (workspace) workspace.inert = true;
    drawerOpen?.setAttribute("aria-expanded", "true");
    if (drawerOverlay) drawerOverlay.hidden = false;
    requestAnimationFrame(() => (drawerClose ?? drawer?.querySelector("a, button"))?.focus());
  }

  function closeDrawer({ restoreFocus = true } = {}) {
    if (!drawerIsOpen) return;
    drawerIsOpen = false;
    drawer?.classList.remove("is-open");
    document.body.classList.remove("navigation-is-open");
    if (workspace) workspace.inert = false;
    drawerOpen?.setAttribute("aria-expanded", "false");
    if (drawerOverlay) drawerOverlay.hidden = true;
    if (restoreFocus && previousFocus?.isConnected) previousFocus.focus();
    previousFocus = null;
  }

  function navigate(value, { replace = false, focus = true } = {}) {
    const route = resolveRoute(value);
    const nextHash = `#${route.id}`;
    if (replace || window.location.hash === nextHash) window.history.replaceState(window.history.state, "", nextHash);
    else window.history.pushState(window.history.state, "", nextHash);
    return applyRoute(route, { source: "navigate", focus, force: true });
  }

  function handleRouteClick(event) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest?.(linkSelector);
    if (!link) return;
    if ((link.target && link.target !== "_self") || link.hasAttribute("download")) return;
    event.preventDefault();
    closeDrawer({ restoreFocus: false });
    navigate(link.dataset.routeLink);
  }

  function handleKeydown(event) {
    if (event.key === "Escape" && drawerIsOpen) {
      closeDrawer();
      return;
    }
    if (event.key !== "Tab" || !drawerIsOpen || !drawer) return;
    const focusable = [...drawer.querySelectorAll("a[href], button:not([disabled]), [tabindex]:not([tabindex='-1'])")]
      .filter((node) => !node.hidden && node.getClientRects().length > 0);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function handleDesktopChange(event) {
    if (event.matches) closeDrawer({ restoreFocus: false });
  }

  document.addEventListener("click", handleRouteClick);
  drawerOpen?.addEventListener("click", openDrawer);
  drawerClose?.addEventListener("click", closeDrawer);
  drawerOverlay?.addEventListener("click", closeDrawer);
  document.addEventListener("keydown", handleKeydown);
  window.addEventListener("hashchange", handleLocationChange);
  window.addEventListener("popstate", handleLocationChange);
  mediaQuery?.addEventListener?.("change", handleDesktopChange);

  applyRoute(canonicalizeLocation(), { source: "initial", force: true });

  return {
    get route() {
      return activeRoute;
    },
    navigate,
    openDrawer,
    closeDrawer,
    destroy() {
      if (destroyed) return;
      closeDrawer({ restoreFocus: false });
      destroyed = true;
      if (focusFrame !== undefined) cancelAnimationFrame(focusFrame);
      document.removeEventListener("click", handleRouteClick);
      for (const link of links) link.removeAttribute("aria-current");
      drawerOpen?.removeEventListener("click", openDrawer);
      drawerClose?.removeEventListener("click", closeDrawer);
      drawerOverlay?.removeEventListener("click", closeDrawer);
      document.removeEventListener("keydown", handleKeydown);
      window.removeEventListener("hashchange", handleLocationChange);
      window.removeEventListener("popstate", handleLocationChange);
      mediaQuery?.removeEventListener?.("change", handleDesktopChange);
      document.title = originalTitle;
    }
  };
}
