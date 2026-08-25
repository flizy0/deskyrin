export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
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

export function statusBadge(status, text, { className = "status-badge", title } = {}) {
  const node = el("span", [className, status].filter(Boolean).join(" "), text);
  if (status) node.dataset.status = status;
  if (title) node.title = title;
  return node;
}

export function sectionHeader(id, eyebrow, title, copy) {
  const header = el("header", "section-header");
  const text = el("div", "section-heading-copy");
  if (eyebrow) text.append(el("p", "eyebrow", eyebrow));
  const heading = el("h2", "section-title", title);
  heading.id = `${id}-title`;
  text.append(heading);
  if (copy) text.append(el("p", "section-copy", copy));
  header.append(text);
  return header;
}

export function metricCard(label, value, note, statusNode) {
  const card = el("article", "metric-card");
  card.setAttribute("aria-label", label);
  card.append(
    el("p", "metric-label", label),
    el("p", "metric-value", value),
    el("p", "metric-note", note)
  );
  if (statusNode) card.append(statusNode);
  return card;
}

export function emptyStatePanel(message, { title, className } = {}) {
  const panel = el("article", ["empty-state-panel", className].filter(Boolean).join(" "));
  if (title) panel.append(el("h3", "empty-state-title", title));
  panel.append(el("p", "empty-state-copy", message));
  return panel;
}

export function chartCardHeader(title, note, action) {
  const header = el("header", "chart-head");
  const heading = el("div", "chart-heading");
  heading.append(el("h3", "chart-title", title), el("p", "chart-note", note));
  header.append(heading);
  if (action) header.append(action);
  return header;
}
