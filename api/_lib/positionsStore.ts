import { createRequire } from "node:module";
import type { Position } from "./types.js";
import { KEYS, kvGet, kvSet } from "./kv.js";

const require = createRequire(import.meta.url);

function loadSeed(): Position[] {
  try {
    const raw = require("./data/positions.seed.json") as Position[];
    return raw.map((p) => ({ ...p, assetType: p.assetType ?? "stock" }));
  } catch {
    return [];
  }
}

export async function loadPositions(): Promise<Position[]> {
  const stored = await kvGet<Position[]>(KEYS.positions);
  if (stored != null) {
    return stored.map((p) => ({ ...p, assetType: p.assetType ?? "stock" }));
  }
  // First run: seed the store from the bundled snapshot so nothing is lost.
  const seed = loadSeed();
  await kvSet(KEYS.positions, seed);
  return seed;
}

export async function savePositions(positions: Position[]): Promise<void> {
  await kvSet(KEYS.positions, positions);
}

export async function upsertPosition(position: Position): Promise<Position[]> {
  const positions = await loadPositions();
  const idx = positions.findIndex((p) => p.code === position.code);
  if (idx >= 0) {
    positions[idx] = position;
  } else {
    positions.push(position);
  }
  await savePositions(positions);
  return positions;
}

export async function removePosition(code: string): Promise<Position[]> {
  const positions = await loadPositions();
  const filtered = positions.filter((p) => p.code !== code);
  await savePositions(filtered);
  return filtered;
}
