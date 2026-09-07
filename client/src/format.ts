export function formatMoney(value: number | null, currency: string): string {
  if (value == null) return "—";
  const decimals = currency === "JPY" ? 0 : 2;
  return `${value.toLocaleString("ja-JP", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })} ${currency}`;
}

export function formatJPY(value: number | null): string {
  if (value == null) return "—";
  return `¥${Math.round(value).toLocaleString("ja-JP")}`;
}

export function formatSignedJPY(value: number | null): string {
  if (value == null) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}¥${Math.abs(Math.round(value)).toLocaleString("ja-JP")}`;
}

/** "positive" / "negative" / "" — for gain(red)/loss(green) color classes. */
export function directionClass(value: number | null | undefined): string {
  if (value == null || value === 0) return "";
  return value > 0 ? "text-gain" : "text-loss";
}

export function formatPercent(value: number | null): string {
  if (value == null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function formatNumber(value: number | null): string {
  if (value == null) return "—";
  return value.toLocaleString("ja-JP");
}

/** Unsigned percent, e.g. dividend yield: "2.64%". */
export function formatRate(value: number | null): string {
  if (value == null) return "—";
  return `${value.toFixed(2)}%`;
}

export function formatMonths(months: number[]): string {
  if (months.length === 0) return "—";
  return months.map((m) => `${m}月`).join("・");
}
