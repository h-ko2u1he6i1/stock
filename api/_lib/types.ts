export type AssetType = "stock" | "fund";

export interface Position {
  code: string;
  quantity: number;
  avgCost: number | null;
  acquiredDate: string | null;
  assetType: AssetType;
}

export interface DividendScheduleItem {
  exDividendDate: string;
  paymentDate: string | null;
  amountPerShare: number;
}

export interface EnrichedStock extends Position {
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
  /** Annual dividend per share ÷ current price, as a percent. null when not computable. */
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
  /** true when the data was served from the cached snapshot without a fresh fetch. */
  stale?: boolean;
}

export interface SearchCandidate {
  code: string;
  name: string;
  market: string;
  currency: string;
  assetType: AssetType;
}
