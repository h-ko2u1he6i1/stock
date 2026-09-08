/**
 * Imports a JSON array of positions straight into the KV store, bypassing the
 * app UI. Useful for restoring a portfolio or bulk-seeding.
 *
 * Usage:
 *   KV_REST_API_URL='https://...' KV_REST_API_TOKEN='...' \
 *     node scripts/import-positions.mjs [file] [key]
 *
 *   file  JSON array of { code, quantity, avgCost?, acquiredDate?, assetType? }
 *         (default: my-positions.json)
 *   key   KV key to write (default: stock:positions;
 *         use stock:viewer:positions for the demo portfolio)
 *
 * Credentials: copy KV_REST_API_URL / KV_REST_API_TOKEN from the Vercel project
 * (Settings → Environment Variables, added by the Upstash integration) or from
 * the Upstash console. UPSTASH_REDIS_REST_URL / _TOKEN also work.
 */
import { Redis } from "@upstash/redis";
import { readFile } from "node:fs/promises";

const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
if (!url || !token) {
  console.error("KV_REST_API_URL / KV_REST_API_TOKEN を環境変数で指定してください。");
  process.exit(1);
}

const file = process.argv[2] ?? "my-positions.json";
const key = process.argv[3] ?? "stock:positions";

let positions;
try {
  positions = JSON.parse(await readFile(file, "utf-8"));
} catch (e) {
  console.error(`${file} を読めませんでした: ${e.message}`);
  process.exit(1);
}
if (!Array.isArray(positions) || positions.length === 0) {
  console.error(`${file} は空でない配列である必要があります。`);
  process.exit(1);
}

for (const p of positions) {
  if (typeof p?.code !== "string" || typeof p?.quantity !== "number") {
    console.error("各要素に code(string) と quantity(number) が必要です:", p);
    process.exit(1);
  }
  p.code = p.code.toUpperCase();
  p.assetType ??= "stock";
  p.avgCost ??= null;
  p.acquiredDate ??= null;
}

const redis = new Redis({ url, token });
await redis.set(key, positions);
// Drop the matching snapshot so the next /api/portfolio rebuilds from Yahoo.
const snapshotKey = key.replace(/positions$/, "snapshot");
if (snapshotKey !== key) await redis.del(snapshotKey);

console.log(`✓ ${positions.length} 件を "${key}" にインポートしました。`);
console.log(`  ${positions.map((p) => p.code).join(", ")}`);
console.log(`  次にアプリを開くと Yahoo から再取得してスナップショットが作られます。`);
