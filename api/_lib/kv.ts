/**
 * Tiny key/value abstraction.
 *
 * On Vercel it uses Upstash Redis (the "KV" / "Upstash" marketplace integration
 * sets KV_REST_API_URL / KV_REST_API_TOKEN, or UPSTASH_REDIS_REST_URL / _TOKEN).
 * Locally, with no credentials, it falls back to a JSON file so `npm run dev`
 * works with zero setup.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REST_URL =
  process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL ?? "";
const REST_TOKEN =
  process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN ?? "";

export const usingRedis = Boolean(REST_URL && REST_TOKEN);

// --- Redis backend (lazy import so the dep isn't required for local dev) ---
let redisClient: { get: (k: string) => Promise<unknown>; set: (k: string, v: unknown) => Promise<unknown> } | null =
  null;

async function getRedis() {
  if (!redisClient) {
    const { Redis } = await import("@upstash/redis");
    redisClient = new Redis({ url: REST_URL, token: REST_TOKEN });
  }
  return redisClient;
}

// --- File backend (local dev only) ---
const LOCAL_FILE = fileURLToPath(new URL("./data/.local-store.json", import.meta.url));

function assertLocalAllowed(): void {
  if (process.env.VERCEL) {
    throw new Error(
      "KV (Upstash Redis) が接続されていません。Vercel の Storage → Upstash for Redis を Connect し、" +
        "KV_REST_API_URL / KV_REST_API_TOKEN を設定してください（README 参照）。"
    );
  }
}

async function readLocal(): Promise<Record<string, unknown>> {
  try {
    return JSON.parse(await readFile(LOCAL_FILE, "utf-8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function writeLocal(store: Record<string, unknown>): Promise<void> {
  await mkdir(dirname(LOCAL_FILE), { recursive: true });
  await writeFile(LOCAL_FILE, JSON.stringify(store, null, 2), "utf-8");
}

// --- Public API ---
export async function kvGet<T>(key: string): Promise<T | null> {
  if (usingRedis) {
    const client = await getRedis();
    const value = await client.get(key);
    // @upstash/redis deserializes JSON automatically.
    return (value as T) ?? null;
  }
  assertLocalAllowed();
  const store = await readLocal();
  return (store[key] as T) ?? null;
}

export async function kvSet<T>(key: string, value: T): Promise<void> {
  if (usingRedis) {
    const client = await getRedis();
    await client.set(key, value as unknown);
    return;
  }
  assertLocalAllowed();
  const store = await readLocal();
  store[key] = value;
  await writeLocal(store);
}

export const KEYS = {
  positions: "stock:positions",
  snapshot: "stock:snapshot",
} as const;
