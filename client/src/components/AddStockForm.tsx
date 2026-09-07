import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { searchStocks } from "../api";
import type { NewPositionInput, SearchCandidate } from "../types";

interface Props {
  onAdd: (input: NewPositionInput) => Promise<void>;
}

export function AddStockForm({ onAdd }: Props) {
  const [code, setCode] = useState("");
  const [quantity, setQuantity] = useState("");
  const [avgCost, setAvgCost] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [candidates, setCandidates] = useState<SearchCandidate[]>([]);
  const [showCandidates, setShowCandidates] = useState(false);
  const skipNextSearch = useRef(false);

  useEffect(() => {
    if (skipNextSearch.current) {
      skipNextSearch.current = false;
      return;
    }
    const query = code.trim();
    if (!query) {
      setCandidates([]);
      setShowCandidates(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const results = await searchStocks(query, controller.signal);
        setCandidates(results);
        setShowCandidates(results.length > 0);
      } catch {
        // ignore aborted/failed searches; the code field can still be submitted directly
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [code]);

  function selectCandidate(candidate: SearchCandidate) {
    skipNextSearch.current = true;
    setCode(candidate.code);
    setCandidates([]);
    setShowCandidates(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedCode = code.trim();
    const qty = Number(quantity);
    if (!trimmedCode) {
      setError("銘柄コードを入力してください");
      return;
    }
    if (!quantity || !(qty > 0)) {
      setError("保有数は正の数で入力してください");
      return;
    }

    setSubmitting(true);
    try {
      await onAdd({
        code: trimmedCode,
        quantity: qty,
        avgCost: avgCost ? Number(avgCost) : null,
        acquiredDate: null,
      });
      skipNextSearch.current = true;
      setCode("");
      setQuantity("");
      setAvgCost("");
      setCandidates([]);
      setShowCandidates(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "追加に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="card add-form" onSubmit={handleSubmit}>
      <div className="section-title">銘柄を追加</div>
      <div className="add-form-fields">
        <label className="code-field">
          銘柄コード / 会社名
          <input
            type="text"
            placeholder="7203.T / AAPL / トヨタ"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onFocus={() => setShowCandidates(candidates.length > 0)}
            onBlur={() => setTimeout(() => setShowCandidates(false), 150)}
            disabled={submitting}
            autoComplete="off"
          />
          {showCandidates && (
            <ul className="candidate-list">
              {candidates.map((c) => (
                <li key={c.code}>
                  <button type="button" onMouseDown={() => selectCandidate(c)}>
                    <span className={`badge ${c.assetType === "fund" ? "badge-fund" : ""}`}>
                      {c.assetType === "fund" ? "投信" : "株"}
                    </span>
                    <span className="candidate-text">
                      <span className="candidate-name">{c.name}</span>
                      <span className="candidate-meta">
                        {c.code}
                        {c.market && ` ・ ${c.market}`}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </label>
        <label>
          保有数
          <input
            type="number"
            min="0"
            step="1"
            placeholder="100"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            disabled={submitting}
          />
        </label>
        <label>
          取得単価(任意)
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="2500"
            value={avgCost}
            onChange={(e) => setAvgCost(e.target.value)}
            disabled={submitting}
          />
        </label>
        <button type="submit" className="btn-add" disabled={submitting}>
          {submitting ? "検索中..." : "追加"}
        </button>
      </div>
      {error && <p className="form-error">{error}</p>}
    </form>
  );
}
