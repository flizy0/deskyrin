const DEFAULT_NAV_SELECTOR = "[data-section-nav]";
const DEFAULT_LINK_SELECTOR = "a[href^=\"#\"]";
const DEFAULT_HEADER_SELECTOR = ".site-header";

function noOp() {}

function resolveElement(value) {
  if (!value) return null;
  if (typeof value === "string") return document.querySelector(value);
  return value.nodeType === Node.ELEMENT_NODE ? value : null;
}

function sameDocumentTarget(link) {
  let url;
  try {
    url = new URL(link.href, window.location.href);
  } catch {
    return null;
  }

  const current = window.location;
  if (url.origin !== current.origin || url.pathname !== current.pathname || url.search !== current.search || !url.hash) {
    return null;
  }

  let id;
  try {
    id = decodeURIComponent(url.hash.slice(1));
  } catch {
    return null;
  }
  return id ? document.getElementById(id) : null;
}

/**
 * Initialize sticky in-page navigation.
 *
 * The default markup contract is a `[data-section-nav]` container containing
 * same-document hash links. The returned function removes every listener,
 * observer, animation frame, and aria-current value installed here.
 */
export function initSectionNavigation({
  nav = DEFAULT_NAV_SELECTOR,
  links = DEFAULT_LINK_SELECTOR,
  header = DEFAULT_HEADER_SELECTOR
} = {}) {
  const navigation = resolveElement(nav);
  if (!navigation) return noOp;

  const items = [...navigation.querySelectorAll(links)].flatMap((link) => {
    const section = sameDocumentTarget(link);
    return section ? [{ link, section }] : [];
  });
  if (items.length === 0) return noOp;

  const stickyHeader = resolveElement(header);
  const sections = [...new Set(items.map((item) => item.section))];
  const originalCurrent = new Map(items.map(({ link }) => [link, link.getAttribute("aria-current")]));
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  let destroyed = false;
  let observer;
  let updateFrame;
  let resizeFrame;
  let fallbackScrollListening = false;

  function headerHeight() {
    return stickyHeader ? Math.max(0, stickyHeader.getBoundingClientRect().height) : 0;
  }

  function setCurrent(section) {
    for (const item of items) {
      if (item.section === section) item.link.setAttribute("aria-current", "location");
      else item.link.removeAttribute("aria-current");
    }
  }

  function updateCurrent() {
    updateFrame = undefined;
    if (destroyed) return;

    const line = headerHeight() + 1;
    let current = sections[0];
    for (const section of sections) {
      if (section.getBoundingClientRect().top <= line) current = section;
      else break;
    }
    setCurrent(current);
  }

  function scheduleUpdate() {
    if (!destroyed && updateFrame === undefined) updateFrame = requestAnimationFrame(updateCurrent);
  }

  function createObserver() {
    observer?.disconnect();
    observer = undefined;

    if (!("IntersectionObserver" in window)) {
      if (!fallbackScrollListening) {
        window.addEventListener("scroll", scheduleUpdate, { passive: true });
        fallbackScrollListening = true;
      }
      scheduleUpdate();
      return;
    }

    const viewportHeight = Math.max(2, window.innerHeight);
    const topMargin = Math.min(Math.round(headerHeight()), viewportHeight - 2);
    const bottomMargin = Math.max(0, viewportHeight - topMargin - 2);
    observer = new IntersectionObserver(scheduleUpdate, {
      root: null,
      rootMargin: `-${topMargin}px 0px -${bottomMargin}px 0px`,
      threshold: 0
    });
    for (const section of sections) observer.observe(section);
    scheduleUpdate();
  }

  function handleClick(event) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const item = items.find(({ link }) => link === event.currentTarget);
    if (!item || item.link.hasAttribute("download") || item.link.target && item.link.target !== "_self") return;

    event.preventDefault();
    setCurrent(item.section);
    const top = Math.max(0, window.scrollY + item.section.getBoundingClientRect().top - headerHeight());
    window.scrollTo({ top, behavior: reducedMotion?.matches ? "auto" : "smooth" });

    const hash = item.link.hash;
    if (window.location.hash === hash) window.history.replaceState(window.history.state, "", hash);
    else window.history.pushState(window.history.state, "", hash);
  }

  function handleResize() {
    if (resizeFrame !== undefined) cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = undefined;
      if (!destroyed) createObserver();
    });
  }

  for (const { link } of items) link.addEventListener("click", handleClick);
  window.addEventListener("resize", handleResize, { passive: true });
  window.addEventListener("hashchange", scheduleUpdate);
  window.addEventListener("popstate", scheduleUpdate);
  createObserver();

  return function cleanupSectionNavigation() {
    if (destroyed) return;
    destroyed = true;
    observer?.disconnect();
    if (fallbackScrollListening) window.removeEventListener("scroll", scheduleUpdate);
    window.removeEventListener("resize", handleResize);
    window.removeEventListener("hashchange", scheduleUpdate);
    window.removeEventListener("popstate", scheduleUpdate);
    for (const { link } of items) {
      link.removeEventListener("click", handleClick);
      const previous = originalCurrent.get(link);
      if (previous === null) link.removeAttribute("aria-current");
      else link.setAttribute("aria-current", previous);
    }
    if (updateFrame !== undefined) cancelAnimationFrame(updateFrame);
    if (resizeFrame !== undefined) cancelAnimationFrame(resizeFrame);
  };
}
