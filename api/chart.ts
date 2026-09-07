import { route } from "./_lib/http.js";
import { CHART_RANGES, getChart, type ChartRange } from "./_lib/chart.js";
import { isFundCode } from "./_lib/yahoo.js";

export default route(["GET"], async (req, res) => {
  const code = typeof req.query.code === "string" ? req.query.code.trim().toUpperCase() : "";
  const range = (typeof req.query.range === "string" ? req.query.range : "6M") as ChartRange;

  if (!code) {
    res.status(400).json({ error: "銘柄コードを指定してください" });
    return;
  }
  if (!CHART_RANGES.includes(range)) {
    res.status(400).json({ error: "range が不正です" });
    return;
  }
  if (isFundCode(code)) {
    res.status(400).json({ error: "投資信託のチャートは未対応です" });
    return;
  }

  const data = await getChart(code, range);
  // Chart data changes slowly; let the browser/CDN cache it briefly.
  res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=3600");
  res.json(data);
});
