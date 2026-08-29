import { buildProviderComparisonSpec } from "./provider-comparison.js";
import { fitChartXDomain } from "./charts.js";
import { el } from "./ui.js";
import { chartPanel } from "./view-utils.js";

function providerControls(spec, update) {
  const controls = el("div", "provider-selector");
  const heading = el("div", "provider-selector-heading");
  heading.append(el("span", "provider-selector-label", "Providers"));
  const count = el("span", "provider-selector-count");
  heading.append(count);

  const options = el("div", "provider-selector-options");
  options.setAttribute("role", "group");
  options.setAttribute("aria-label", `${spec.title} providers`);
  const buttons = [];

  for (const provider of spec.providerSeries) {
    const datasetIndex = spec.datasets.findIndex((dataset) => dataset.providerName === provider.providerName);
    const dataset = spec.datasets[datasetIndex];
    if (!dataset) continue;
    const button = el("button", "provider-selector-button");
    button.type = "button";
    button.dataset.provider = provider.providerName;
    button.style.setProperty("--provider-color", dataset.color);
    button.title = provider.dataThrough
      ? `${provider.providerName} · data through ${provider.dataThrough}`
      : provider.providerName;
    button.append(el("span", "provider-selector-dot"), document.createTextNode(provider.providerName));
    button.addEventListener("click", () => {
      const visible = spec.datasets.filter((item) => item.providerName && item.hidden !== true);
      if (dataset.hidden !== true && visible.length === 1) return;
      dataset.hidden = dataset.hidden !== true;
      update(datasetIndex, dataset.hidden);
      sync();
    });
    options.append(button);
    buttons.push({ button, dataset });
  }

  const showAll = el("button", "provider-selector-all", "Show all");
  showAll.type = "button";
  showAll.addEventListener("click", () => {
    for (const { dataset } of buttons) dataset.hidden = false;
    update();
    sync();
  });
  options.append(showAll);

  function sync() {
    const visibleCount = buttons.filter(({ dataset }) => dataset.hidden !== true).length;
    count.textContent = `${visibleCount} of ${buttons.length} shown`;
    showAll.disabled = visibleCount === buttons.length;
    for (const { button, dataset } of buttons) {
      const selected = dataset.hidden !== true;
      button.setAttribute("aria-pressed", String(selected));
      button.setAttribute("aria-disabled", String(selected && visibleCount === 1));
    }
  }

  sync();
  controls.append(heading, options);
  return controls;
}

export function providerComparisonPanel(snapshot, metricId, options = {}) {
  const spec = buildProviderComparisonSpec(snapshot, metricId, options);
  if (!spec) return null;

  const chart = chartPanel(spec, {
    className: options.className,
    meta: options.meta || []
  });
  let instance;
  const controls = providerControls(spec, (datasetIndex, hidden) => {
    if (!instance) return;
    if (datasetIndex === undefined) {
      spec.datasets.forEach((dataset, index) => {
        instance.data.datasets[index].hidden = dataset.hidden === true;
      });
    } else {
      instance.data.datasets[datasetIndex].hidden = hidden;
    }
    fitChartXDomain(instance);
    instance.update("none");
  });
  const chartWrap = chart.card.querySelector(".chart-wrap");
  chart.card.insertBefore(controls, chartWrap);

  return {
    card: chart.card,
    spec,
    draw() {
      instance = chart.draw();
      return instance;
    }
  };
}
