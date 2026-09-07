import { route, isRefreshAuthorized } from "./_lib/http.js";
import { refreshSnapshot } from "./_lib/snapshot.js";

/**
 * Rebuilds the portfolio snapshot from Yahoo. Invoked by Vercel Cron
 * (Authorization: Bearer $CRON_SECRET) or manually with ?key=$REFRESH_KEY.
 */
export default route(
  ["GET", "POST"],
  async (req, res) => {
    if (!isRefreshAuthorized(req)) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const snapshot = await refreshSnapshot();
    res.json({ ok: true, fetchedAt: snapshot.fetchedAt, positions: snapshot.data.positions.length });
  },
  { auth: false }
);
