import { route, isRefreshAuthorized, viewerEnabled } from "./_lib/http.js";
import { refreshSnapshot } from "./_lib/snapshot.js";

/**
 * Rebuilds the portfolio snapshot(s) from Yahoo. Invoked by Vercel Cron
 * (Authorization: Bearer $CRON_SECRET) or manually with ?key=$REFRESH_KEY.
 */
export default route(
  ["GET", "POST"],
  async (req, res) => {
    if (!isRefreshAuthorized(req)) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const owner = await refreshSnapshot("owner");
    let viewer: { fetchedAt: string; positions: number } | null = null;
    if (viewerEnabled()) {
      const s = await refreshSnapshot("viewer");
      viewer = { fetchedAt: s.fetchedAt, positions: s.data.positions.length };
    }
    res.json({
      ok: true,
      owner: { fetchedAt: owner.fetchedAt, positions: owner.data.positions.length },
      viewer,
    });
  },
  { auth: false }
);
