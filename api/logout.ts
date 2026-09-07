import { route, clearCookie } from "./_lib/http.js";

export default route(
  ["POST"],
  async (_req, res) => {
    res.setHeader("Set-Cookie", clearCookie());
    res.json({ ok: true });
  },
  { auth: false }
);
