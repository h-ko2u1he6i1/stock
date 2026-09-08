import { createRequire } from "node:module";
import type { Position } from "./types.js";
import { keyFor, kvGet, kvSet, type Scope } from "./kv.js";

const require = createRequire(import.meta.url);

function normalize(raw: Position[]): Position[] {
  return raw.map((p) => ({ ...p, assetType: p.assetType ?? "stock" }));
}

function loadSeed(scope: Scope): Position[] {
  const file = scope === "viewer" ? "./data/positions.viewer-seed.json" : "./data/positions.seed.json";
  try {
    return normalize(require(file) as Position[]);
  } catch {
    return [];
  }
}

export async function loadPositions(scope: Scope): Promise<Position[]> {
  const stored = await kvGet<Position[]>(keyFor.positions(scope));
  if (stored != null) {
    return normalize(stored);
  }
  // First run for this scope: seed it.
  const seed = loadSeed(scope);
  await kvSet(keyFor.positions(scope), seed);
  return seed;
}

export async function savePositions(scope: Scope, positions: Position[]): Promise<void> {
  await kvSet(keyFor.positions(scope), positions);
}

export async function upsertPosition(scope: Scope, position: Position): Promise<Position[]> {
  const positions = await loadPositions(scope);
  const idx = positions.findIndex((p) => p.code === position.code);
  if (idx >= 0) {
    positions[idx] = position;
  } else {
    positions.push(position);
  }
  await savePositions(scope, positions);
  return positions;
}

export async function removePosition(scope: Scope, code: string): Promise<Position[]> {
  const positions = await loadPositions(scope);
  const filtered = positions.filter((p) => p.code !== code);
  await savePositions(scope, filtered);
  return filtered;
}
