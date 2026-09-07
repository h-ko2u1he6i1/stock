import type {
  ChartData,
  ChartRange,
  NewPositionInput,
  PortfolioResponse,
  SearchCandidate,
  SessionInfo,
} from "./types";

export class AuthError extends Error {
  constructor() {
    super("認証が必要です");
    this.name = "AuthError";
  }
}

async function handleResponse(res: Response): Promise<PortfolioResponse> {
  if (res.status === 401) throw new AuthError();
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? "リクエストに失敗しました");
  }
  return data as PortfolioResponse;
}

export async function getSession(): Promise<SessionInfo> {
  const res = await fetch("/api/session");
  if (!res.ok) return { authRequired: true, authenticated: false };
  return (await res.json()) as SessionInfo;
}

export async function login(password: string): Promise<void> {
  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "ログインに失敗しました");
  }
}

export async function logout(): Promise<void> {
  await fetch("/api/logout", { method: "POST" });
}

export async function fetchPortfolio(refresh = false): Promise<PortfolioResponse> {
  const res = await fetch(`/api/portfolio${refresh ? "?refresh=1" : ""}`);
  return handleResponse(res);
}

export async function addPosition(input: NewPositionInput): Promise<PortfolioResponse> {
  const res = await fetch("/api/positions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return handleResponse(res);
}

export async function updatePosition(
  code: string,
  input: Omit<NewPositionInput, "code">
): Promise<PortfolioResponse> {
  const res = await fetch(`/api/positions/${encodeURIComponent(code)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return handleResponse(res);
}

export async function deletePosition(code: string): Promise<PortfolioResponse> {
  const res = await fetch(`/api/positions/${encodeURIComponent(code)}`, { method: "DELETE" });
  return handleResponse(res);
}

export async function fetchChart(
  code: string,
  range: ChartRange,
  signal?: AbortSignal
): Promise<ChartData> {
  const res = await fetch(`/api/chart?code=${encodeURIComponent(code)}&range=${range}`, { signal });
  if (res.status === 401) throw new AuthError();
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "チャートの取得に失敗しました");
  return data as ChartData;
}

export async function searchStocks(query: string, signal?: AbortSignal): Promise<SearchCandidate[]> {
  if (!query.trim()) return [];
  const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.candidates ?? []) as SearchCandidate[];
}
