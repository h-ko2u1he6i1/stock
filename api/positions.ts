import { route } from "./_lib/http.js";
import type { Position } from "./_lib/types.js";
import { fetchQuote, isFundCode } from "./_lib/yahoo.js";
import { fetchFundQuote } from "./_lib/fundScraper.js";
import { upsertPosition } from "./_lib/positionsStore.js";
import { refreshSnapshot, toResponse } from "./_lib/snapshot.js";

export default route(["POST"], async (req, res) => {
  const { code, quantity, avgCost, acquiredDate } = (req.body ?? {}) as {
    code?: string;
    quantity?: number;
    avgCost?: number | null;
    acquiredDate?: string | null;
  };

  if (!code || typeof code !== "string" || !code.trim()) {
    res.status(400).json({ error: "銘柄コードを入力してください" });
    return;
  }
  if (typeof quantity !== "number" || !(quantity > 0)) {
    res.status(400).json({ error: "保有数は正の数で入力してください" });
    return;
  }

  const normalizedCode = code.trim().toUpperCase();
  const isFund = isFundCode(normalizedCode);

  // Validate the code exists before saving it.
  try {
    if (isFund) {
      await fetchFundQuote(normalizedCode);
    } else {
      await fetchQuote(normalizedCode);
    }
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "銘柄の追加に失敗しました" });
    return;
  }

  const position: Position = {
    code: normalizedCode,
    quantity,
    avgCost: avgCost ?? null,
    acquiredDate: acquiredDate ?? null,
    assetType: isFund ? "fund" : "stock",
  };
  await upsertPosition(position);
  const snapshot = await refreshSnapshot();
  res.json(toResponse(snapshot, false));
});
