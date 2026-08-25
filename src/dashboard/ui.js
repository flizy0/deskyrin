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

export function statusBadge(status, text, { className = "status-badge", title } = {}) {
  const node = el("span", [className, status].filter(Boolean).join(" "), text);
  if (status) node.dataset.status = status;
  if (title) node.title = title;
  return node;
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

// A semantic-name alias for call sites where the label matters more than the dot.
export function statusText(status, text, options) {
  return statusDot(status, text, options);
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

/**
 * Page heading for a routed dashboard view.
 * Supports pageHeader(title, copy, options) and pageHeader({ title, ...options }).
 */
export function pageHeader(titleOrOptions, copy, options = {}) {
  const config = titleOrOptions && typeof titleOrOptions === "object" && !isNode(titleOrOptions)
    ? titleOrOptions
    : { ...options, title: titleOrOptions, copy };
  const {
    id,
    eyebrow,
    title,
    copy: description,
    meta,
    actions,
    className
  } = config;

  const header = el("header", classNames("page-header", className));
  const heading = el("div", "page-heading");
  if (eyebrow) heading.append(contentElement("p", "page-eyebrow eyebrow", eyebrow));
  const titleNode = contentElement("h1", "page-title", title);
  if (id) titleNode.id = id.endsWith("-title") ? id : `${id}-title`;
  heading.append(titleNode);
  if (description) heading.append(contentElement("p", "page-copy", description));
  if (meta) heading.append(contentElement("div", "page-meta", meta));
  header.append(heading);

  if (actions) {
    const actionGroup = el("div", "page-actions");
    appendContent(actionGroup, actions);
    header.append(actionGroup);
  }
  return header;
}

/**
 * Shared compact header for analytical panels.
 * Supports panelHeader(title, note, action, options) and an object argument.
 */
export function panelHeader(titleOrOptions, note, action, options = {}) {
  const config = titleOrOptions && typeof titleOrOptions === "object" && !isNode(titleOrOptions)
    ? titleOrOptions
    : { ...options, title: titleOrOptions, note, action };
  const { title, note: description, action: panelAction, meta, className, level = 3 } = config;
  const header = el("header", classNames("panel-header panel-head", className));
  const heading = el("div", "panel-heading");
  const headingLevel = Number.isInteger(level) && level >= 2 && level <= 6 ? level : 3;
  heading.append(contentElement(`h${headingLevel}`, "panel-title", title));
  if (description) heading.append(contentElement("p", "panel-note", description));
  if (meta) heading.append(contentElement("div", "panel-meta", meta));
  header.append(heading);

  if (panelAction) {
    const actions = el("div", "panel-tools panel-actions");
    appendContent(actions, panelAction);
    header.append(actions);
  }
  return header;
}

export function metricCard(labelOrOptions, value, note, statusNode) {
  let config;
  if (labelOrOptions && typeof labelOrOptions === "object" && !isNode(labelOrOptions)) {
    config = labelOrOptions;
  } else if (note && typeof note === "object" && !isNode(note) && statusNode === undefined) {
    config = { ...note, label: labelOrOptions, value };
  } else {
    config = { label: labelOrOptions, value, note, statusNode };
  }

  const {
    label,
    value: metricValue,
    note: metricNote,
    statusNode: metricStatus,
    status,
    delta,
    deltaStatus,
    visual,
    sparkline,
    footer,
    tone,
    className,
    ariaLabel = label,
    loading = false
  } = config;
  const card = el("article", classNames("metric-card", className));
  if (ariaLabel) card.setAttribute("aria-label", ariaLabel);
  if (tone) card.dataset.tone = tone;
  if (status) card.dataset.status = status;
  if (loading) card.setAttribute("aria-busy", "true");

  card.append(
    contentElement("p", "metric-label", label),
    contentElement("p", "metric-value", metricValue)
  );
  if (delta !== undefined && delta !== null) {
    const deltaNode = contentElement("span", "metric-delta", delta);
    if (deltaStatus) deltaNode.dataset.status = deltaStatus;
    card.append(deltaNode);
  }
  if (metricNote !== undefined && metricNote !== null) {
    card.append(contentElement("p", "metric-note", metricNote));
  }
  if (metricStatus) card.append(metricStatus);

  const metricVisual = visual || sparkline;
  if (metricVisual) {
    const visualWrap = el("div", "metric-visual");
    appendContent(visualWrap, metricVisual);
    card.append(visualWrap);
  }
  if (footer) card.append(contentElement("div", "metric-footer", footer));
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
