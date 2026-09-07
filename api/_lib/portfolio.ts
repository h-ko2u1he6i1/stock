import pLimit from "p-limit";
import type { EnrichedStock, PortfolioResponse, Position } from "./types.js";
import { fetchQuote, fetchDividendInfo, fetchUsdJpyRate } from "./yahoo.js";
import { fetchFundQuote } from "./fundScraper.js";

/** Cap concurrent Yahoo requests so a large portfolio doesn't trip rate limits. */
const limit = pLimit(4);

function buildErrorStock(pos: Position, message: string): EnrichedStock {
  return {
    ...pos,
    name: pos.code,
    market: "",
    currency: "",
    currentPrice: null,
    previousClose: null,
    changeAmount: null,
    changePercent: null,
    marketValue: null,
    marketValueJPY: null,
    pnl: null,
    pnlPercent: null,
    pnlJPY: null,
    dividendPerShare: 0,
    dividendFrequency: 0,
    dividendMonths: [],
    dividendSchedule: [],
    nextDividendDate: null,
    dividendYield: null,
    annualDividendEstimate: 0,
    annualDividendEstimateJPY: 0,
    error: message,
  };
}

async function enrichStock(pos: Position, usdJpyRate: number): Promise<EnrichedStock> {
  const [quote, dividend] = await Promise.all([fetchQuote(pos.code), fetchDividendInfo(pos.code)]);

  const fxRate = quote.currency === "JPY" ? 1 : usdJpyRate;

  const currentPrice = quote.currentPrice;
  const previousClose = quote.previousClose;
  const changeAmount = currentPrice != null && previousClose != null ? currentPrice - previousClose : null;
  const changePercent = changeAmount != null && previousClose ? (changeAmount / previousClose) * 100 : null;

  const marketValue = currentPrice != null ? currentPrice * pos.quantity : null;
  const marketValueJPY = marketValue != null && fxRate ? marketValue * fxRate : null;

  const pnl =
    currentPrice != null && pos.avgCost != null ? (currentPrice - pos.avgCost) * pos.quantity : null;
  const pnlPercent =
    pnl != null && currentPrice != null && pos.avgCost ? ((currentPrice - pos.avgCost) / pos.avgCost) * 100 : null;
  const pnlJPY = pnl != null && fxRate ? pnl * fxRate : null;

  const annualDividendEstimate = dividend.dividendPerShare * pos.quantity;
  const annualDividendEstimateJPY = fxRate ? annualDividendEstimate * fxRate : annualDividendEstimate;
  const dividendYield =
    currentPrice && dividend.dividendPerShare > 0
      ? (dividend.dividendPerShare / currentPrice) * 100
      : null;

  return {
    ...pos,
    name: quote.name,
    market: quote.market,
    currency: quote.currency,
    currentPrice,
    previousClose,
    changeAmount,
    changePercent,
    marketValue,
    marketValueJPY,
    pnl,
    pnlPercent,
    pnlJPY,
    dividendPerShare: dividend.dividendPerShare,
    dividendFrequency: dividend.dividendFrequency,
    dividendMonths: dividend.dividendMonths,
    dividendSchedule: dividend.dividendSchedule,
    nextDividendDate: dividend.nextDividendDate,
    dividendYield,
    annualDividendEstimate,
    annualDividendEstimateJPY,
    error: null,
  };
}

/** Fund NAV and distributions are quoted per 10,000 units (口), so quantity is scaled accordingly. */
const FUND_UNIT = 10000;

async function enrichFund(pos: Position): Promise<EnrichedStock> {
  const fund = await fetchFundQuote(pos.code);
  const units = pos.quantity / FUND_UNIT;

  const marketValue = fund.price * units;
  const pnl = pos.avgCost != null ? (fund.price - pos.avgCost) * units : null;
  const pnlPercent = pnl != null && pos.avgCost ? ((fund.price - pos.avgCost) / pos.avgCost) * 100 : null;

  const annualDividendEstimate = fund.recentDividend * fund.settlementFrequency * units;
  const dividendYield =
    fund.price && fund.recentDividend > 0 && fund.settlementFrequency > 0
      ? ((fund.recentDividend * fund.settlementFrequency) / fund.price) * 100
      : null;

  return {
    ...pos,
    name: fund.name,
    market: "投資信託",
    currency: "JPY",
    currentPrice: fund.price,
    previousClose: fund.previousClose,
    changeAmount: fund.changeAmount,
    changePercent: fund.changePercent,
    marketValue,
    marketValueJPY: marketValue,
    pnl,
    pnlPercent,
    pnlJPY: pnl,
    dividendPerShare: fund.recentDividend,
    dividendFrequency: fund.settlementFrequency,
    dividendMonths: [],
    dividendSchedule: [],
    nextDividendDate: null,
    dividendYield,
    annualDividendEstimate,
    annualDividendEstimateJPY: annualDividendEstimate,
    error: null,
  };
}

export async function buildPortfolio(positions: Position[]): Promise<PortfolioResponse> {
  const usdJpyRate = await fetchUsdJpyRate().catch(() => 0);

  const enriched = await Promise.all(
    positions.map((pos) =>
      limit(async (): Promise<EnrichedStock> => {
        try {
          return pos.assetType === "fund" ? await enrichFund(pos) : await enrichStock(pos, usdJpyRate);
        } catch (e) {
          return buildErrorStock(pos, e instanceof Error ? e.message : "データ取得に失敗しました");
        }
      })
    )
  );

  const summary = enriched.reduce(
    (acc, s) => {
      acc.totalMarketValueJPY += s.marketValueJPY ?? 0;
      acc.totalPnLJPY += s.pnlJPY ?? 0;
      acc.totalAnnualDividendJPY += s.annualDividendEstimateJPY ?? 0;
      return acc;
    },
    { totalMarketValueJPY: 0, totalPnLJPY: 0, totalAnnualDividendJPY: 0 }
  );

  return {
    positions: enriched,
    summary,
    usdJpyRate,
    updatedAt: new Date().toISOString(),
  };
}
