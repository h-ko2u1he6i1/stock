export interface DividendScheduleItem {
  exDividendDate: string;
  paymentDate: string | null;
  amountPerShare: number;
}

export type AssetType = "stock" | "fund";

export interface EnrichedStock {
  code: string;
  assetType: AssetType;
  quantity: number;
  avgCost: number | null;
  acquiredDate: string | null;
  name: string;
  market: string;
  currency: string;
  currentPrice: number | null;
  previousClose: number | null;
  changeAmount: number | null;
  changePercent: number | null;
  marketValue: number | null;
  marketValueJPY: number | null;
  pnl: number | null;
  pnlPercent: number | null;
  pnlJPY: number | null;
  dividendPerShare: number;
  dividendFrequency: number;
  dividendMonths: number[];
  dividendSchedule: DividendScheduleItem[];
  nextDividendDate: string | null;
  dividendYield: number | null;
  annualDividendEstimate: number;
  annualDividendEstimateJPY: number;
  error: string | null;
}

export interface PortfolioSummary {
  totalMarketValueJPY: number;
  totalPnLJPY: number;
  totalAnnualDividendJPY: number;
}

export interface PortfolioResponse {
  positions: EnrichedStock[];
  summary: PortfolioSummary;
  usdJpyRate: number;
  updatedAt: string;
  /** true when served from cache without a fresh Yahoo fetch. */
  stale?: boolean;
}

export type Role = "owner" | "viewer";

export interface SessionInfo {
  authRequired: boolean;
  authenticated: boolean;
  role: Role | null;
}

export const CHART_RANGES = ["1M", "3M", "6M", "1Y", "5Y"] as const;
export type ChartRange = (typeof CHART_RANGES)[number];

export interface ChartPoint {
  t: string;
  c: number;
}

export interface ChartData {
  code: string;
  range: ChartRange;
  currency: string | null;
  points: ChartPoint[];
}

export interface NewPositionInput {
  code: string;
  quantity: number;
  avgCost: number | null;
  acquiredDate: string | null;
}

export interface SearchCandidate {
  code: string;
  name: string;
  market: string;
  currency: string;
  assetType: AssetType;
}
