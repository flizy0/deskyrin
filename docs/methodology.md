# Methodology

Version: `1.0.0`  
Canonical schema: `1.0.0`

This document defines every published value. Changing a definition, population, comparison window, or threshold requires a `methodologyVersion` change. `updatedAt` is captured immediately before candidate validation/publication; every domain also keeps its own `observedAt`, and every source records attempts, successes, data coverage, and next due time.

## Network Performance

- **TPS:** `getRecentPerformanceSamples(80)` from finalized Solana RPC. The headline is `sum(numTransactions) / sum(samplePeriodSecs)` over the newest five complete one-minute samples. It includes vote transactions. Non-vote TPS is retained as provenance and displayed separately, using `numNonVoteTransactions` over the same duration.
- **Slot time:** `1,000 × sum(samplePeriodSecs) / sum(numSlots)` over the same five samples. This is observed average produced-slot interval, not a hard protocol target.
- **Block height:** the exact `blockHeight` from finalized `getEpochInfo`, serialized as a decimal string.
- **Epoch progress:** `100 × slotIndex / slotsInEpoch` from the same response.
- Project-originated network history is one point per successful hourly run, deduplicated by timestamp and capped at 720 points.

## Validators

`getVoteAccounts` is requested with finalized commitment, `keepUnstakedDelinquents: false`, and a 128-slot delinquency distance. Only rows with `activatedStake > 0` are published.

- Active and delinquent counts are the sizes of the RPC `current` and `delinquent` positive-stake populations.
- Stake values use exact `BigInt` arithmetic and are serialized as decimal lamport strings.
- Stake share is activated stake divided by total activated stake.
- The table is sorted by activated stake descending, then vote pubkey; the first ten rows are the top validators.
- Commission is the vote-account commission percentage returned by RPC. Each successful validator refresh compares current rows with the prior successful table and retains up to 1,000 actual changes (`observedAt`, vote account, previous percentage, new percentage). New or returning vote accounts establish a baseline and do not create a false change event.
- Stake distribution is the top ten plus one aggregate “Other validators” slice.

## SOL price and TVL

- **SOL price:** DefiLlama's free Coins API for `coingecko:solana`. The 24-hour reference is requested at current provider timestamp minus 86,400 seconds; change is `100 × (current/reference − 1)`. The bounded chart comes from the same source family. CoinGecko's keyless public endpoint is a whole-domain fallback and is identified explicitly if used.
- **TVL:** the newest two valid adjacent completed UTC-day observations from DefiLlama's Solana historical chain TVL series. Change is `100 × (latest/previous − 1)`. This provider definition excludes liquid staking and double-counted TVL. TVL exists as a required alert input and evidence series.

## Stablecoin supply

For each completed UTC day from DefiLlama's Solana stablecoin chart:

```text
USD-equivalent circulating supply = sum(totalCirculatingUSD values across peg types)
```

`totalUnreleased` is not included. The result covers provider-registered native and bridged assets and can move because of issuance, redemption, depegs, pricing, or registry changes.

## DEX volume

The value is DefiLlama's aggregated direct-DEX USD volume for the newest chart bucket strictly before the current UTC day. Aggregator and derivatives dimensions are not mixed into it. The current partial-day bucket is excluded.

## Real Economic Value (REV)

REV is not ordinary protocol revenue. For the newest completed date shared by both required component datasets:

```text
transaction fees = median(Allium Fees, Dune Fees), SOL
gross Jito tips  = jito_tips + validator_tips, SOL
REV              = transaction fees + gross Jito tips, SOL
```

Fee rows come from the Solana Foundation public data aggregator and must have metric `Fees`, unit `SOL`, and both Allium and Dune values. Tips come from Jito's daily MEV rewards dataset. Components are never joined across different dates, and fees alone are never labelled REV.

## Median transaction fee

The pipeline requests the finalized slot, all produced slots in the preceding 9,000-slot window, and selects 16 midpoint strata. All selected blocks must return successfully. Every finalized transaction's `meta.fee` is included, whether vote/non-vote and successful/failed.

For sorted fees `x`:

```text
odd n:  x[(n - 1) / 2]
even n: (x[n / 2 - 1] + x[n / 2]) / 2
```

