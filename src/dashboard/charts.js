import Chart from "chart.js/auto";

const charts = new Set();

export const DATA_COLORS = Object.freeze({
  network: "#49bfae",
  networkSecondary: "#5da6bd",
  sol: "#d0a03a",
  negative: "#d66c68",
  categorical: Object.freeze([
    "#49bfae",
    "#5da6bd",
    "#d0a03a",
    "#8e7eb0",
    "#c8766f",
    "#7f9d86",
    "#98a09c"
  ])
});

const CHART_SURFACES = Object.freeze({
  text: "#929a96",
  tooltip: "#121615",
  tooltipBorder: "rgba(255,255,255,.12)",
  tooltipText: "#e8ece9",
  grid: "rgba(255,255,255,.055)",
  border: "rgba(255,255,255,.07)"
});

Chart.defaults.color = CHART_SURFACES.text;
Chart.defaults.borderColor = CHART_SURFACES.border;
Chart.defaults.font.family = "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif";
Chart.defaults.plugins.tooltip.backgroundColor = CHART_SURFACES.tooltip;
Chart.defaults.plugins.tooltip.borderColor = CHART_SURFACES.tooltipBorder;
Chart.defaults.plugins.tooltip.borderWidth = 1;
Chart.defaults.plugins.tooltip.titleColor = CHART_SURFACES.tooltipText;
Chart.defaults.plugins.tooltip.bodyColor = CHART_SURFACES.tooltipText;
Chart.defaults.plugins.tooltip.cornerRadius = 6;

function utcTick(value, spanMs) {
  const options = spanMs <= 3 * 86_400_000
    ? { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" }
    : { month: "short", day: "numeric", timeZone: "UTC" };
  return new Date(Number(value)).toLocaleString("en-US", options);
}

function baseOptions(yFormatter, timestamps, { beginAtZero = false, stacked = false } = {}) {
  const fullSpanMs = Math.max(0, timestamps.at(-1) - timestamps[0]);
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: "index" },
    animation: false,
    plugins: {
      legend: {
        display: true,
        align: "start",
        labels: { usePointStyle: true, boxWidth: 7, boxHeight: 7, padding: 16, font: { size: 11 } }
      },
      tooltip: {
        backgroundColor: CHART_SURFACES.tooltip,
        borderColor: CHART_SURFACES.tooltipBorder,
        borderWidth: 1,
        titleColor: CHART_SURFACES.tooltipText,
        bodyColor: CHART_SURFACES.tooltipText,
        cornerRadius: 6,
        padding: 10,
        callbacks: {
          title: (items) => items.length ? new Date(items[0].parsed.x).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) : "",
          label: (context) => `${context.dataset.label}: ${yFormatter(context.parsed.y)}`
        }
      }
    },
    scales: {
      x: {
        type: "linear",
        stacked,
        ...(fullSpanMs > 0 ? { min: timestamps[0], max: timestamps.at(-1) } : {}),
        grid: { display: false },
        ticks: {
          maxTicksLimit: 6,
          maxRotation: 0,
          callback(value) {
            const visibleSpanMs = Number(this.max) - Number(this.min);
            return utcTick(value, Number.isFinite(visibleSpanMs) ? visibleSpanMs : fullSpanMs);
          }
        }
      },
      y: {
        beginAtZero,
        stacked,
        grace: "4%",
        grid: { color: CHART_SURFACES.grid },
        ticks: { maxTicksLimit: 7, padding: 8, callback: yFormatter }
      }
    }
  };
}

