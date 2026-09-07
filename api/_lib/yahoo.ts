import { createRequire } from "node:module";
import YahooFinance from "yahoo-finance2";
import type { DividendScheduleItem, SearchCandidate } from "./types.js";

const require = createRequire(import.meta.url);

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey", "ripHistorical"] });

const EXCHANGE_NAME_JA: Record<string, string> = {
  JPX: "東証",
  NMS: "NASDAQ",
  NGM: "NASDAQ",
  NCM: "NASDAQ",
  NYQ: "NYSE",
  ASE: "NYSE American",
  PCX: "NYSE Arca",
  PNK: "OTC市場",
};

function localizeMarket(exchange: string | undefined, fullExchangeName: string | undefined): string {
  if (exchange && EXCHANGE_NAME_JA[exchange]) {
    return EXCHANGE_NAME_JA[exchange];
  }
  return fullExchangeName ?? exchange ?? "";
}

export interface QuoteInfo {
  code: string;
  name: string;
  market: string;
  currency: string;
  currentPrice: number | null;
  previousClose: number | null;
}

export async function fetchQuote(code: string): Promise<QuoteInfo> {
  const q = await yahooFinance.quote(code, { lang: "ja-JP", region: "JP" });
  if (!q || !q.symbol) {
    throw new Error(`銘柄コード "${code}" が見つかりませんでした`);
  }
  return {
    code: q.symbol,
    name: q.longName ?? q.shortName ?? q.symbol,
    market: localizeMarket(q.exchange, q.fullExchangeName),
    currency: q.currency ?? "USD",
    currentPrice: q.regularMarketPrice ?? null,
    previousClose: q.regularMarketPreviousClose ?? null,
  };
}

export interface DividendInfo {
  dividendPerShare: number;
  dividendFrequency: number;
  dividendMonths: number[];
  dividendSchedule: DividendScheduleItem[];
  nextDividendDate: string | null;
}

const EMPTY_DIVIDEND_INFO: DividendInfo = {
  dividendPerShare: 0,
  dividendFrequency: 0,
  dividendMonths: [],
  dividendSchedule: [],
  nextDividendDate: null,
};

export async function fetchDividendInfo(code: string): Promise<DividendInfo> {
  const now = new Date();
  const oneYearAgo = new Date(now);
  oneYearAgo.setFullYear(now.getFullYear() - 1);

  let rows: Array<{ date: Date; dividends: number }> = [];
  try {
    rows = (await yahooFinance.historical(code, {
      period1: oneYearAgo,
      period2: now,
      events: "dividends",
    })) as unknown as Array<{ date: Date; dividends: number }>;
  } catch {
    rows = [];
  }

  if (rows.length === 0) {
    return EMPTY_DIVIDEND_INFO;
  }

  const schedule: DividendScheduleItem[] = rows
    .map((r) => ({
      exDividendDate: new Date(r.date).toISOString().slice(0, 10),
      paymentDate: null,
      amountPerShare: r.dividends,
    }))
    .sort((a, b) => a.exDividendDate.localeCompare(b.exDividendDate));

  const dividendPerShare = schedule.reduce((sum, s) => sum + s.amountPerShare, 0);
  const dividendFrequency = schedule.length;
  const dividendMonths = Array.from(
    new Set(schedule.map((s) => Number(s.exDividendDate.slice(5, 7))))
  ).sort((a, b) => a - b);

  let nextDividendDate: string | null = null;
  try {
    const summary = await yahooFinance.quoteSummary(code, { modules: ["calendarEvents"] });
    const d = summary.calendarEvents?.dividendDate;
    if (d) {
      nextDividendDate = new Date(d).toISOString().slice(0, 10);
    }
  } catch {
    nextDividendDate = null;
  }

  return { dividendPerShare, dividendFrequency, dividendMonths, dividendSchedule: schedule, nextDividendDate };
}

export async function fetchUsdJpyRate(): Promise<number> {
  const q = await yahooFinance.quote("JPY=X");
  return q.regularMarketPrice ?? 0;
}

interface JpDictionaryEntry {
  code: string;
  name: string;
  aliases: string[];
}

const jpCompanies = require("./data/jp-companies.json") as JpDictionaryEntry[];
const jpFunds = require("./data/jp-funds.json") as JpDictionaryEntry[];

function matchesQuery(entry: JpDictionaryEntry, query: string): boolean {
  if (entry.name.includes(query)) return true;
  return entry.aliases.some((alias) => alias.includes(query) || query.includes(alias));
}

export function isFundCode(code: string): boolean {
  return jpFunds.some((entry) => entry.code === code);
}

export async function searchStocks(query: string): Promise<SearchCandidate[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const results: SearchCandidate[] = [];
  const seen = new Set<string>();

  for (const entry of jpCompanies) {
    if (matchesQuery(entry, trimmed) && !seen.has(entry.code)) {
      seen.add(entry.code);
      results.push({ code: entry.code, name: entry.name, market: "東証", currency: "JPY", assetType: "stock" });
    }
  }

  for (const entry of jpFunds) {
    if (matchesQuery(entry, trimmed) && !seen.has(entry.code)) {
      seen.add(entry.code);
      results.push({ code: entry.code, name: entry.name, market: "投資信託", currency: "JPY", assetType: "fund" });
    }
  }

  try {
    const searchResult = await yahooFinance.search(trimmed, { quotesCount: 8 });
    for (const raw of searchResult.quotes ?? []) {
      const item = raw as Record<string, unknown>;
      const symbol = typeof item.symbol === "string" ? item.symbol : null;
      if (!symbol || seen.has(symbol)) continue;
      if (typeof item.quoteType === "string" && item.quoteType !== "EQUITY" && item.quoteType !== "ETF") continue;
      seen.add(symbol);
      const name =
        (typeof item.longname === "string" && item.longname) ||
        (typeof item.shortname === "string" && item.shortname) ||
        symbol;
      const market = (typeof item.exchDisp === "string" && item.exchDisp) || "";
      results.push({ code: symbol, name, market, currency: "", assetType: "stock" });
    }
  } catch {
    // Yahoo's search API rejects some queries (notably Japanese text); fall back to the local dictionary only.
  }

  return results.slice(0, 10);
}
