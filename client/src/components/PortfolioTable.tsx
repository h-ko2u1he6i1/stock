import { useState } from "react";
import type { EnrichedStock } from "../types";
import {
  directionClass,
  formatJPY,
  formatMoney,
  formatMonths,
  formatNumber,
  formatPercent,
  formatRate,
  formatSignedJPY,
} from "../format";
import { useMediaQuery } from "../hooks";
import { ChevronIcon, EmptyIcon, TrashIcon } from "./icons";
import { StockChart } from "./StockChart";

interface Props {
  stocks: EnrichedStock[];
  onUpdate: (code: string, quantity: number, avgCost: number | null, acquiredDate: string | null) => Promise<void>;
  onDelete: (code: string) => Promise<void>;
}

export function PortfolioTable({ stocks, onUpdate, onDelete }: Props) {
  const [expandedCode, setExpandedCode] = useState<string | null>(null);
  const isMobile = useMediaQuery("(max-width: 720px)");

  if (stocks.length === 0) {
    return (
      <div className="card empty-state">
        <EmptyIcon />
        銘柄がまだ登録されていません。上のフォームから追加してください。
      </div>
    );
  }

  const toggle = (code: string) => setExpandedCode((c) => (c === code ? null : code));

  if (isMobile) {
    return (
      <div className="card-list">
        {stocks.map((s) => (
          <StockCard
            key={s.code}
            stock={s}
            expanded={expandedCode === s.code}
            onToggle={() => toggle(s.code)}
            onUpdate={onUpdate}
            onDelete={onDelete}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="card table-wrap">
      <table className="portfolio-table">
        <thead>
          <tr>
            <th>銘柄</th>
            <th>市場 / 通貨</th>
            <th>保有数</th>
            <th>取得単価</th>
            <th>現在値</th>
            <th>前日比</th>
            <th>評価額</th>
            <th>評価損益</th>
            <th>1株配当 / 回数</th>
            <th>配当月</th>
            <th>年間配当(見込み)</th>
            <th aria-label="操作" />
          </tr>
        </thead>
        <tbody>
          {stocks.map((s) => (
            <StockRow
              key={s.code}
              stock={s}
              expanded={expandedCode === s.code}
              onToggle={() => toggle(s.code)}
              onUpdate={onUpdate}
              onDelete={onDelete}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface EditableProps {
  stock: EnrichedStock;
  expanded: boolean;
  onToggle: () => void;
  onUpdate: Props["onUpdate"];
  onDelete: Props["onDelete"];
}

/** Shared inline-edit state for a single holding (used by both table row and card). */
function usePositionEditor(stock: EnrichedStock, onUpdate: Props["onUpdate"], onDelete: Props["onDelete"]) {
  const [quantity, setQuantity] = useState(String(stock.quantity));
  const [avgCost, setAvgCost] = useState(stock.avgCost != null ? String(stock.avgCost) : "");
  const [saving, setSaving] = useState(false);

  async function commitChanges() {
    const qty = Number(quantity);
    if (!(qty > 0)) return;
    const nextCost = avgCost ? Number(avgCost) : null;
    if (qty === stock.quantity && nextCost === stock.avgCost) return;
    setSaving(true);
    try {
      await onUpdate(stock.code, qty, nextCost, stock.acquiredDate);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`${stock.name}(${stock.code})を削除しますか?`)) return;
    await onDelete(stock.code);
  }

  return { quantity, setQuantity, avgCost, setAvgCost, saving, commitChanges, handleDelete };
}

function StockRow({ stock, expanded, onToggle, onUpdate, onDelete }: EditableProps) {
  const ed = usePositionEditor(stock, onUpdate, onDelete);
  const changeDir = directionClass(stock.changeAmount);
  const pnlDir = directionClass(stock.pnl);

  return (
    <>
      <tr className={`main-row${stock.error ? " row-error" : ""}`}>
        <td>
          <div className="stock-name">{stock.name}</div>
          <div className="stock-code num">{stock.code}</div>
          {stock.error && <div className="row-error-msg">{stock.error}</div>}
        </td>
        <td>
          <div className="tags">
            {stock.market && (
              <span className={`badge ${stock.assetType === "fund" ? "badge-fund" : ""}`}>{stock.market}</span>
            )}
            {stock.currency && <span className="badge">{stock.currency}</span>}
            {!stock.market && !stock.currency && "—"}
          </div>
        </td>
        <td>
          <input
            className="cell-input num"
            type="number"
            min="0"
            step="1"
            aria-label="保有数"
            value={ed.quantity}
            disabled={ed.saving}
            onChange={(e) => ed.setQuantity(e.target.value)}
            onBlur={ed.commitChanges}
          />
        </td>
        <td>
          <input
            className="cell-input num"
            type="number"
            min="0"
            step="0.01"
            placeholder="—"
            aria-label="取得単価"
            value={ed.avgCost}
            disabled={ed.saving}
            onChange={(e) => ed.setAvgCost(e.target.value)}
            onBlur={ed.commitChanges}
          />
        </td>
        <td className="num">{formatMoney(stock.currentPrice, stock.currency)}</td>
        <td className={`num ${changeDir}`}>
          {stock.changeAmount != null ? (
            <span className="change-cell">
              <span className="tri">{stock.changeAmount > 0 ? "▲" : stock.changeAmount < 0 ? "▼" : ""}</span>
              {Math.abs(stock.changeAmount).toFixed(2)}
              <span className="cell-sub">{formatPercent(stock.changePercent)}</span>
            </span>
          ) : (
            "—"
          )}
        </td>
        <td className="num cell-strong">{formatJPY(stock.marketValueJPY)}</td>
        <td className={`num ${pnlDir}`}>
          <div className="cell-strong">{formatSignedJPY(stock.pnlJPY)}</div>
          {stock.pnlPercent != null && <div className="cell-sub">{formatPercent(stock.pnlPercent)}</div>}
        </td>
        <td className="num">
          {formatMoney(stock.dividendPerShare, stock.currency)}
          <div className="cell-sub">年 {formatNumber(stock.dividendFrequency)} 回</div>
        </td>
        <td>
          {stock.dividendMonths.length > 0 ? (
            <div className="chip-row">
              {stock.dividendMonths.map((m) => (
                <span key={m} className="chip">
                  {m}月
                </span>
              ))}
            </div>
          ) : (
            formatMonths(stock.dividendMonths)
          )}
        </td>
        <td className="num cell-strong">
          {formatJPY(stock.annualDividendEstimateJPY)}
          <div className="cell-sub">利回り {formatRate(stock.dividendYield)}</div>
        </td>
        <td>
          <div className="row-actions">
            <button
              type="button"
              className="icon-btn"
              onClick={onToggle}
              aria-expanded={expanded}
              aria-label={expanded ? "詳細を閉じる" : "詳細・チャートを開く"}
              title="詳細・チャート"
            >
              <ChevronIcon className={`chev${expanded ? " open" : ""}`} />
            </button>
            <button
              type="button"
              className="icon-btn danger"
              onClick={ed.handleDelete}
              aria-label="削除"
              title="削除"
            >
              <TrashIcon />
            </button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="detail-row">
          <td colSpan={12}>
            <StockDetail stock={stock} />
          </td>
        </tr>
      )}
    </>
  );
}

function StockCard({ stock, expanded, onToggle, onUpdate, onDelete }: EditableProps) {
  const ed = usePositionEditor(stock, onUpdate, onDelete);
  const changeDir = directionClass(stock.changeAmount);
  const pnlDir = directionClass(stock.pnl);

  return (
    <div className={`card holding-card${stock.error ? " row-error" : ""}`}>
      <div className="holding-head">
        <div>
          <div className="stock-name">{stock.name}</div>
          <div className="stock-code num">{stock.code}</div>
        </div>
        <div className="tags">
          {stock.market && (
            <span className={`badge ${stock.assetType === "fund" ? "badge-fund" : ""}`}>{stock.market}</span>
          )}
          {stock.currency && <span className="badge">{stock.currency}</span>}
        </div>
      </div>

      {stock.error && <div className="row-error-msg">{stock.error}</div>}

      <div className="holding-grid">
        <div>
          <span className="k">現在値</span>
          <span className="v num">{formatMoney(stock.currentPrice, stock.currency)}</span>
          {stock.changeAmount != null && (
            <span className={`v-sub num ${changeDir}`}>
              {stock.changeAmount > 0 ? "▲" : stock.changeAmount < 0 ? "▼" : ""}
              {Math.abs(stock.changeAmount).toFixed(2)} ({formatPercent(stock.changePercent)})
            </span>
          )}
        </div>
        <div>
          <span className="k">評価額</span>
          <span className="v num">{formatJPY(stock.marketValueJPY)}</span>
        </div>
        <div>
          <span className="k">評価損益</span>
          <span className={`v num ${pnlDir}`}>{formatSignedJPY(stock.pnlJPY)}</span>
          {stock.pnlPercent != null && (
            <span className={`v-sub num ${pnlDir}`}>{formatPercent(stock.pnlPercent)}</span>
          )}
        </div>
        <div>
          <span className="k">年間配当(見込み)</span>
          <span className="v num">{formatJPY(stock.annualDividendEstimateJPY)}</span>
          <span className="v-sub num">利回り {formatRate(stock.dividendYield)}</span>
          <span className="v-sub">
            {formatMoney(stock.dividendPerShare, stock.currency)} / 年{formatNumber(stock.dividendFrequency)}回
          </span>
        </div>
      </div>

      <div className="holding-edit">
        <label>
          保有数
          <input
            className="cell-input num"
            type="number"
            min="0"
            step="1"
            value={ed.quantity}
            disabled={ed.saving}
            onChange={(e) => ed.setQuantity(e.target.value)}
            onBlur={ed.commitChanges}
          />
        </label>
        <label>
          取得単価
          <input
            className="cell-input num"
            type="number"
            min="0"
            step="0.01"
            placeholder="—"
            value={ed.avgCost}
            disabled={ed.saving}
            onChange={(e) => ed.setAvgCost(e.target.value)}
            onBlur={ed.commitChanges}
          />
        </label>
        {stock.dividendMonths.length > 0 && (
          <div className="chip-row">
            {stock.dividendMonths.map((m) => (
              <span key={m} className="chip">
                {m}月
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="holding-actions">
        <button type="button" className="link-button" onClick={onToggle} aria-expanded={expanded}>
          {expanded ? "詳細を閉じる" : "詳細・チャート"}
        </button>
        <button type="button" className="link-button danger" onClick={ed.handleDelete}>
          削除
        </button>
      </div>

      {expanded && <StockDetail stock={stock} />}
    </div>
  );
}

function StockDetail({ stock }: { stock: EnrichedStock }) {
  return (
    <div className="detail-panel">
      {stock.assetType === "stock" && !stock.error ? (
        <StockChart code={stock.code} currency={stock.currency || "JPY"} />
      ) : stock.assetType === "fund" ? (
        <p className="empty-state small">投資信託のチャートは未対応です。</p>
      ) : null}
      <DividendDetail stock={stock} />
    </div>
  );
}

function DividendDetail({ stock }: { stock: EnrichedStock }) {
  return (
    <div className="dividend-detail">
      <div className="detail-next">
        次回配当予定日 <b>{stock.nextDividendDate ?? "—"}</b>
      </div>
      {stock.dividendSchedule.length === 0 ? (
        <p className="empty-state small">直近1年間の配当実績はありません。</p>
      ) : (
        <table className="dividend-schedule-table">
          <thead>
            <tr>
              <th>権利落ち日</th>
              <th>支払日</th>
              <th>1株配当金額</th>
            </tr>
          </thead>
          <tbody>
            {stock.dividendSchedule.map((d, i) => (
              <tr key={i}>
                <td>{d.exDividendDate}</td>
                <td>{d.paymentDate ?? "—"}</td>
                <td>{formatMoney(d.amountPerShare, stock.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