function colorWithAlpha(color, alpha) {
  if (/^#[0-9a-f]{6}$/i.test(color)) {
    const value = Number.parseInt(color.slice(1), 16);
    return `rgba(${value >> 16}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
  }
  return color;
}

function accessibleTimestamp(value) {
  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC"
  });
}

function enableKeyboardTooltip(canvas, chart, validIndices, describe) {
  if (validIndices.length === 0) return;
  const status = canvas.parentElement?.querySelector(".chart-a11y-status");
  let cursor = validIndices.length - 1;

  const activate = () => {
    const index = validIndices[cursor];
    const active = chart.data.datasets.flatMap((dataset, datasetIndex) => {
      const value = dataset.data[index];
      return value === null || value?.y === null ? [] : [{ datasetIndex, index }];
    });
    chart.setActiveElements(active);
    if (chart.tooltip && active.length > 0) {
      const element = chart.getDatasetMeta(active[0].datasetIndex).data[active[0].index];
      const position = element?.getCenterPoint?.() || { x: chart.width / 2, y: chart.height / 2 };
      chart.tooltip.setActiveElements(active, position);
    }
    chart.update("none");
    if (status) status.textContent = describe(index);
  };

  canvas.addEventListener("focus", activate);
  canvas.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") cursor = Math.max(0, cursor - 1);
    else if (event.key === "ArrowRight") cursor = Math.min(validIndices.length - 1, cursor + 1);
    else if (event.key === "Home") cursor = 0;
    else if (event.key === "End") cursor = validIndices.length - 1;
    else return;
    event.preventDefault();
    activate();
  });
  canvas.addEventListener("blur", () => {
    chart.setActiveElements([]);
    chart.tooltip?.setActiveElements([], { x: 0, y: 0 });
    chart.update("none");
  });
}

export function lineChart(canvas, labels, datasets, yFormatter, { beginAtZero = false, keyboardTooltip = true, managed = true } = {}) {
  const timestamps = labels.map((label) => Date.parse(label));
  if (timestamps.some((value) => !Number.isFinite(value))) throw new Error("Chart labels must be ISO timestamps");
  const points = timestamps.map((x, index) => ({ x, index }));
  const chart = new Chart(canvas, {
    type: "line",
    data: { datasets: datasets.map((dataset, index) => {
      const color = dataset.color || DATA_COLORS.categorical[index % DATA_COLORS.categorical.length];
      return {
        ...dataset,
        data: points.map((point) => ({ x: point.x, y: point.index === null ? null : dataset.data[point.index] })),
        borderColor: color,
        backgroundColor: dataset.backgroundColor || colorWithAlpha(color, 0.09),
        borderWidth: 2,
        fill: dataset.fill ?? false,
        pointRadius: labels.length < 3 ? 3 : 0,
        pointHoverRadius: 4,
        tension: dataset.tension ?? 0.22,
        spanGaps: dataset.spanGaps ?? true
      };
    }) },
    options: { ...baseOptions(yFormatter, timestamps, { beginAtZero }), parsing: false }
  });
  const first = timestamps[0];
  const last = timestamps.at(-1);
  const summary = datasets.map((dataset) => `${dataset.label}: ${yFormatter(dataset.data[0])} to ${yFormatter(dataset.data.at(-1))}`).join("; ");
  const accessNote = keyboardTooltip
    ? "Focus and use left or right arrow keys to inspect points; the full series is available in data.json."
    : "The source values for the visible range are available in the adjacent table and the full series is available in data.json.";
  canvas.setAttribute("aria-label", `${canvas.getAttribute("aria-label")}. ${summary}, from ${accessibleTimestamp(first)} to ${accessibleTimestamp(last)}. ${accessNote}`);
  const validIndices = points.map((point, index) => point.index === null ? -1 : index).filter((index) => index >= 0);
  if (keyboardTooltip) {
    enableKeyboardTooltip(canvas, chart, validIndices, (index) => {
      const timestamp = points[index].x;
      const values = chart.data.datasets.map((dataset) => `${dataset.label}: ${yFormatter(dataset.data[index].y)}`).join("; ");
      return `${accessibleTimestamp(timestamp)} UTC. ${values}`;
    });
  }
  if (managed) charts.add(chart);
  return chart;
}

export function stackedBarChart(canvas, labels, datasets, yFormatter, { keyboardTooltip = true, managed = true } = {}) {
  const timestamps = labels.map((label) => Date.parse(label));
  if (timestamps.some((value) => !Number.isFinite(value))) throw new Error("Chart labels must be ISO timestamps");
  const points = timestamps.map((x, index) => ({ x, index }));
  const chart = new Chart(canvas, {
    type: "bar",
    data: {
      datasets: datasets.map((dataset, index) => {
        const color = dataset.color || DATA_COLORS.categorical[index % DATA_COLORS.categorical.length];
        return {
          ...dataset,
          data: points.map((point) => ({ x: point.x, y: dataset.data[point.index] })),
          backgroundColor: dataset.backgroundColor || colorWithAlpha(color, 0.78),
          borderColor: color,
          borderWidth: 1,
          borderRadius: 3,
          borderSkipped: false,
          stack: "rev-components"
        };
      })
    },
    options: {
      ...baseOptions(yFormatter, timestamps, { beginAtZero: true, stacked: true }),
      parsing: false,
      datasets: { bar: { barPercentage: 0.82, categoryPercentage: 0.8 } }
    }
  });

  const first = timestamps[0];
  const last = timestamps.at(-1);
  const firstTotal = datasets.reduce((total, dataset) => total + dataset.data[0], 0);
  const lastTotal = datasets.reduce((total, dataset) => total + dataset.data.at(-1), 0);
  canvas.setAttribute(
    "aria-label",
    `${canvas.getAttribute("aria-label")}. Stacked total: ${yFormatter(firstTotal)} to ${yFormatter(lastTotal)}, from ${accessibleTimestamp(first)} to ${accessibleTimestamp(last)}. ${keyboardTooltip ? "Focus and use left or right arrow keys to inspect source components." : "The source values for the visible range are available in the adjacent table and the full series is available in data.json."}`
  );
  if (keyboardTooltip) {
    enableKeyboardTooltip(canvas, chart, points.map((_point, index) => index), (index) => {
      const values = datasets.map((dataset) => `${dataset.label}: ${yFormatter(dataset.data[index])}`);
      const total = datasets.reduce((sum, dataset) => sum + dataset.data[index], 0);
      return `${accessibleTimestamp(points[index].x)} UTC. ${values.join("; ")}; REV total: ${yFormatter(total)}`;
    });
  }
  if (managed) charts.add(chart);
  return chart;
}

export function destroyChart(chart) {
  if (!chart) return;
  charts.delete(chart);
  chart.destroy();
}

export function destroyCharts() {
  for (const chart of charts) chart.destroy();
  charts.clear();
}
