import type { PortfolioSummary } from "../types";
import { formatJPY, formatSignedJPY } from "../format";

interface Props {
  summary: PortfolioSummary;
  usdJpyRate: number;
  positionCount: number;
}

export function SummaryBar({ summary, usdJpyRate, positionCount }: Props) {
  const pnl = summary.totalPnLJPY;
  const cost = summary.totalMarketValueJPY - pnl;
  const pnlPercent = cost > 0 ? (pnl / cost) * 100 : null;
  const pnlDir = pnl > 0 ? "gain" : pnl < 0 ? "loss" : "";

  const yieldPercent =
    summary.totalMarketValueJPY > 0
      ? (summary.totalAnnualDividendJPY / summary.totalMarketValueJPY) * 100
      : null;

  return (
    <div className="summary-grid">
      <div className="card stat is-hero">
        <span className="stat-label">評価額合計</span>
        <span className="stat-value num">{formatJPY(summary.totalMarketValueJPY)}</span>
        <span className="stat-sub">{positionCount} 銘柄</span>
      </div>

      <div className="card stat">
        <span className="stat-label">評価損益</span>
        <span className={`stat-value num ${pnlDir === "gain" ? "text-gain" : pnlDir === "loss" ? "text-loss" : ""}`}>
          {formatSignedJPY(pnl)}
        </span>
        <span className="stat-sub">
          {pnlPercent != null ? (
            <span className={`pill ${pnlDir}`}>
              <span className="tri">{pnl > 0 ? "▲" : pnl < 0 ? "▼" : ""}</span>
              {pnlPercent > 0 ? "+" : ""}
              {pnlPercent.toFixed(2)}%
            </span>
          ) : (
            "—"
          )}
        </span>
      </div>

      <div className="card stat">
        <span className="stat-label">年間配当金(見込み)</span>
        <span className="stat-value num">{formatJPY(summary.totalAnnualDividendJPY)}</span>
        <span className="stat-sub">
          利回り {yieldPercent != null ? `${yieldPercent.toFixed(2)}%` : "—"}
        </span>
      </div>

      <div className="card stat">
        <span className="stat-label">USD / JPY</span>
        <span className="stat-value num">{usdJpyRate ? usdJpyRate.toFixed(2) : "—"}</span>
        <span className="stat-sub">米国株の円換算に使用</span>
      </div>
    </div>
  );
}
