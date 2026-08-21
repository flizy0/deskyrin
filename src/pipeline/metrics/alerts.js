import { percentageChange } from "../lib/statistics.js";

const IDS = [
  "tps-change",
  "slow-slot-time",
  "high-validator-delinquency",
  "large-tvl-change",
  "large-sol-price-move"
];

function unavailable(id, kind, metricPath, unit, window, threshold, reasonCode) {
  return { id, kind, status: "unavailable", metricPath, unit, window, threshold, reasonCode };
}

function checkToAlert(check) {
  if (check.status !== "triggered") return undefined;
  const templates = {
    "tps-change": {
      title: check.direction === "up" ? "Large TPS spike" : "Large TPS drop",
      message: `Total TPS moved ${Math.abs(check.changePct).toFixed(1)}% ${check.direction === "up" ? "above" : "below"} its prior-hour baseline.`
    },
    "slow-slot-time": {
      title: "Slow slot times",
      message: `Slot time is ${check.changePct.toFixed(1)}% above its prior-hour baseline.`
    },
    "high-validator-delinquency": {
      title: "High validator delinquency",
      message: `${check.currentValue.toFixed(2)}% of activated stake is delinquent across two fresh observations.`
    },
    "large-tvl-change": {
      title: "Large TVL change",
      message: `Solana TVL changed ${check.changePct.toFixed(1)}% between adjacent completed UTC days.`
    },
    "large-sol-price-move": {
      title: "Large SOL price move",
      message: `SOL moved ${check.changePct.toFixed(1)}% over the 24-hour reference window.`
    }
  };
  const template = templates[check.id];
  return {
    id: `${check.id}:${check.observedAt}`,
    kind: check.kind,
    severity: "warning",
    title: template.title,
    message: template.message,
    observedAt: check.observedAt,
    checkId: check.id
  };
}

