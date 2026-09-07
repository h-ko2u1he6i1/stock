import { useEffect, useId, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { AuthError, fetchChart } from "../api";
import { CHART_RANGES, type ChartPoint, type ChartRange } from "../types";
import { formatMoney } from "../format";

interface Props {
  code: string;
  currency: string;
}

export function StockChart({ code, currency }: Props) {
  const [range, setRange] = useState<ChartRange>("6M");
  const [points, setPoints] = useState<ChartPoint[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    fetchChart(code, range, ctrl.signal)
      .then((d) => setPoints(d.points))
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        if (e instanceof AuthError) return;
        setError(e instanceof Error ? e.message : "チャートの取得に失敗しました");
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [code, range]);

  return (
    <div className="stock-chart">
      <div className="chart-ranges">
        {CHART_RANGES.map((r) => (
          <button
            key={r}
            type="button"
            className={`chart-range-btn${r === range ? " active" : ""}`}
            onClick={() => setRange(r)}
          >
            {r}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="chart-skeleton" />
      ) : error ? (
        <p className="empty-state small">{error}</p>
      ) : points && points.length > 1 ? (
        <ChartSvg points={points} currency={currency} />
      ) : (
        <p className="empty-state small">この期間のチャートデータがありません。</p>
      )}
    </div>
  );
}

function ChartSvg({ points, currency }: { points: ChartPoint[]; currency: string }) {
  const gradientId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const height = 190;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth || 640);
    return () => ro.disconnect();
  }, []);

  const padX = 6;
  const padTop = 8;
  const padBottom = 20;
  const closes = points.map((p) => p.c);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const span = max - min || 1;

  const x = (i: number) => padX + (i / (points.length - 1)) * (width - padX * 2);
  const y = (c: number) => padTop + (1 - (c - min) / span) * (height - padTop - padBottom);

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(p.c).toFixed(1)}`).join(" ");
  const area = `${line} L${x(points.length - 1).toFixed(1)} ${height - padBottom} L${x(0).toFixed(1)} ${height - padBottom} Z`;

  const first = points[0].c;
  const activeIdx = hoverIdx ?? points.length - 1;
  const active = points[activeIdx];
  const changePct = first ? ((active.c - first) / first) * 100 : 0;
  const up = active.c >= first;
  const color = up ? "var(--gain)" : "var(--loss)";

  function handleMove(e: ReactPointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const rel = (e.clientX - rect.left) / rect.width;
    const idx = Math.round(rel * (points.length - 1));
    setHoverIdx(Math.max(0, Math.min(points.length - 1, idx)));
  }

  return (
    <div className="chart-svg-wrap" ref={wrapRef}>
      <div className="chart-readout">
        <span className="num chart-price">{formatMoney(active.c, currency)}</span>
        <span className={`num ${changePct >= 0 ? "text-gain" : "text-loss"}`}>
          {changePct >= 0 ? "+" : ""}
          {changePct.toFixed(2)}%
        </span>
        <span className="chart-date">{active.t}</span>
      </div>
      <svg
        className="chart-svg"
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        preserveAspectRatio="none"
        onPointerMove={handleMove}
        onPointerLeave={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.16" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gradientId})`} />
        <path d={line} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        {hoverIdx != null && (
          <>
            <line
              x1={x(activeIdx)}
              y1={padTop}
              x2={x(activeIdx)}
              y2={height - padBottom}
              stroke="var(--border-strong)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            <circle cx={x(activeIdx)} cy={y(active.c)} r="3.5" fill={color} />
          </>
        )}
        <text x={padX} y={height - 5} className="chart-axis">
          {points[0].t}
        </text>
        <text x={width - padX} y={height - 5} textAnchor="end" className="chart-axis">
          {points[points.length - 1].t}
        </text>
      </svg>
    </div>
  );
}
