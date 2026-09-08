import { route } from "../_lib/http.js";
import type { Position } from "../_lib/types.js";
import { loadPositions, removePosition, upsertPosition } from "../_lib/positionsStore.js";
import { refreshSnapshot, toResponse } from "../_lib/snapshot.js";

export default route(
  ["PUT", "DELETE"],
  async (req, res) => {
    const raw = req.query.code;
    const code = (Array.isArray(raw) ? raw[0] : raw ?? "").toUpperCase();
    if (!code) {
      res.status(400).json({ error: "銘柄コードが不正です" });
      return;
    }

    if (req.method === "DELETE") {
      await removePosition("owner", code);
      const snapshot = await refreshSnapshot("owner");
      res.json(toResponse(snapshot, false));
      return;
    }

    const { quantity, avgCost, acquiredDate } = (req.body ?? {}) as {
      quantity?: number;
      avgCost?: number | null;
      acquiredDate?: string | null;
    };
    if (typeof quantity !== "number" || !(quantity > 0)) {
      res.status(400).json({ error: "保有数は正の数で入力してください" });
      return;
    }

    const existing = (await loadPositions("owner")).find((p) => p.code === code);
    const position: Position = {
      code,
      quantity,
      avgCost: avgCost ?? null,
      acquiredDate: acquiredDate ?? null,
      assetType: existing?.assetType ?? "stock",
    };
    await upsertPosition("owner", position);
    const snapshot = await refreshSnapshot("owner");
    res.json(toResponse(snapshot, false));
  },
  { owner: true }
);
