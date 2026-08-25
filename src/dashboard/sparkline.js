const SVG_NS = "http://www.w3.org/2000/svg";

function svgElement(tag) {
  return document.createElementNS(SVG_NS, tag);
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function defaultValue(point) {
  if (typeof point === "number") return point;
  if (!point || typeof point !== "object") return Number.NaN;
  for (const key of ["value", "y", "price", "total", "amount"]) {
    if (Number.isFinite(Number(point[key]))) return Number(point[key]);
  }
  return Number.NaN;
}

function defaultTime(point, index) {
  if (!point || typeof point !== "object") return index;
  const raw = point.timestamp ?? point.observedAt ?? point.date ?? point.time ?? point.x;
  if (raw === undefined || raw === null) return index;
  if (raw instanceof Date) return raw.getTime();
  if (typeof raw === "number") return raw;
  return Date.parse(raw);
}

function finitePoints(values, getValue, getTime) {
  if (!Array.isArray(values)) return [];
  const points = [];
  for (const [index, point] of values.entries()) {
    const value = Number(getValue(point, index));
    const time = Number(getTime(point, index));
    if (Number.isFinite(value) && Number.isFinite(time)) points.push({ value, time, index });
  }
  return points.sort((left, right) => left.time - right.time || left.index - right.index);
}

function rounded(value) {
  return Number(value.toFixed(2));
}

function pathData(points) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"}${rounded(point.x)} ${rounded(point.y)}`).join(" ");
}

/**
 * Creates a small dependency-free SVG trend line.
 *
 * Numeric arrays work without options. Object series can provide getValue and
 * getTime accessors; common value/timestamp keys are detected by default.
 * Sparklines are decorative unless a label is supplied or decorative is false.
 */
export function sparkline(values, options = {}) {
  const width = positiveNumber(options.width, 120);
  const height = positiveNumber(options.height, 32);
  const padding = Math.min(positiveNumber(options.padding, 2), Math.min(width, height) / 2);
  const strokeWidth = positiveNumber(options.strokeWidth, 1.5);
  const getValue = options.getValue || options.valueAccessor || defaultValue;
  const getTime = options.getTime || options.timeAccessor || defaultTime;
  const color = options.color || "currentColor";
  const points = finitePoints(values, getValue, getTime);

  const svg = svgElement("svg");
  svg.setAttribute("class", options.className || "sparkline");
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("focusable", "false");
  svg.dataset.pointCount = String(points.length);
  if (options.tone) svg.dataset.tone = options.tone;

  const decorative = options.decorative !== false && !options.label;
  if (decorative) {
    svg.setAttribute("aria-hidden", "true");
  } else {
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", options.label || "Metric trend");
  }

  if (points.length === 0) return svg;

  const valuesOnly = points.map((point) => point.value);
  const times = points.map((point) => point.time);
  const minValue = Math.min(...valuesOnly);
  const maxValue = Math.max(...valuesOnly);
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const plotWidth = Math.max(0, width - padding * 2);
  const plotHeight = Math.max(0, height - padding * 2);
  const sameTime = maxTime === minTime;
  const sameValue = maxValue === minValue;

  const plotted = points.map((point, index) => ({
    x: sameTime
      ? padding + (points.length === 1 ? plotWidth / 2 : index / (points.length - 1) * plotWidth)
      : padding + (point.time - minTime) / (maxTime - minTime) * plotWidth,
    y: sameValue
      ? padding + plotHeight / 2
      : padding + (maxValue - point.value) / (maxValue - minValue) * plotHeight
  }));

  if (plotted.length === 1) {
    const dot = svgElement("circle");
    dot.setAttribute("class", "sparkline-point");
    dot.setAttribute("cx", String(rounded(plotted[0].x)));
    dot.setAttribute("cy", String(rounded(plotted[0].y)));
    dot.setAttribute("r", String(Math.max(strokeWidth, 1.5)));
    dot.setAttribute("fill", color);
    svg.append(dot);
    return svg;
  }

  const lineData = pathData(plotted);
  if (options.fill) {
    const area = svgElement("path");
    const baseline = height - padding;
    area.setAttribute("class", "sparkline-area");
    area.setAttribute(
      "d",
      `${lineData} L${rounded(plotted[plotted.length - 1].x)} ${rounded(baseline)} L${rounded(plotted[0].x)} ${rounded(baseline)} Z`
    );
    area.setAttribute("fill", color);
    area.setAttribute("fill-opacity", String(options.fillOpacity ?? 0.09));
    svg.append(area);
  }

  const path = svgElement("path");
  path.setAttribute("class", "sparkline-line");
  path.setAttribute("d", lineData);
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", color);
  path.setAttribute("stroke-width", String(strokeWidth));
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  path.setAttribute("vector-effect", "non-scaling-stroke");
  svg.append(path);
  return svg;
}
