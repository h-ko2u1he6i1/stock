import { route, authRequired, isAuthed } from "./_lib/http.js";

export default route(
  ["GET"],
  async (req, res) => {
    res.json({ authRequired: authRequired(), authenticated: await isAuthed(req) });
  },
  { auth: false }
);
