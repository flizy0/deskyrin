export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function isNode(value) {
  return value && typeof value === "object" && typeof value.nodeType === "number";
}

function appendContent(parent, content) {
  if (content === undefined || content === null || content === false) return;
  if (Array.isArray(content)) {
    for (const item of content) appendContent(parent, item);
    return;
  }
  parent.append(isNode(content) ? content : document.createTextNode(String(content)));
}

function contentElement(tag, className, content) {
  const node = el(tag, className);
  appendContent(node, content);
  return node;
}

function classNames(...values) {
  return values.filter(Boolean).join(" ");
}

export function safeLink(label, href, className) {
  let url;
  try {
    url = new URL(href, window.location.origin);
  } catch {
    return el("span", className, label);
  }

  const isInternal = url.origin === window.location.origin;
  if (!isInternal && url.protocol !== "https:") return el("span", className, label);

  const link = el("a", className, label);
  link.href = url.href;
  if (!isInternal) {
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.setAttribute("aria-label", `${label} (opens in a new tab)`);
  }
  return link;
}

/**
 * Compact semantic status treatment for the terminal shell and data panels.
 * The marker is decorative; the visible label carries the status meaning.
 */
export function statusDot(status, text, { className = "status-text", title } = {}) {
  const node = el("span", classNames(className, status));
  if (status) node.dataset.status = status;
  if (title) node.title = title;

  const marker = el("span", "status-dot status-indicator");
  marker.setAttribute("aria-hidden", "true");
  node.append(marker, contentElement("span", "status-label", text));
  return node;
}

export function emptyStatePanel(message, { title, className } = {}) {
  const panel = el("article", ["empty-state-panel", className].filter(Boolean).join(" "));
  if (title) panel.append(el("h3", "empty-state-title", title));
  panel.append(el("p", "empty-state-copy", message));
  return panel;
}
