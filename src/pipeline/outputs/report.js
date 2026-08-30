import { lamportsToSolNumber } from "../lib/numbers.js";

const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 2 });

const TOKENIZED_CATEGORY_LABELS = {
  equities: "Equities",
  funds: "ETFs",
  commodities: "Commodities",
  "other-rwa": "Other RWA"
};

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

function renderCoverage(lines, incidents) {
  if (!Array.isArray(incidents) || incidents.length === 0) return;
  section(lines, "Data Coverage");
  lines.push("Coverage incidents describe missing observations; they are not network incidents and are never filled with synthetic values.", "");
  for (const incident of incidents) {
    const end = incident.endedAt || "ongoing";
    lines.push(
      `### ${md(incident.id)}`,
      "",
      `State: **${incident.status}** · ${incident.startedAt} → ${end}`,
      "",
      `Affected observations: ${incident.affectedMetrics.map(md).join(", ")}.`,
      "",
      `Reason: ${md(incident.reason)}`,
      "",
      `Disclosure: **${md(incident.disclosure)}**`,
      ""
    );
  }
}

function renderPriceEvidence(lines, economics) {
  const rows = [];
  if (economics.coinGeckoPrice) {
    rows.push([
      "CoinGecko keyless comparison",
      usd.format(economics.coinGeckoPrice.currentUsd),
      economics.coinGeckoPrice.observedAt,
      status(economics.coinGeckoPrice)
    ]);
  }
  if (economics.coinbaseMarket) {
    const latest = economics.coinbaseMarket.history.at(-1);
    rows.push([
      `Coinbase Exchange ${economics.coinbaseMarket.productId} daily close`,
      usd.format(latest.closeUsd),
      economics.coinbaseMarket.dataThrough,
      status(economics.coinbaseMarket)
    ]);
  }
  if (rows.length === 0) return;
  lines.push(
    "",
    "### Independent market-price evidence",
    "",
    "These comparison observations are retained separately and are not averaged into the headline SOL price or its 24-hour alert.",
    "",
    "| Series | Value | Data through | Status |",
    "|---|---:|---|---|"
  );
  for (const row of rows) lines.push(`| ${md(row[0])} | ${row[1]} | ${row[2]} | ${row[3]} |`);
}

function renderProviderComparisons(lines, comparisons) {
  if (!comparisons) return;
  section(lines, "Provider Comparison Evidence");
  lines.push(
    `Status: **${status(comparisons)}**. These contributor-labelled series are delivered through the Solana Foundation Data endpoint; they are not separate Deskyrin HTTP collectors or source-health records.`,
    "",
    "Provider definitions can differ materially. The values are shown side by side, never averaged into the canonical headline metrics unless an existing methodology explicitly says otherwise.",
    "",
    "| Metric | Provider | Data through | Retained points |",
    "|---|---|---|---:|"
  );
  for (const metric of comparisons.metrics) {
    for (const series of metric.series) {
      lines.push(`| ${md(metric.name)} (${md(metric.unit)}) | ${md(series.providerName)} | ${series.dataThrough} | ${integer.format(series.history.length)} |`);
    }
  }
}

