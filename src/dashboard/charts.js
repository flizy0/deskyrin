import Chart from "chart.js/auto";

const charts = [];
const COLORS = ["#8b5cf6", "#2dd4bf", "#f59e0b", "#60a5fa", "#f472b6", "#a3e635", "#fb7185", "#94a3b8", "#c084fc", "#22d3ee", "#64748b"];

Chart.defaults.color = "#a9adbd";
Chart.defaults.borderColor = "rgba(255,255,255,.08)";
Chart.defaults.font.family = "Inter, ui-sans-serif, system-ui, sans-serif";

function utcTick(value, spanMs) {
  const options = spanMs <= 3 * 86_400_000
    ? { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" }
    : { month: "short", day: "numeric", timeZone: "UTC" };
  return new Date(Number(value)).toLocaleString("en-US", options);
}

function expandGaps(timestamps) {
  if (timestamps.length < 3) return timestamps.map((x, index) => ({ x, index }));
  const deltas = timestamps.slice(1).map((value, index) => value - timestamps[index]).filter((value) => value > 0).sort((a, b) => a - b);
  const cadence = deltas[Math.floor((deltas.length - 1) / 2)];
  const expanded = [];
  for (const [index, timestamp] of timestamps.entries()) {
    if (index > 0 && timestamp - timestamps[index - 1] > cadence * 1.75) {
      expanded.push({ x: timestamps[index - 1] + cadence, index: null });
      if (timestamp - cadence > timestamps[index - 1] + cadence) expanded.push({ x: timestamp - cadence, index: null });
    }
    expanded.push({ x: timestamp, index });
  }
  return expanded;
}

function baseOptions(yFormatter, timestamps) {
  const spanMs = Math.max(0, timestamps.at(-1) - timestamps[0]);
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: "index" },
    animation: false,
    plugins: {
      legend: { display: true, labels: { usePointStyle: true, boxWidth: 8, boxHeight: 8 } },
      tooltip: {
        backgroundColor: "#171821",
        borderColor: "rgba(255,255,255,.14)",
        borderWidth: 1,
        padding: 12,
        callbacks: {
          title: (items) => items.length ? new Date(items[0].parsed.x).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) : "",
          label: (context) => `${context.dataset.label}: ${yFormatter(context.parsed.y)}`
        }
      }
    },
    scales: {
      x: { type: "linear", grid: { display: false }, ticks: { maxTicksLimit: 6, maxRotation: 0, callback: (value) => utcTick(value, spanMs) } },
      y: { beginAtZero: false, ticks: { maxTicksLimit: 5, callback: yFormatter } }
    }
  };
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

export function lineChart(canvas, labels, datasets, yFormatter) {
  const timestamps = labels.map((label) => Date.parse(label));
  if (timestamps.some((value) => !Number.isFinite(value))) throw new Error("Chart labels must be ISO timestamps");
  const points = expandGaps(timestamps);
  const chart = new Chart(canvas, {
    type: "line",
    data: { datasets: datasets.map((dataset, index) => ({
        ...dataset,
        data: points.map((point) => ({ x: point.x, y: point.index === null ? null : dataset.data[point.index] })),
        borderColor: dataset.color || COLORS[index],
        backgroundColor: dataset.color || COLORS[index],
        borderWidth: 2,
        pointRadius: labels.length < 3 ? 3 : 0,
        pointHoverRadius: 4,
        tension: 0.25,
        spanGaps: false
      })) },
    options: { ...baseOptions(yFormatter, timestamps), parsing: false }
  });
  const first = timestamps[0];
  const last = timestamps.at(-1);
  const summary = datasets.map((dataset) => `${dataset.label}: ${yFormatter(dataset.data[0])} to ${yFormatter(dataset.data.at(-1))}`).join("; ");
  canvas.setAttribute("aria-label", `${canvas.getAttribute("aria-label")}. ${summary}, from ${accessibleTimestamp(first)} to ${accessibleTimestamp(last)}. Focus and use left or right arrow keys to inspect points; the full series is available in data.json.`);
  const validIndices = points.map((point, index) => point.index === null ? -1 : index).filter((index) => index >= 0);
  enableKeyboardTooltip(canvas, chart, validIndices, (index) => {
    const timestamp = points[index].x;
    const values = chart.data.datasets.map((dataset) => `${dataset.label}: ${yFormatter(dataset.data[index].y)}`).join("; ");
    return `${accessibleTimestamp(timestamp)} UTC. ${values}`;
  });
  charts.push(chart);
  return chart;
}

export function doughnutChart(canvas, labels, values, formatter) {
  const chart = new Chart(canvas, {
    type: "doughnut",
    data: { labels, datasets: [{ data: values, backgroundColor: labels.map((_label, index) => COLORS[index % COLORS.length]), borderWidth: 0, hoverOffset: 5 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      cutout: "68%",
      plugins: {
        legend: { position: "bottom", labels: { usePointStyle: true, boxWidth: 8, boxHeight: 8 } },
        tooltip: { callbacks: { label: (context) => `${context.label}: ${formatter(context.parsed)}` } }
      }
    }
  });
  canvas.setAttribute("aria-label", `${canvas.getAttribute("aria-label")}. ${labels.map((label, index) => `${label}: ${formatter(values[index])}`).join("; ")}. Focus and use left or right arrow keys to inspect slices; the full distribution is available in data.json.`);
  enableKeyboardTooltip(canvas, chart, labels.map((_label, index) => index), (index) => `${labels[index]}: ${formatter(values[index])}`);
  charts.push(chart);
  return chart;
}

export function destroyCharts() {
  while (charts.length) charts.pop().destroy();
}