The canonical unit is lamports. This sampling estimate avoids an impractical exhaustive public-RPC scan while covering the window temporally.

## Ecosystem Growth

The listing-defined growth metrics are limited to the following.

### Tokenized assets, especially equities

RWA.xyz's public Solana page embeds the current network dataset. The pipeline sums the source-defined asset-class `trailing_30_day_transfer_volume.val` values except `stablecoins`, and separately reads the `Stocks` class from the same payload.

- Both values are USD trailing-30-day on-chain transfer volume.
- Transfers exclude mint and burn events under the provider methodology.
- “Tokenized equities” is the provider's Stocks subset, not DEX trading volume.
- One point per provider update timestamp is stored locally, capped at 365.

### Daily active addresses

This is a proxy for unique transaction-initiating signers/fee payers, not people. For every completed date, the pipeline requires `Fee Payers`, unit `Count`, from both Allium and Dune in the Solana Foundation data aggregator and publishes their median. Individual current provider values remain in JSON.

### News and upgrades

- News is the newest eight valid items from the official Solana RSS feed. Titles, dates, links, and optional descriptions are publisher-authored; HTML is converted to bounded plain text.
- Upcoming developments are current non-live cards from the official Solana upgrades hub. Recognized stages are `In Development`, `Pending Feature Activation`, and `Action Required`; unknown stages fail the collector. Official detail pages provide SIMD links. The current contract asserts Alpenglow/SIMD-0326 and Reduced Slot Times/SIMD-0525 while they remain officially upcoming.

## Alerts

Alerts are deterministic in-dashboard/report records, never outbound notifications.

| Check | Trigger | Freshness guard |
|---|---|---|
| TPS drop/spike | Two adjacent ~5-minute bins are both at least 30% and 500 TPS on the same side of the median of prior ~60-minute bins | Fresh current RPC samples |
| Slow slot time | Two adjacent ~5-minute bins are both at least 50% and 75 ms above the prior ~60-minute median | Fresh current RPC samples |
| High validator delinquency | Delinquent activated stake is at least 5% in two fresh observations no more than 2.5 hours apart | Fresh validator domain; otherwise pending/unavailable |
| Large TVL change | Absolute adjacent completed-day change is at least 10% | Fresh TVL domain and adjacent dates |
| Large SOL price move | Absolute 24-hour movement is at least 10% | Fresh complete price domain |

A stale input makes its check `unavailable`; it does not keep or create an active warning from expired evidence.

## Freshness, failures, and history

- Live RPC domains have a three-hour freshness budget; SOL price has two hours; daily data has three days; content has 18 hours.
- A due collector failure never writes `0`, `null`, an empty list, or a partial substitute. A prior valid atomic domain is retained with its original observation time and marked `stale`.
- A required bootstrap domain with no last-known-good value is critical and stops publication.
- Intentionally not-due data stays fresh only inside its budget; a stale value cannot heal without a successful fetch.
- Due checks include a five-minute scheduler-jitter allowance, preventing a fixed hourly cron from slipping to every other hour because the previous run completed a few seconds after `:17`.
- Provider histories are trimmed to 90 daily points. Project hourly histories are capped at 720; RWA history is capped at 365; validator commission tracking is capped at 1,000 sparse events.
- The final snapshot and exact deterministic Markdown rendering are validated before each temporary file is atomically renamed into place. The updater's Git commit is the pair-level publication boundary; `data.json` must remain below 2 MB.

## Sources

- [Solana JSON-RPC methods](https://solana.com/docs/rpc)
- [DefiLlama free API](https://api-docs.defillama.com/)
- [CoinGecko Keyless Public API](https://docs.coingecko.com/docs/keyless-public-api)
- [Solana Foundation data aggregator](https://github.com/solana-foundation/solana-data-aggregator)
- [Jito daily MEV rewards](https://kobe.mainnet.jito.network/api/v1/daily_mev_rewards)
- [RWA.xyz methodology](https://docs.rwa.xyz/methodology/data-coverage)
- [Solana News](https://solana.com/news)
- [Solana Upgrades](https://solana.com/upgrades)

The complete source-option research and rejected alternatives are retained in the repository's `docs/research` directory.
