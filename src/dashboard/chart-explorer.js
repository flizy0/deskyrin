import { destroyChart, fitChartXDomain, lineChart, stackedBarChart } from "./charts.js";
import {
  clampRange,
  normalizeTimestamps,
  panRange,
  presetRange,
  visibleDataTimestampBounds,
  visiblePointIndexes,
  zoomRange
} from "./chart-range.js";

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const PRESETS = [
  { label: "24H", duration: DAY_MS },
  { label: "7D", duration: 7 * DAY_MS },
  { label: "30D", duration: 30 * DAY_MS },
  { label: "All", duration: null }
];

let explorer;
let active;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(label, className = "chart-explorer-button") {
  const node = el("button", className, label);
  node.type = "button";
  return node;
}

function utc(value) {
  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "UTC"
  });
}

function sameRange(left, right) {
  return Math.abs(left.min - right.min) < 1 && Math.abs(left.max - right.max) < 1;
}

function deriveMinimumRange(timestamps, bounds) {
  const gaps = [];
  const sorted = normalizeTimestamps(timestamps);
  for (let index = 1; index < sorted.length; index += 1) {
    const gap = sorted[index] - sorted[index - 1];
    if (gap > 0) gaps.push(gap);
  }
  return gaps.length ? Math.min(...gaps) : Math.max(0, bounds.max - bounds.min);
}

function createExplorer() {
  const dialog = el("dialog", "chart-explorer");
  dialog.id = "chart-explorer";
  dialog.dataset.chartExplorerDialog = "";
  dialog.setAttribute("aria-labelledby", "chart-explorer-title");
  dialog.setAttribute("aria-describedby", "chart-explorer-note chart-explorer-instructions");

  const shell = el("div", "chart-explorer-shell");
  const head = el("header", "chart-explorer-head");
  const heading = el("div", "chart-explorer-heading");
  const eyebrow = el("p", "eyebrow", "Interactive source history");
  const title = el("h2", "chart-explorer-title");
  title.id = "chart-explorer-title";
  const note = el("p", "chart-explorer-note");
  note.id = "chart-explorer-note";
  const metadata = el("p", "chart-explorer-metadata");
  heading.append(eyebrow, title, note, metadata);

  const closeButton = button("Close", "chart-explorer-close");
  closeButton.setAttribute("aria-label", "Close chart explorer");
  closeButton.autofocus = true;
  head.append(heading, closeButton);

  const toolbar = el("div", "chart-explorer-toolbar");
  const presetGroup = el("div", "chart-explorer-control-group");
  presetGroup.setAttribute("role", "group");
  presetGroup.setAttribute("aria-label", "Visible time range");
  const presetButtons = PRESETS.map((preset) => {
    const node = button(preset.label);
    node.dataset.duration = preset.duration === null ? "all" : String(preset.duration);
    node.setAttribute("aria-pressed", "false");
    presetGroup.append(node);
    return node;
  });

  const navigationGroup = el("div", "chart-explorer-control-group");
  navigationGroup.setAttribute("role", "group");
  navigationGroup.setAttribute("aria-label", "Chart navigation");
  const zoomIn = button("Zoom in");
  const zoomOut = button("Zoom out");
  const panLeft = button("Pan left");
  const panRight = button("Pan right");
  const reset = button("Reset view");
  navigationGroup.append(zoomIn, zoomOut, panLeft, panRight, reset);
  toolbar.append(presetGroup, navigationGroup);

  const instructions = el("p", "chart-explorer-instructions", "Wheel or pinch to zoom. Drag horizontally to pan. Use the controls for keyboard navigation.");
  instructions.id = "chart-explorer-instructions";

  const plot = el("div", "chart-explorer-plot");
  const windowOutput = el("output", "chart-explorer-window");
  windowOutput.dataset.chartExplorerWindow = "";
  windowOutput.setAttribute("aria-live", "polite");

  const tableWrap = el("div", "table-wrap chart-explorer-table-wrap");
  const table = document.createElement("table");
  table.dataset.chartExplorerTable = "";
  const caption = table.createCaption();
  const tableHead = document.createElement("thead");
  const tableBody = document.createElement("tbody");
  table.append(tableHead, tableBody);
  tableWrap.append(table);

  shell.append(head, toolbar, instructions, plot, windowOutput, tableWrap);
  dialog.append(shell);
  document.body.append(dialog);

  const controls = { zoomIn, zoomOut, panLeft, panRight, reset };
  closeButton.addEventListener("click", () => dialog.close());
  zoomIn.addEventListener("click", () => active?.controller.zoom(0.75));
  zoomOut.addEventListener("click", () => active?.controller.zoom(1.34));
  panLeft.addEventListener("click", () => active?.controller.pan(-0.2));
  panRight.addEventListener("click", () => active?.controller.pan(0.2));
  reset.addEventListener("click", () => active?.controller.reset());
  for (const node of presetButtons) {
    node.addEventListener("click", () => active?.controller.preset(node.dataset.duration));
  }
  dialog.addEventListener("close", teardownActiveExplorer);

  return {
    caption,
    closeButton,
    controls,
    dialog,
    metadata,
    note,
    plot,
    presetButtons,
    tableBody,
    tableHead,
    title,
    windowOutput
  };
}

