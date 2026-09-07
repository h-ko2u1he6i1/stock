import { route, authRequired, checkPassword, sessionCookie } from "./_lib/http.js";

export default route(
  ["POST"],
  async (req, res) => {
    if (!authRequired()) {
      res.json({ ok: true, authRequired: false });
      return;
    }
    const body = (req.body ?? {}) as { password?: unknown };
    if (!checkPassword(body.password)) {
      res.status(401).json({ error: "パスワードが違います" });
      return;
    }
    res.setHeader("Set-Cookie", await sessionCookie());
    res.json({ ok: true });
  },
  { auth: false }
);
