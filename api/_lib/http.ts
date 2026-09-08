import type { VercelRequest, VercelResponse } from "@vercel/node";
import { SignJWT, jwtVerify } from "jose";
import { waitUntil } from "@vercel/functions";

export type Handler = (req: VercelRequest, res: VercelResponse) => unknown | Promise<unknown>;

/** "owner" sees the real portfolio; "viewer" sees an isolated demo portfolio. */
export type Role = "owner" | "viewer";

/** Run a promise after the response without blocking it (no-op-safe off Vercel). */
export function background(p: Promise<unknown>): void {
  const settled = p.catch(() => undefined);
  try {
    waitUntil(settled);
  } catch {
    void settled;
  }
}

const COOKIE_NAME = "stock_session";
const MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 days
const secretKey = () =>
  new TextEncoder().encode(process.env.AUTH_SECRET ?? "dev-insecure-secret-change-me");

const ownerPassword = () => process.env.APP_PASSWORD ?? "";
const viewerPassword = () => process.env.VIEWER_PASSWORD ?? "";
const isProd = () => Boolean(process.env.VERCEL) || process.env.NODE_ENV === "production";

/** When no APP_PASSWORD is configured the app is open as owner (useful for local dev). */
export function authRequired(): boolean {
  return ownerPassword().length > 0;
}

export function viewerEnabled(): boolean {
  return viewerPassword().length > 0;
}

/** Returns the role the password grants, or null if it matches nothing. */
export function authenticate(input: unknown): Role | null {
  if (typeof input !== "string" || input.length === 0) return null;
  if (input === ownerPassword()) return "owner";
  if (viewerPassword() && input === viewerPassword()) return "viewer";
  return null;
}

function readCookie(req: VercelRequest, name: string): string | undefined {
  const fromParsed = (req.cookies as Record<string, string> | undefined)?.[name];
  if (fromParsed) return fromParsed;
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

export async function sessionCookie(role: Role): Promise<string> {
  const token = await new SignJWT({ role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SEC}s`)
    .sign(secretKey());
  const attrs = [
    `${COOKIE_NAME}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${MAX_AGE_SEC}`,
  ];
  if (isProd()) attrs.push("Secure");
  return attrs.join("; ");
}

export function clearCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

/** The caller's role: "owner" when auth is disabled, else decoded from the cookie. */
export async function getRole(req: VercelRequest): Promise<Role | null> {
  if (!authRequired()) return "owner";
  const token = readCookie(req, COOKIE_NAME);
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return payload.role === "viewer" ? "viewer" : "owner";
  } catch {
    return null;
  }
}

export async function isAuthed(req: VercelRequest): Promise<boolean> {
  return (await getRole(req)) != null;
}

/**
 * Wraps a handler: enforces method(s), auth, optional owner-only access, and
 * turns thrown errors into JSON.
 */
export function route(
  methods: string[],
  handler: Handler,
  opts: { auth?: boolean; owner?: boolean } = {}
): Handler {
  return async (req, res) => {
    if (!methods.includes(req.method ?? "GET")) {
      res.setHeader("Allow", methods.join(", "));
      res.status(405).json({ error: "Method Not Allowed" });
      return;
    }
    if (opts.auth !== false) {
      const role = await getRole(req);
      if (role == null) {
        res.status(401).json({ error: "認証が必要です" });
        return;
      }
      if (opts.owner && role !== "owner") {
        res.status(403).json({ error: "閲覧用アカウントでは変更できません" });
        return;
      }
    }
    try {
      await handler(req, res);
    } catch (e) {
      const message = e instanceof Error ? e.message : "サーバーエラー";
      if (!res.headersSent) res.status(500).json({ error: message });
    }
  };
}

/** True when the request carries the Vercel Cron secret or the manual refresh key. */
export function isRefreshAuthorized(req: VercelRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const refreshKey = process.env.REFRESH_KEY;
  if (!cronSecret && !refreshKey) return true; // not configured → allow (dev)
  const auth = req.headers.authorization;
  if (cronSecret && auth === `Bearer ${cronSecret}`) return true;
  const key = typeof req.query.key === "string" ? req.query.key : undefined;
  if (refreshKey && key === refreshKey) return true;
  return false;
}