function ensureExplorer() {
  explorer ||= createExplorer();
  return explorer;
}

function updateYAxis(chart, range, fullRange) {
  const yScale = chart.options.scales.y;
  if (sameRange(range, fullRange)) {
    delete yScale.min;
    delete yScale.max;
    return;
  }

  const values = [];
  if (yScale.stacked === true) {
    const pointCount = Math.max(0, ...chart.data.datasets.map((dataset) => dataset.data.length));
    for (let index = 0; index < pointCount; index += 1) {
      let positive = 0;
      let negative = 0;
      let hasValue = false;
      for (const dataset of chart.data.datasets) {
        const point = dataset.data[index];
        if (!point || point.x < range.min || point.x > range.max || !Number.isFinite(point.y)) continue;
        hasValue = true;
        if (point.y >= 0) positive += point.y;
        else negative += point.y;
      }
      if (hasValue) values.push(positive, negative);
    }
  } else {
    for (const dataset of chart.data.datasets) {
      for (const point of dataset.data) {
        if (point.x >= range.min && point.x <= range.max && Number.isFinite(point.y)) values.push(point.y);
      }
    }
  }
  if (values.length === 0) {
    delete yScale.min;
    delete yScale.max;
    return;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = min === max ? Math.max(Math.abs(min) * 0.04, 1) : (max - min) * 0.06;
  yScale.min = yScale.beginAtZero && min >= 0 ? 0 : min - padding;
  yScale.max = yScale.beginAtZero && max <= 0 ? 0 : max + padding;
}

function explorerChartType(spec) {
  const type = spec.chartType ?? spec.type ?? "line";
  if (type === "line") return "line";
  if (type === "bar" || type === "stacked-bar" || type === "stackedBar") return "stacked-bar";
  throw new TypeError(`Unsupported chart explorer type: ${type}`);
}

function renderTable(spec, timestamps, range) {
  const { caption, tableBody, tableHead } = explorer;
  const header = document.createElement("tr");
  header.append(el("th", undefined, "UTC time"));
  for (const dataset of spec.datasets) header.append(el("th", undefined, dataset.label));
  tableHead.replaceChildren(header);

  const indexes = visiblePointIndexes(timestamps, range);
  const rows = indexes.map((index) => {
    const row = document.createElement("tr");
    const iso = new Date(timestamps[index]).toISOString();
    row.dataset.timestamp = iso;
    const timeCell = document.createElement("td");
    const time = document.createElement("time");
    time.dateTime = iso;
    time.textContent = utc(timestamps[index]);
    timeCell.append(time);
    row.append(timeCell);
    for (const dataset of spec.datasets) {
      const cell = document.createElement("td");
      const value = dataset.data[index];
      if (value !== null && value !== undefined) cell.dataset.value = String(value);
      cell.textContent = value === null || value === undefined ? "—" : spec.yFormatter(value);
      row.append(cell);
    }
    return row;
  });
  tableBody.replaceChildren(...rows);
  caption.textContent = `${rows.length} source observation${rows.length === 1 ? "" : "s"} in the visible range`;
  return rows.length;
}

function chartAreaFraction(chart, clientX) {
  const rect = chart.canvas.getBoundingClientRect();
  if (rect.width === 0 || chart.width === 0) return 0.5;
  const logicalX = (clientX - rect.left) * (chart.width / rect.width);
  const width = chart.chartArea.right - chart.chartArea.left;
  if (width <= 0) return 0.5;
  return Math.min(1, Math.max(0, (logicalX - chart.chartArea.left) / width));
}

function chartAreaCssWidth(chart) {
  const rect = chart.canvas.getBoundingClientRect();
  if (chart.width === 0) return rect.width;
  return (chart.chartArea.right - chart.chartArea.left) * (rect.width / chart.width);
}

function createController(chart, spec, timestamps, initialBounds) {
  const { controls, presetButtons, windowOutput } = explorer;
  let bounds = { ...initialBounds };
  let minRange = deriveMinimumRange(timestamps.filter((value) => value >= bounds.min && value <= bounds.max), bounds);
  let fullWidth = bounds.max - bounds.min;
  const pointers = new Map();
  let animationFrame;
  let commitTimer;
  let gesture;
  let range = { ...bounds };

  function updateControls() {
    const width = range.max - range.min;
    controls.zoomIn.disabled = fullWidth === 0 || width <= minRange + 1;
    controls.zoomOut.disabled = fullWidth === 0 || sameRange(range, bounds);
    controls.panLeft.disabled = fullWidth === 0 || range.min <= bounds.min + 1;
    controls.panRight.disabled = fullWidth === 0 || range.max >= bounds.max - 1;
    controls.reset.disabled = sameRange(range, bounds);

    for (const node of presetButtons) {
      const duration = node.dataset.duration;
      const expected = duration === "all" ? bounds : presetRange(bounds, Number(duration), { minRange });
      node.disabled = duration !== "all" && Number(duration) >= fullWidth;
      node.setAttribute("aria-pressed", String(sameRange(range, expected)));
    }
  }

  function drawRange() {
    animationFrame = undefined;
    if (fullWidth === 0) {
      delete chart.options.scales.x.min;
      delete chart.options.scales.x.max;
    } else {
      chart.options.scales.x.min = range.min;
      chart.options.scales.x.max = range.max;
    }
    updateYAxis(chart, range, bounds);
    chart.update("none");
    updateControls();
  }

  function commitRange() {
    const pointCount = renderTable(spec, timestamps, range);
    const start = new Date(range.min).toISOString();
    const end = new Date(range.max).toISOString();
    windowOutput.dataset.start = start;
    windowOutput.dataset.end = end;
    windowOutput.dataset.points = String(pointCount);
    windowOutput.value = `${utc(range.min)} – ${utc(range.max)} UTC · ${pointCount} source observation${pointCount === 1 ? "" : "s"}`;
    windowOutput.textContent = windowOutput.value;
  }

  function flushDraw() {
    if (animationFrame !== undefined) cancelAnimationFrame(animationFrame);
    drawRange();
  }

  function scheduleDraw() {
    if (animationFrame === undefined) animationFrame = requestAnimationFrame(drawRange);
  }

  function scheduleCommit() {
    if (commitTimer !== undefined) clearTimeout(commitTimer);
    commitTimer = setTimeout(() => {
      commitTimer = undefined;
      flushDraw();
      commitRange();
    }, 120);
  }

  function apply(nextRange, { deferred = false, commit = true } = {}) {
    range = clampRange(nextRange, bounds, { minRange });
    if (deferred) scheduleDraw();
    else flushDraw();
    if (commit) {
      if (commitTimer !== undefined) clearTimeout(commitTimer);
      commitTimer = undefined;
      commitRange();
    }
  }

  function centeredZoom(scale) {
    const anchor = range.min + (range.max - range.min) / 2;
    apply(zoomRange(range, scale, anchor, bounds, { minRange }));
  }

  function panByFraction(fraction) {
    apply(panRange(range, (range.max - range.min) * fraction, bounds, { minRange }));
  }

  function wheel(event) {
    event.preventDefault();
    if (event.deltaY === 0) {
      if (event.deltaX !== 0) {
        apply(panRange(range, (range.max - range.min) * Math.sign(event.deltaX) * 0.08, bounds, { minRange }), { deferred: true, commit: false });
        scheduleCommit();
      }
      return;
    }
    const fraction = chartAreaFraction(chart, event.clientX);
    const anchor = range.min + (range.max - range.min) * fraction;
    apply(zoomRange(range, event.deltaY < 0 ? 0.8 : 1.25, anchor, bounds, { minRange }), { deferred: true, commit: false });
    scheduleCommit();
  }

  function beginGesture() {
    const points = [...pointers.values()];
    if (points.length === 1) {
      gesture = { kind: "pan", startX: points[0].x, range: { ...range } };
    } else if (points.length >= 2) {
      const [first, second] = points;
      const distance = Math.hypot(second.x - first.x, second.y - first.y);
      const midpointX = (first.x + second.x) / 2;
      const fraction = chartAreaFraction(chart, midpointX);
      gesture = {
        anchor: range.min + (range.max - range.min) * fraction,
        distance: Math.max(1, distance),
        kind: "pinch",
        midpointX,
        range: { ...range }
      };
    }
  }

  function pointerDown(event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    chart.canvas.setPointerCapture?.(event.pointerId);
    beginGesture();
  }

  function pointerMove(event) {
    if (!pointers.has(event.pointerId)) return;
    event.preventDefault();
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...pointers.values()];
    const width = chartAreaCssWidth(chart);
    if (!gesture || width <= 0) return;

    if (gesture.kind === "pinch" && points.length >= 2) {
      const [first, second] = points;
      const distance = Math.max(1, Math.hypot(second.x - first.x, second.y - first.y));
      const midpointX = (first.x + second.x) / 2;
      let next = zoomRange(gesture.range, gesture.distance / distance, gesture.anchor, bounds, { minRange });
      const delta = -((midpointX - gesture.midpointX) / width) * (next.max - next.min);
      next = panRange(next, delta, bounds, { minRange });
      apply(next, { deferred: true, commit: false });
    } else if (gesture.kind === "pan" && points.length === 1) {
      const delta = -((points[0].x - gesture.startX) / width) * (gesture.range.max - gesture.range.min);
      apply(panRange(gesture.range, delta, bounds, { minRange }), { deferred: true, commit: false });
    }
  }

  function finishPointer(event, releaseCapture) {
    if (!pointers.delete(event.pointerId)) return;
    if (releaseCapture && chart.canvas.hasPointerCapture?.(event.pointerId)) chart.canvas.releasePointerCapture(event.pointerId);
    if (commitTimer !== undefined) clearTimeout(commitTimer);
    commitTimer = undefined;
    flushDraw();
    commitRange();
    gesture = undefined;
    if (pointers.size > 0) beginGesture();
  }

  function pointerEnd(event) {
    finishPointer(event, true);
  }

  function pointerLost(event) {
    finishPointer(event, false);
  }

  chart.canvas.addEventListener("wheel", wheel, { passive: false });
  chart.canvas.addEventListener("pointerdown", pointerDown);
  chart.canvas.addEventListener("pointermove", pointerMove);
  chart.canvas.addEventListener("pointerup", pointerEnd);
  chart.canvas.addEventListener("pointercancel", pointerEnd);
  chart.canvas.addEventListener("lostpointercapture", pointerLost);
  apply(bounds);

  return {
    pan: panByFraction,
    preset(duration) {
      apply(duration === "all" ? bounds : presetRange(bounds, Number(duration), { minRange }));
    },
    reset() { apply(bounds); },
    setBounds(nextBounds) {
      if (!nextBounds) return;
      bounds = { ...nextBounds };
      const visibleTimestamps = timestamps.filter((value) => value >= bounds.min && value <= bounds.max);
      minRange = deriveMinimumRange(visibleTimestamps, bounds);
      fullWidth = bounds.max - bounds.min;
      apply(bounds);
    },
    zoom: centeredZoom,
    destroy() {
      chart.canvas.removeEventListener("wheel", wheel);
      chart.canvas.removeEventListener("pointerdown", pointerDown);
      chart.canvas.removeEventListener("pointermove", pointerMove);
      chart.canvas.removeEventListener("pointerup", pointerEnd);
      chart.canvas.removeEventListener("pointercancel", pointerEnd);
      chart.canvas.removeEventListener("lostpointercapture", pointerLost);
      if (animationFrame !== undefined) cancelAnimationFrame(animationFrame);
      if (commitTimer !== undefined) clearTimeout(commitTimer);
      pointers.clear();
    }
  };
}

