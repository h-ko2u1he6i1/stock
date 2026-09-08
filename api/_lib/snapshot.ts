import type { PortfolioResponse } from "./types.js";
import { keyFor, kvGet, kvSet, type Scope } from "./kv.js";
import { buildPortfolio } from "./portfolio.js";
import { loadPositions } from "./positionsStore.js";

export interface Snapshot {
  data: PortfolioResponse;
  fetchedAt: string;
}

/** How old a snapshot may be before /api/portfolio triggers a refresh. */
export const DEFAULT_TTL_MS = 15 * 60 * 1000;

export async function getSnapshot(scope: Scope): Promise<Snapshot | null> {
  return kvGet<Snapshot>(keyFor.snapshot(scope));
}

export function isStale(snapshot: Snapshot | null, ttlMs = DEFAULT_TTL_MS): boolean {
  if (!snapshot) return true;
  return Date.now() - new Date(snapshot.fetchedAt).getTime() > ttlMs;
}

/** Re-fetch every position from Yahoo and persist the result for the given scope. */
export async function refreshSnapshot(scope: Scope): Promise<Snapshot> {
  const positions = await loadPositions(scope);
  const data = await buildPortfolio(positions);
  const snapshot: Snapshot = { data, fetchedAt: new Date().toISOString() };
  await kvSet(keyFor.snapshot(scope), snapshot);
  return snapshot;
}

/** Shape the snapshot into the API response, tagging whether it is cached. */
export function toResponse(snapshot: Snapshot, stale: boolean): PortfolioResponse {
  return { ...snapshot.data, updatedAt: snapshot.fetchedAt, stale };
}