function renderStatusEvidence(lines, statusData) {
  if (!statusData) return;
  section(lines, "Network Observability");
  const nonOperational = statusData.components.filter((component) => component.status !== "operational");
  lines.push(
    `Official Solana Status: **${md(statusData.condition.description)}** (${md(statusData.condition.indicator)}). Observed ${statusData.observedAt}; provider page updated ${statusData.page.updatedAt}.`,
    "",
    `${integer.format(statusData.components.length - nonOperational.length)} of ${integer.format(statusData.components.length)} retained components report operational.`,
    "",
    "Solana Status incidents and Deskyrin collection gaps are independent records: the absence of an official network incident does not imply that every Deskyrin observation was collected.",
    ""
  );
  if (nonOperational.length) {
    lines.push("### Non-operational components", "", "| Component | State | Updated |", "|---|---|---|");
    for (const component of nonOperational) lines.push(`| ${md(component.name)} | ${md(component.status)} | ${component.updatedAt} |`);
    lines.push("");
  }
  lines.push("### Recent official incidents", "");
  if (statusData.incidents.length === 0) {
    lines.push("The bounded Statuspage response contains no incidents.", "");
  } else {
    lines.push("| Incident | Impact | State | Started | Resolved |", "|---|---|---|---|---|");
    for (const incident of statusData.incidents.slice(0, 10)) {
      const label = incident.url ? `[${md(incident.name)}](${incident.url})` : md(incident.name);
      lines.push(`| ${label} | ${md(incident.impact)} | ${md(incident.status)} | ${incident.startedAt} | ${incident.resolvedAt || "—"} |`);
    }
  }
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

  renderCoverage(lines, snapshot.coverageIncidents);

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
    lines.push("No commission changes have been detected between retained snapshots since tracking began.");
  } else {
    lines.push(
      "A row means the commission differed between two successful validator snapshots. The interval is evidence of when the change could have occurred, not an exact change timestamp.",
      "",
      "| Possible change window | Vote account | Previous | New |",
      "|---|---|---:|---:|"
    );
    for (const event of validators.commissionChanges.slice(-20).reverse()) {
      const start = event.previousObservedAt || "lower bound unavailable";
      lines.push(`| ${start} → ${event.detectedAt} | \`${md(event.votePubkey)}\` | ${event.previousCommissionPct}% | ${event.commissionPct}% |`);
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
  renderPriceEvidence(lines, economics);

  renderProviderComparisons(lines, snapshot.providerComparisons);

  section(lines, "Ecosystem Growth");
  const ecosystem = snapshot.ecosystem;
  const tokenized = ecosystem.tokenizedAssets;
  lines.push(
    "| Metric | Value | Observation | Status |",
    "|---|---:|---|---|",
    `| Tokenized-market spot volume (trailing 30d) | ${usd.format(tokenized.totalSpotVolume30dUsd)} | ${tokenized.observedAt} | ${status(tokenized)} |`,
    `| Tokenized-equity spot volume (trailing 30d) | ${usd.format(tokenized.equitySpotVolume30dUsd)} | ${tokenized.observedAt} | ${status(tokenized)} |`,
    `| Daily active addresses (initiating signers/fee payers) | ${number.format(ecosystem.dailyActiveAddresses.value)} | ${ecosystem.dailyActiveAddresses.date} | ${status(ecosystem.dailyActiveAddresses)} |`,
    "",
    `Tokens.xyz coverage: ${integer.format(tokenized.coveredAssetCount)} of ${integer.format(tokenized.indexedAssetCount)} indexed tokenized-market assets and ${integer.format(tokenized.coveredEquityCount)} of ${integer.format(tokenized.indexedEquityCount)} equities have accepted 30-day volume provenance. Excluded assets: ${integer.format(tokenized.provenanceCoverage.rwaXyzExcludedCount)} RWA.xyz-derived, ${integer.format(tokenized.provenanceCoverage.unknownSourceExcludedCount)} unrecognized provenance, and ${integer.format(tokenized.provenanceCoverage.missingVolumeExcludedCount)} without a 30-day value.`,
    ""
  );
  if (Array.isArray(tokenized.categoryBreakdown)) {
    lines.push(
      "### Tokenized market category breakdown",
      "",
      "This is a current cross-sectional breakdown of the same provenance-filtered trailing-30-day spot-volume total.",
      "",
      "| Category | Indexed assets | Covered assets | Trailing 30d spot volume |",
      "|---|---:|---:|---:|"
    );
    for (const category of tokenized.categoryBreakdown) {
      lines.push(`| ${TOKENIZED_CATEGORY_LABELS[category.id] || md(category.id)} | ${integer.format(category.indexedAssetCount)} | ${integer.format(category.coveredAssetCount)} | ${usd.format(category.spotVolume30dUsd)} |`);
    }
    lines.push("");
  }
  if (Array.isArray(tokenized.topAssets)) {
    lines.push(
      "### Leading covered tokenized assets",
      "",
      "Ranked by accepted trailing-30-day spot volume; excluded provenance never enters this table.",
      "",
      "| Rank | Asset | Category | Volume source | Trailing 30d spot volume |",
      "|---:|---|---|---|---:|"
    );
    for (const asset of tokenized.topAssets) {
      const identity = asset.symbol ? `${md(asset.symbol)} — ${md(asset.name)}` : md(asset.name);
      lines.push(`| ${asset.rank} | ${identity} | ${TOKENIZED_CATEGORY_LABELS[asset.categoryGroup] || md(asset.categoryGroup)} | ${md(asset.metricsSource)} | ${usd.format(asset.spotVolume30dUsd)} |`);
    }
    lines.push("");
  }
  if (tokenized.legacyTransferVolume) {
    const legacy = tokenized.legacyTransferVolume;
    const latest = legacy.history.at(-1);
    lines.push(
      "### Retired RWA.xyz transfer-volume evidence",
      "",
      `The legacy trailing-${legacy.windowDays}-day transfer-volume series ended at ${legacy.endedAt}. It remains available as historical evidence and is not joined to Tokens.xyz spot-volume history.`,
      "",
      `Final retained values: ${usd.format(latest.totalTransferVolumeUsd)} across tokenized assets and ${usd.format(latest.equityTransferVolumeUsd)} across tokenized equities.`,
      ""
    );
  }
  lines.push(
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

  const releases = snapshot.observability?.agaveReleases;
  if (releases) {
    lines.push("", "### Recent Agave releases", "", `Status: **${status(releases)}**. Published releases and prereleases are kept separate from upcoming Solana upgrade cards.`, "");
    for (const item of releases.items.slice(0, 10)) {
      lines.push(`- ${item.publishedAt.slice(0, 10)} — [${md(item.title)}](${item.url}) — \`${md(item.tagName)}\`${item.prerelease ? " (prerelease)" : ""}`);
    }
  }

  renderStatusEvidence(lines, snapshot.observability?.solanaStatus);

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