export function calculateAlerts(snapshot, evidence, config) {
  const observedAt = snapshot.updatedAt;
  const checks = [];
  const performanceFresh = snapshot.network.performance.status === "fresh" && evidence?.performance;
  const retainedCheck = (id) => evidence?.previousChecks?.find((check) => check.id === id);
  const tpsThreshold = { relativePct: config.alerts.tpsRelativePct, absoluteTps: config.alerts.tpsAbsolute };
  if (snapshot.network.performance.status === "fresh" && !evidence?.performance && retainedCheck(IDS[0])) {
    checks.push(retainedCheck(IDS[0]));
  } else if (!performanceFresh) {
    checks.push(unavailable(IDS[0], "tps_change", "network.performance.tps.total", "TPS", "two adjacent five-minute bins vs prior hour", tpsThreshold, "STALE_OR_MISSING_EVIDENCE"));
  } else {
    const baseline = evidence.performance.baseline.totalTps;
    const points = evidence.performance.recent.map((point) => ({
      value: point.totalTps,
      change: percentageChange(point.totalTps, baseline),
      absolute: point.totalTps - baseline
    }));
    const up = points.every((point) => point.change >= config.alerts.tpsRelativePct && point.absolute >= config.alerts.tpsAbsolute);
    const down = points.every((point) => point.change <= -config.alerts.tpsRelativePct && point.absolute <= -config.alerts.tpsAbsolute);
    const current = points[0];
    checks.push({
      id: IDS[0], kind: "tps_change", status: up || down ? "triggered" : "normal",
      metricPath: "network.performance.tps.total", unit: "TPS", window: "two adjacent five-minute bins vs prior hour",
      threshold: tpsThreshold, ...(up || down ? { direction: up ? "up" : "down" } : {}), observedAt,
      currentValue: current.value, referenceValue: baseline, changePct: current.change
    });
  }

  const slotThreshold = { relativePct: config.alerts.slotRelativePct, absoluteMs: config.alerts.slotAbsoluteMs };
  if (snapshot.network.performance.status === "fresh" && !evidence?.performance && retainedCheck(IDS[1])) {
    checks.push(retainedCheck(IDS[1]));
  } else if (!performanceFresh) {
    checks.push(unavailable(IDS[1], "slow_slot_time", "network.performance.slotTimeMs", "ms", "two adjacent five-minute bins vs prior hour", slotThreshold, "STALE_OR_MISSING_EVIDENCE"));
  } else {
    const baseline = evidence.performance.baseline.slotTimeMs;
    const points = evidence.performance.recent.map((point) => ({ value: point.slotTimeMs, change: percentageChange(point.slotTimeMs, baseline), absolute: point.slotTimeMs - baseline }));
    const triggered = points.every((point) => point.change >= config.alerts.slotRelativePct && point.absolute >= config.alerts.slotAbsoluteMs);
    checks.push({
      id: IDS[1], kind: "slow_slot_time", status: triggered ? "triggered" : "normal",
      metricPath: "network.performance.slotTimeMs", unit: "ms", window: "two adjacent five-minute bins vs prior hour",
      threshold: slotThreshold, observedAt, currentValue: points[0].value, referenceValue: baseline, changePct: points[0].change
    });
  }

  const validatorThreshold = { percent: config.alerts.validatorDelinquencyPct, confirmations: 2 };
  const validators = snapshot.validators;
  if (validators.status !== "fresh") {
    checks.push(unavailable(IDS[2], "validator_delinquency", "validators.stake.delinquentPct", "% activated stake", "two fresh scheduled observations", validatorThreshold, "STALE_EVIDENCE"));
  } else {
    const current = validators.history.at(-1);
    const previous = validators.history.at(-2);
    if (current.delinquentStakePct < config.alerts.validatorDelinquencyPct) {
      checks.push({ id: IDS[2], kind: "validator_delinquency", status: "normal", metricPath: "validators.stake.delinquentPct", unit: "% activated stake", window: "two fresh scheduled observations", threshold: validatorThreshold, observedAt: current.observedAt, currentValue: current.delinquentStakePct });
    } else {
      const gap = previous ? new Date(current.observedAt) - new Date(previous.observedAt) : Infinity;
      const confirmed = previous && gap > 0 && gap <= config.freshness.delinquencyConfirmationGap && previous.delinquentStakePct >= config.alerts.validatorDelinquencyPct;
      checks.push(confirmed
        ? { id: IDS[2], kind: "validator_delinquency", status: "triggered", metricPath: "validators.stake.delinquentPct", unit: "% activated stake", window: "two fresh scheduled observations", threshold: validatorThreshold, observedAt: current.observedAt, currentValue: current.delinquentStakePct, referenceValue: previous.delinquentStakePct }
        : unavailable(IDS[2], "validator_delinquency", "validators.stake.delinquentPct", "% activated stake", "two fresh scheduled observations", validatorThreshold, "PENDING_CONFIRMATION"));
    }
  }

  const tvl = snapshot.economics.tvlAlertInput;
  const tvlThreshold = { absolutePct: config.alerts.tvlChangePct };
  checks.push(tvl.status === "fresh"
    ? { id: IDS[3], kind: "tvl_change", status: Math.abs(tvl.change1dPct) >= config.alerts.tvlChangePct ? "triggered" : "normal", metricPath: "economics.tvlAlertInput.change1dPct", unit: "%", window: "adjacent completed UTC days", threshold: tvlThreshold, direction: tvl.change1dPct >= 0 ? "up" : "down", observedAt: tvl.observedAt, currentValue: tvl.latest.valueUsd, referenceValue: tvl.previous.valueUsd, changePct: tvl.change1dPct }
    : unavailable(IDS[3], "tvl_change", "economics.tvlAlertInput.change1dPct", "%", "adjacent completed UTC days", tvlThreshold, "STALE_EVIDENCE"));

  const price = snapshot.economics.solPrice;
  const priceThreshold = { absolutePct: config.alerts.solPriceChangePct };
  checks.push(price.status === "fresh"
    ? { id: IDS[4], kind: "sol_price_move", status: Math.abs(price.change24hPct) >= config.alerts.solPriceChangePct ? "triggered" : "normal", metricPath: "economics.solPrice.change24hPct", unit: "%", window: "24 hours", threshold: priceThreshold, direction: price.change24hPct >= 0 ? "up" : "down", observedAt: price.observedAt, currentValue: price.currentUsd, referenceValue: price.reference24h.priceUsd, changePct: price.change24hPct }
    : unavailable(IDS[4], "sol_price_move", "economics.solPrice.change24hPct", "%", "24 hours", priceThreshold, "STALE_EVIDENCE"));

  const alerts = checks.map(checkToAlert).filter(Boolean);
  return { checks, alerts };
}
