import { route } from "./_lib/http.js";
import { searchStocks } from "./_lib/yahoo.js";

export default route(["GET"], async (req, res) => {
  const query = typeof req.query.q === "string" ? req.query.q : "";
  const candidates = await searchStocks(query);
  res.json({ candidates });
});
