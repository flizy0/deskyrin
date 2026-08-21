const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 });
const decimal = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 2 });
const dateTime = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
const dateOnly = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export const fmt = {
  compact: (value) => compact.format(value),
  decimal: (value) => decimal.format(value),
  integer: (value) => integer.format(value),
  usd: (value) => usd.format(value),
  pct: (value, signed = false) => `${signed && value > 0 ? "+" : ""}${decimal.format(value)}%`,
  utc: (value) => `${dateTime.format(new Date(value))} UTC`,
  date: (value) => dateOnly.format(new Date(value.length === 10 ? `${value}T00:00:00Z` : value)),
  shortKey: (value) => `${value.slice(0, 5)}…${value.slice(-5)}`,
  stakeSol(value) {
    const lamports = BigInt(value);
    const hundredths = lamports / 10_000_000n;
    const whole = hundredths / 100n;
    const fraction = String(hundredths % 100n).padStart(2, "0");
    return `${integer.format(whole)}.${fraction}`;
  }
};

export function freshnessText(domain) {
  return domain.status === "fresh" ? "Fresh" : `Stale · retained from ${fmt.utc(domain.observedAt)}`;
}
