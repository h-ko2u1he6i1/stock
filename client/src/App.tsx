import { useCallback, useEffect, useState } from "react";
import {
  AuthError,
  addPosition,
  deletePosition,
  fetchPortfolio,
  getSession,
  logout,
  updatePosition,
} from "./api";
import { AddStockForm } from "./components/AddStockForm";
import { PortfolioTable } from "./components/PortfolioTable";
import { SummaryBar } from "./components/SummaryBar";
import { LoginScreen } from "./components/LoginScreen";
import { AlertIcon, LogoIcon, RefreshIcon } from "./components/icons";
import type { NewPositionInput, PortfolioResponse, Role } from "./types";

type Gate = "checking" | "login" | "open";

export default function App() {
  const [gate, setGate] = useState<Gate>("checking");
  const [showLogout, setShowLogout] = useState(false);
  const [role, setRole] = useState<Role>("owner");
  const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    setError(null);
    try {
      const data = await fetchPortfolio(refresh);
      setPortfolio(data);
    } catch (err) {
      if (err instanceof AuthError) {
        setGate("login");
        return;
      }
      setError(err instanceof Error ? err.message : "取得に失敗しました");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const session = await getSession();
      setShowLogout(session.authRequired);
      if (session.role) setRole(session.role);
      if (session.authRequired && !session.authenticated) {
        setGate("login");
        setLoading(false);
        return;
      }
      setGate("open");
      load();
    })();
  }, [load]);

  function withAuthGuard<A extends unknown[]>(fn: (...args: A) => Promise<PortfolioResponse>) {
    return async (...args: A) => {
      try {
        setPortfolio(await fn(...args));
      } catch (err) {
        if (err instanceof AuthError) {
          setGate("login");
          return;
        }
        setError(err instanceof Error ? err.message : "操作に失敗しました");
      }
    };
  }

  const handleAdd = async (input: NewPositionInput) => {
    // AddStockForm surfaces its own errors, so let them propagate.
    setPortfolio(await addPosition(input));
  };
  const handleUpdate = withAuthGuard(
    (code: string, quantity: number, avgCost: number | null, acquiredDate: string | null) =>
      updatePosition(code, { quantity, avgCost, acquiredDate })
  );
  const handleDelete = withAuthGuard((code: string) => deletePosition(code));

  async function handleRefresh() {
    setRefreshing(true);
    await load(true);
  }

  async function handleLogout() {
    await logout();
    setGate("login");
    setPortfolio(null);
  }

  if (gate === "checking") {
    return <div className="app boot" />;
  }

  if (gate === "login") {
    return (
      <LoginScreen
        onSuccess={(r) => {
          setRole(r);
          setGate("open");
          setLoading(true);
          load();
        }}
      />
    );
  }

  const isDemo = role === "viewer";

  const updatedLabel = portfolio
    ? new Date(portfolio.updatedAt).toLocaleString("ja-JP", {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark">
            <LogoIcon />
          </span>
          <h1>株式ポートフォリオ管理</h1>
          {isDemo && <span className="role-pill">デモ</span>}
        </div>
        <div className="header-right">
          {updatedLabel && (
            <span className="header-updated">
              {portfolio?.stale ? "更新待ち " : "最終更新 "}
              {updatedLabel}
            </span>
          )}
          <button
            type="button"
            className="btn-secondary"
            onClick={handleRefresh}
            disabled={refreshing || loading}
          >
            <RefreshIcon className={refreshing ? "spin" : undefined} />
            <span className="btn-label">{refreshing ? "更新中" : "更新"}</span>
          </button>
          {showLogout && (
            <button type="button" className="btn-secondary btn-icon-only" onClick={handleLogout} title="ログアウト">
              ⏻
            </button>
          )}
        </div>
      </header>

      <AddStockForm onAdd={handleAdd} />

      {isDemo && (
        <p className="demo-note">
          これは共有のデモ用ポートフォリオです。自由に追加・編集できます（他の閲覧者にも反映されます）。
        </p>
      )}

      {error && (
        <div className="banner-error" role="alert">
          <AlertIcon />
          {error}
        </div>
      )}

      {loading ? (
        <div className="card" style={{ padding: 16 }}>
          <div className="skeleton-wrap">
            <div className="skeleton tall" />
            <div className="skeleton" />
            <div className="skeleton" />
            <div className="skeleton" />
          </div>
        </div>
      ) : portfolio ? (
        <>
          <SummaryBar
            summary={portfolio.summary}
            usdJpyRate={portfolio.usdJpyRate}
            positionCount={portfolio.positions.length}
          />
          <PortfolioTable
            stocks={portfolio.positions}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
          />
        </>
      ) : null}
    </div>
  );
}
