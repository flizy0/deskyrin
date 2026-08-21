import "./styles.css";
import { renderDashboard } from "./render.js";

async function load() {
  const response = await fetch("/data.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`data.json returned HTTP ${response.status}`);
  const data = await response.json();
  if (data.schemaVersion !== "1.0.0" || !data.network || !data.validators || !data.economics || !data.ecosystem) {
    throw new Error("data.json has an unsupported or incomplete schema");
  }
  renderDashboard(data);
}

load().catch((error) => {
  const panel = document.querySelector("#load-error");
  panel.hidden = false;
  panel.textContent = `Dashboard data is unavailable: ${error.message}`;
  document.querySelector("#overall-status").textContent = "unavailable";
});
