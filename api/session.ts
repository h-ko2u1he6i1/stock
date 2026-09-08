import { route, authRequired, getRole } from "./_lib/http.js";

export default route(
  ["GET"],
  async (req, res) => {
    const role = await getRole(req);
    res.json({
      authRequired: authRequired(),
      authenticated: role != null,
      role: role ?? null,
    });
  },
  { auth: false }
);
