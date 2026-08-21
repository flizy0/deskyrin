import { lamportsToSolNumber } from "../lib/numbers.js";

const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 2 });

function md(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function status(domain) {
  return domain.status === "fresh" ? "Fresh" : `Stale since ${domain.staleSince}`;
}

function pct(value, signed = true) {
  const sign = signed && value > 0 ? "+" : "";
  return `${sign}${number.format(value)}%`;
}

function section(lines, title) {
  lines.push("", `## ${title}`, "");
}

export function renderReport(snapshot) {
  const lines = [
    "# Deskyrin",
    "",
    `Updated: **${snapshot.updatedAt}**`,
    "",
    `Update status: **${snapshot.updateStatus}**`,
    "",
    "All values are generated deterministically from the cited public sources; this report contains no AI-generated analysis."
  ];

  section(lines, "Network Performance");
  const performance = snapshot.network.performance;
  const chain = snapshot.network.chain;
  lines.push(
    "| Metric | Value | Observation | Status |",
    "|---|---:|---|---|",
    `| TPS (all transactions) | ${number.format(performance.tps.total)} | ${performance.observedAt} | ${status(performance)} |`,
    `| Non-vote TPS | ${number.format(performance.tps.nonVote)} | ${performance.observedAt} | ${status(performance)} |`,
    `| Slot time | ${number.format(performance.slotTimeMs)} ms | ${performance.observedAt} | ${status(performance)} |`,
    `| Block height | ${integer.format(BigInt(chain.blockHeight))} | ${chain.observedAt} | ${status(chain)} |`,
    `| Epoch progress | ${number.format(chain.epoch.progressPct)}% (epoch ${chain.epoch.number}) | ${chain.observedAt} | ${status(chain)} |`
  );

  section(lines, "Validator Status");
  const validators = snapshot.validators;
  lines.push(
    `Status: **${status(validators)}**. Active and delinquent counts include only vote accounts with positive activated stake; delinquency uses the RPC 128-slot window.`,
    "",
    "| Metric | Value |",
    "|---|---:|",
    `| Active validators | ${integer.format(validators.counts.active)} |`,
    `| Delinquent validators | ${integer.format(validators.counts.delinquent)} |`,
    `| Delinquent activated stake | ${number.format(validators.stake.delinquentPct)}% |`,
    `| Top 10 stake share | ${number.format(validators.stake.top10Pct)}% |`,
    "",
    "### Top validators by activated stake",
    "",
    "| Rank | Vote account | Status | Stake (SOL) | Share | Commission |",
    "|---:|---|---|---:|---:|---:|"
  );
  for (const row of validators.top) {
    lines.push(`| ${row.rank} | \`${md(row.votePubkey)}\` | ${row.status} | ${number.format(lamportsToSolNumber(row.activatedStakeLamports))} | ${number.format(row.stakeSharePct)}% | ${row.commissionPct}% |`);
  }
  lines.push("", "### Commission tracking", "");
  if (validators.commissionChanges.length === 0) {
    lines.push("No commission changes have been observed since tracking began.");
  } else {
    lines.push(
      "| Observed | Vote account | Previous | New |",
      "|---|---|---:|---:|"
    );
    for (const event of validators.commissionChanges.slice(-20).reverse()) {
      lines.push(`| ${event.observedAt} | \`${md(event.votePubkey)}\` | ${event.previousCommissionPct}% | ${event.commissionPct}% |`);
    }
  }

  section(lines, "Economic Indicators");
  const economics = snapshot.economics;
  lines.push(
    "| Indicator | Value | Data through | Status |",
    "|---|---:|---|---|",
    `| SOL price | ${usd.format(economics.solPrice.currentUsd)} (${pct(economics.solPrice.change24hPct)} / 24h) | ${economics.solPrice.observedAt} | ${status(economics.solPrice)} |`,
    `| Stablecoin supply (USD-equivalent circulating) | ${usd.format(economics.stablecoinSupply.totalCirculatingUsd)} | ${economics.stablecoinSupply.date} | ${status(economics.stablecoinSupply)} |`,
    `| DEX volume (completed UTC day) | ${usd.format(economics.dexVolume.dailyVolumeUsd)} | ${economics.dexVolume.date} | ${status(economics.dexVolume)} |`,
    `| Real Economic Value (REV) | ${number.format(economics.rev.totalSol)} SOL | ${economics.rev.date} | ${status(economics.rev)} |`,
    `| Median transaction fee | ${number.format(economics.medianTransactionFee.medianLamports)} lamports | ${economics.medianTransactionFee.observedAt} | ${status(economics.medianTransactionFee)} |`,
    `| TVL alert input | ${usd.format(economics.tvlAlertInput.latest.valueUsd)} (${pct(economics.tvlAlertInput.change1dPct)} day/day) | ${economics.tvlAlertInput.latest.date} | ${status(economics.tvlAlertInput)} |`,
    "",
    `REV components for ${economics.rev.date}: transaction fees ${number.format(economics.rev.components.transactionFeesSol)} SOL (median of Allium and Dune) + gross Jito tips ${number.format(economics.rev.components.grossJitoTipsSol)} SOL.`
  );

  section(lines, "Ecosystem Growth");
  const ecosystem = snapshot.ecosystem;
  lines.push(
    "| Metric | Value | Observation | Status |",
    "|---|---:|---|---|",
    `| Tokenized-asset transfer volume (trailing 30d) | ${usd.format(ecosystem.tokenizedAssets.totalTransferVolumeUsd)} | ${ecosystem.tokenizedAssets.observedAt} | ${status(ecosystem.tokenizedAssets)} |`,
    `| Tokenized-equity transfer volume (trailing 30d) | ${usd.format(ecosystem.tokenizedAssets.equityTransferVolumeUsd)} | ${ecosystem.tokenizedAssets.observedAt} | ${status(ecosystem.tokenizedAssets)} |`,
    `| Daily active addresses (initiating signers/fee payers) | ${number.format(ecosystem.dailyActiveAddresses.value)} | ${ecosystem.dailyActiveAddresses.date} | ${status(ecosystem.dailyActiveAddresses)} |`,
    "",
    "### Upcoming upgrades and developments",
    ""
  );
  for (const item of ecosystem.upgrades.items) {
    const simds = item.simds.map((simd) => `[SIMD-${simd.id}](${simd.url})`).join(", ");
    lines.push(`- [${md(item.title)}](${item.url}) — ${md(item.stageLabel)}, ${md(item.releaseLabel)}. ${md(item.subtitle)}${simds ? ` (${simds})` : ""}`);
  }
  lines.push("", "### Ecosystem and Community News", "");
  for (const item of ecosystem.news.items) {
    lines.push(`- ${item.publishedAt.slice(0, 10)} — [${md(item.title)}](${item.url})`);
  }

  section(lines, "Alerts / notable changes");
  if (snapshot.alerts.length === 0) lines.push("No active warning met its full threshold and freshness requirements.", "");
  for (const alert of snapshot.alerts) lines.push(`- **${md(alert.title)}** — ${md(alert.message)} (${alert.observedAt})`);
  lines.push(
    "",
    "| Check | State | Current / reason |",
    "|---|---|---|"
  );
  for (const check of snapshot.alertChecks) {
    const detail = check.status === "unavailable"
      ? check.reasonCode
      : check.changePct !== undefined
        ? pct(check.changePct)
        : check.currentValue !== undefined && check.unit.startsWith("%")
          ? pct(check.currentValue, false)
          : check.currentValue;
    lines.push(`| ${md(check.id)} | ${check.status} | ${md(detail ?? "—")} |`);
  }

  section(lines, "Data Sources and Freshness");
  lines.push("| Source | State | Last success | Data through |", "|---|---|---|---|");
  for (const source of Object.values(snapshot.sources)) {
    lines.push(`| [${md(source.name)}](${source.url}) | ${source.status} | ${source.lastSuccessAt || "—"} | ${source.dataThrough || "—"} |`);
  }
  lines.push(
    "",
    "Detailed definitions, windows, aggregation rules, and limitations are documented in [`methodology.md`](./methodology.md).",
    ""
  );
  return lines.join("\n");
}
