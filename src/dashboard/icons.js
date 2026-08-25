const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

const iconDefinitions = Object.freeze({
  brand: [
    ["path", { d: "M12 2.75 19.5 7v10L12 21.25 4.5 17V7L12 2.75Z" }],
    ["circle", { cx: "12", cy: "12", r: "3.1" }],
    ["path", { d: "M12 5.9v3M12 15.1v3M6.7 9l2.6 1.5m5.4 3 2.6 1.5m0-6-2.6 1.5m-5.4 3L6.7 15" }]
  ],
  overview: [
    ["rect", { x: "3", y: "3", width: "7", height: "7", rx: "1" }],
    ["rect", { x: "14", y: "3", width: "7", height: "7", rx: "1" }],
    ["rect", { x: "3", y: "14", width: "7", height: "7", rx: "1" }],
    ["rect", { x: "14", y: "14", width: "7", height: "7", rx: "1" }]
  ],
  network: [
    ["circle", { cx: "12", cy: "12", r: "9" }],
    ["path", { d: "M3.6 9h16.8M3.6 15h16.8M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" }]
  ],
  validators: [
    ["path", { d: "M5 6.5h14M5 12h14M5 17.5h14" }],
    ["circle", { cx: "8", cy: "6.5", r: "2" }],
    ["circle", { cx: "16", cy: "12", r: "2" }],
    ["circle", { cx: "10", cy: "17.5", r: "2" }]
  ],
  economy: [
    ["path", { d: "M4 19V9m5 10V5m6 14v-7m5 7V3" }],
    ["path", { d: "M2.5 21h19" }]
  ],
  ecosystem: [
    ["circle", { cx: "12", cy: "5", r: "2.5" }],
    ["circle", { cx: "5", cy: "18", r: "2.5" }],
    ["circle", { cx: "19", cy: "18", r: "2.5" }],
    ["path", { d: "m10.7 7.2-4.4 8.6m7-8.6 4.4 8.6M7.5 18h9" }]
  ],
  sources: [
    ["ellipse", { cx: "12", cy: "5", rx: "7.5", ry: "3" }],
    ["path", { d: "M4.5 5v7c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V5M4.5 12v7c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-7" }]
  ],
  database: [
    ["ellipse", { cx: "12", cy: "5", rx: "7.5", ry: "3" }],
    ["path", { d: "M4.5 5v7c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V5M4.5 12v7c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-7" }]
  ],
  report: [
    ["path", { d: "M6 2.75h8l4 4V21.25H6z" }],
    ["path", { d: "M14 2.75v4h4M9 12h6M9 16h6" }]
  ],
  json: [
    ["path", { d: "M9 4.5H7.5A1.5 1.5 0 0 0 6 6v3a2 2 0 0 1-2 2 2 2 0 0 1 2 2v3a1.5 1.5 0 0 0 1.5 1.5H9M15 4.5h1.5A1.5 1.5 0 0 1 18 6v3a2 2 0 0 0 2 2 2 2 0 0 0-2 2v3a1.5 1.5 0 0 1-1.5 1.5H15" }]
  ],
  methodology: [
    ["path", { d: "M8 4H5v16h14V4h-3" }],
    ["path", { d: "M9 2h6v4H9zM8 11h8M8 15h6" }]
  ],
  refresh: [
    ["path", { d: "M20 6v5h-5M4 18v-5h5" }],
    ["path", { d: "M18.3 9A7.5 7.5 0 0 0 5.7 6.7L4 11m16 2-1.7 4.3A7.5 7.5 0 0 1 5.7 15" }]
  ],
  menu: [["path", { d: "M4 7h16M4 12h16M4 17h16" }]],
  close: [["path", { d: "m6 6 12 12M18 6 6 18" }]]
});

/**
 * Create a small inline line icon without parsing HTML strings.
 * Icons are decorative by default. Pass a title to expose one as an image.
 */
export function createIcon(name, { size = 18, className = "", title = "" } = {}) {
  const definition = iconDefinitions[name];
  if (!definition) return null;

  const svg = document.createElementNS(SVG_NAMESPACE, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.6");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("focusable", "false");
  if (className) svg.setAttribute("class", className);

  if (title) {
    const titleNode = document.createElementNS(SVG_NAMESPACE, "title");
    titleNode.textContent = title;
    svg.append(titleNode);
    svg.setAttribute("role", "img");
  } else {
    svg.setAttribute("aria-hidden", "true");
  }

  for (const [tagName, attributes] of definition) {
    const node = document.createElementNS(SVG_NAMESPACE, tagName);
    for (const [attribute, value] of Object.entries(attributes)) node.setAttribute(attribute, value);
    svg.append(node);
  }

  return svg;
}

/** Mount every known `[data-icon]` placeholder below `root`. */
export function mountIcons(root = document) {
  for (const placeholder of root.querySelectorAll("[data-icon]")) {
    if (placeholder.dataset.iconMounted === "true") continue;
    const icon = createIcon(placeholder.dataset.icon);
    if (!icon) continue;
    placeholder.replaceChildren(icon);
    placeholder.dataset.iconMounted = "true";
  }
}