function teardownActiveExplorer({ restoreFocus = true } = {}) {
  const current = active;
  active = undefined;
  current?.controller.destroy();
  destroyChart(current?.chart);
  explorer?.plot.replaceChildren();
  explorer?.tableBody.replaceChildren();
  if (restoreFocus && current?.opener?.isConnected) current.opener.focus();
}

export function closeChartExplorer() {
  if (explorer?.dialog.open) explorer.dialog.close();
  else teardownActiveExplorer();
}

export function openChartExplorer(spec, opener) {
  if (!spec || !Array.isArray(spec.labels) || !Array.isArray(spec.datasets) || typeof spec.yFormatter !== "function") {
    throw new TypeError("A chart explorer spec requires labels, datasets, and a formatter");
  }
  const timestamps = spec.labels.map((label) => Date.parse(label));
  const chartType = explorerChartType(spec);
  normalizeTimestamps(timestamps);
  for (const dataset of spec.datasets) {
    if (!Array.isArray(dataset.data) || dataset.data.length !== timestamps.length) {
      throw new Error("Every chart explorer dataset must align with its timestamps");
    }
  }
  const bounds = visibleDataTimestampBounds(timestamps, spec.datasets);
  if (!bounds) throw new Error("A chart explorer requires at least one visible source observation");

  const ui = ensureExplorer();
  if (ui.dialog.open) {
    ui.closeButton.focus();
    return;
  }
  ui.title.textContent = spec.title;
  ui.note.textContent = spec.note;
  const metadata = [];
  if (spec.observedAt) metadata.push(`Observed ${utc(Date.parse(spec.observedAt))} UTC`);
  if (spec.updatedAt) metadata.push(`Snapshot ${utc(Date.parse(spec.updatedAt))} UTC`);
  ui.metadata.textContent = metadata.join(" · ");
  ui.tableHead.replaceChildren();
  ui.tableBody.replaceChildren();

  const canvas = document.createElement("canvas");
  canvas.dataset.chartExplorerCanvas = "";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", `${spec.title}. ${spec.note}`);
  ui.plot.replaceChildren(canvas);
  ui.dialog.showModal();

  let chart;
  let controller;
  try {
    const handleDatasetVisibilityChange = (instance) => {
      const nextBounds = fitChartXDomain(instance);
      controller?.setBounds(nextBounds);
    };
    chart = chartType === "stacked-bar"
      ? stackedBarChart(canvas, spec.labels, spec.datasets, spec.yFormatter, {
        keyboardTooltip: false,
        managed: false,
        onDatasetVisibilityChange: handleDatasetVisibilityChange
      })
      : lineChart(canvas, spec.labels, spec.datasets, spec.yFormatter, {
        beginAtZero: spec.beginAtZero === true,
        keyboardTooltip: false,
        managed: false,
        onDatasetVisibilityChange: handleDatasetVisibilityChange
      });
    controller = createController(chart, spec, timestamps, bounds);
    chart.resize();
    active = { chart, controller, opener };
    ui.closeButton.focus();
  } catch (error) {
    controller?.destroy();
    destroyChart(chart);
    ui.dialog.close();
    ui.plot.replaceChildren();
    throw error;
  }
}
