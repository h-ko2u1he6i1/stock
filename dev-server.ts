/**
 * Local dev server. Mounts the same handlers Vercel deploys as functions,
 * so `npm run dev` behaves like production without needing the Vercel CLI.
 */
import express, { type Request, type Response } from "express";
import portfolio from "./api/portfolio.js";
import positions from "./api/positions.js";
import positionByCode from "./api/positions/[code].js";
import search from "./api/search.js";
import chart from "./api/chart.js";
import login from "./api/login.js";
import logout from "./api/logout.js";
import session from "./api/session.js";
import refresh from "./api/refresh.js";

type Vercelish = (req: any, res: any) => unknown;

const app = express();
app.use(express.json());

const adapt =
  (handler: Vercelish) =>
  (req: Request, res: Response) => {
    // Vercel merges dynamic route params into req.query.
    (req as any).query = { ...req.query, ...req.params };
    return handler(req, res);
  };

app.get("/api/portfolio", adapt(portfolio));
app.post("/api/positions", adapt(positions));
app.put("/api/positions/:code", adapt(positionByCode));
app.delete("/api/positions/:code", adapt(positionByCode));
app.get("/api/search", adapt(search));
app.get("/api/chart", adapt(chart));
app.post("/api/login", adapt(login));
app.post("/api/logout", adapt(logout));
app.get("/api/session", adapt(session));
app.all("/api/refresh", adapt(refresh));

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;
const server = app.listen(PORT, () => console.log(`api dev server on http://localhost:${PORT}`));

// Short keep-alive + forced socket close so `tsx watch` can restart quickly
// instead of waiting 5s and SIGKILLing the process on every file save.
server.keepAliveTimeout = 1000;
let shuttingDown = false;
for (const sig of ["SIGTERM", "SIGINT"] as const) {
  process.on(sig, () => {
    if (shuttingDown) return;
    shuttingDown = true;
    server.closeAllConnections?.();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1500).unref();
  });
}
