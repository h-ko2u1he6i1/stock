import YahooFinance from "yahoo-finance2";
import { kvGet, kvSet } from "./kv.js";

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey", "ripHistorical"] });

export const CHART_RANGES = ["1M", "3M", "6M", "1Y", "5Y"] as const;
export type ChartRange = (typeof CHART_RANGES)[number];

export interface ChartPoint {
  /** "YYYY-MM-DD" */
  t: string;
  /** close price in the instrument's native currency */
  c: number;
}

export interface ChartData {
  code: string;
  range: ChartRange;
  currency: string | null;
  points: ChartPoint[];
  fetchedAt: string;
}

const RANGE_CONFIG: Record<ChartRange, { days: number; interval: "1d" | "1wk" }> = {
  "1M": { days: 32, interval: "1d" },
  "3M": { days: 95, interval: "1d" },
  "6M": { days: 190, interval: "1d" },
  "1Y": { days: 372, interval: "1d" },
  "5Y": { days: 366 * 5, interval: "1wk" },
};

const TTL_MS = 60 * 60 * 1000; // 1 hour

export async function getChart(code: string, range: ChartRange): Promise<ChartData> {
  const key = `stock:chart:${code}:${range}`;

  const cached = await kvGet<ChartData>(key);
  if (cached && Date.now() - new Date(cached.fetchedAt).getTime() < TTL_MS) {
    return cached;
  }

  const cfg = RANGE_CONFIG[range];
  const period1 = new Date(Date.now() - cfg.days * 86_400_000);
  const result = await yahooFinance.chart(code, { period1, interval: cfg.interval });

  const points: ChartPoint[] = (result.quotes ?? [])
    .filter((q) => typeof q.close === "number" && Number.isFinite(q.close))
    .map((q) => ({ t: new Date(q.date).toISOString().slice(0, 10), c: q.close as number }));

  const data: ChartData = {
    code,
    range,
    currency: (result.meta?.currency as string | undefined) ?? null,
    points,
    fetchedAt: new Date().toISOString(),
  };

  if (points.length > 0) {
    await kvSet(key, data);
  }
  return data;
}
