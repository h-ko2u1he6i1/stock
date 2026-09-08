import { route, authRequired, authenticate, sessionCookie } from "./_lib/http.js";

export default route(
  ["POST"],
  async (req, res) => {
    if (!authRequired()) {
      res.json({ ok: true, authRequired: false, role: "owner" });
      return;
    }
    const body = (req.body ?? {}) as { password?: unknown };
    const role = authenticate(body.password);
    if (!role) {
      res.status(401).json({ error: "パスワードが違います" });
      return;
    }
    res.setHeader("Set-Cookie", await sessionCookie(role));
    res.json({ ok: true, role });
  },
  { auth: false }
);
