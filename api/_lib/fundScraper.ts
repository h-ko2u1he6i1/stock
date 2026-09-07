/**
 * Fetches Japanese mutual fund (投資信託) data by parsing the __PRELOADED_STATE__
 * JSON that Yahoo!ファイナンス (finance.yahoo.co.jp) embeds in its fund detail pages.
 * There is no official public API for third-party funds, so this reads the same
 * server-rendered state React hydrates from rather than scraping rendered HTML text.
 */

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

function extractPreloadedState(html: string): Record<string, unknown> {
  const marker = "window.__PRELOADED_STATE__ = ";
  const start = html.indexOf(marker);
  if (start === -1) {
    throw new Error("ページ構造が変更されたため、投資信託データを解析できませんでした");
  }
  const bodyStart = start + marker.length;

  let depth = 0;
  let inString = false;
  let quoteChar = "";
  let escaped = false;
  let i = bodyStart;
  for (; i < html.length; i++) {
    const ch = html[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === quoteChar) {
        inString = false;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = true;
      quoteChar = ch;
      continue;
    }
    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) {
        i++;
        break;
      }
    }
  }

  const jsonText = html.slice(bodyStart, i);
  return JSON.parse(jsonText) as Record<string, unknown>;
}

function parseYenNumber(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/,/g, "").trim();
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

export interface FundQuote {
  code: string;
  name: string;
  price: number;
  previousClose: number | null;
  changeAmount: number | null;
  changePercent: number | null;
  updateDate: string | null;
  settlementFrequency: number;
  recentDividend: number;
}

export async function fetchFundQuote(code: string): Promise<FundQuote> {
  const res = await fetch(`https://finance.yahoo.co.jp/quote/${encodeURIComponent(code)}`, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) {
    throw new Error(`投資信託コード "${code}" のページを取得できませんでした`);
  }
  const html = await res.text();
  const state = extractPreloadedState(html);

  const priceBoard = (state.mainFundPriceBoard as Record<string, unknown> | undefined)?.fundPrices as
    | Record<string, unknown>
    | undefined;
  if (!priceBoard || !priceBoard.price) {
    throw new Error(`投資信託コード "${code}" が見つかりませんでした`);
  }

  const detailItems = (state.mainFundDetail as Record<string, unknown> | undefined)?.items as
    | Record<string, unknown>
    | undefined;

  const price = parseYenNumber(priceBoard.price);
  if (price == null) {
    throw new Error(`投資信託コード "${code}" の基準価額を解析できませんでした`);
  }
  const changeAmount = parseYenNumber(priceBoard.changePrice);
  const changePercent =
    typeof priceBoard.changePriceRate === "string" ? Number(priceBoard.changePriceRate) : null;

  const name =
    (typeof priceBoard.fundNickName === "string" && priceBoard.fundNickName) ||
    (typeof priceBoard.name === "string" && priceBoard.name) ||
    code;

  const settlementFrequency = Number(detailItems?.settlementFrequency ?? 0) || 0;
  const recentDividend = parseYenNumber(detailItems?.recentDividend) ?? 0;

  return {
    code,
    name,
    price,
    previousClose: changeAmount != null ? price - changeAmount : null,
    changeAmount,
    changePercent: Number.isFinite(changePercent) ? changePercent : null,
    updateDate: typeof priceBoard.updateDate === "string" ? priceBoard.updateDate : null,
    settlementFrequency,
    recentDividend,
  };
}
