import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { connection } from "next/server";

export type Role = "usher" | "admin";

const SESSION_HOURS = 12;
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 60_000;

const COOKIE: Record<Role, string> = {
  usher: "usher_session",
  admin: "admin_session",
};

function roleSecret(role: Role): string {
  const value = role === "usher" ? process.env.USHER_PIN : process.env.ADMIN_PASSWORD;
  if (!value) throw new Error(`${role === "usher" ? "USHER_PIN" : "ADMIN_PASSWORD"} must be set`);
  return value;
}

/**
 * The cookie is `${expiresAt}.${hmac}`. The HMAC is keyed with the server-only
 * Supabase secret and covers the role, expiry and the current PIN/password,
 * so changing USHER_PIN or ADMIN_PASSWORD signs everyone out.
 */
function sign(role: Role, expiresAt: number): string {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY must be set");
  return createHmac("sha256", key)
    .update(`${role}:${expiresAt}:${roleSecret(role)}`)
    .digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export async function hasSession(role: Role): Promise<boolean> {
  await connection(); // expiry check uses the current time, so this must run per request
  const value = (await cookies()).get(COOKIE[role])?.value;
  if (!value) return false;
  const [exp, mac] = value.split(".");
  const expiresAt = Number(exp);
  if (!mac || !Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;
  return safeEqual(mac, sign(role, expiresAt));
}

async function startSession(role: Role) {
  const expiresAt = Date.now() + SESSION_HOURS * 3600_000;
  (await cookies()).set(COOKIE[role], `${expiresAt}.${sign(role, expiresAt)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
}

/* ---------- Lockout ----------
 * Kept in server memory per client IP. On a serverless host each warm
 * instance keeps its own counter, so this slows guessing rather than
 * guaranteeing a hard global limit.
 */
type Attempts = { count: number; lockedUntil: number };
const attempts = new Map<string, Attempts>();

async function clientKey(role: Role): Promise<string> {
  const h = await headers();
  const ip =
    h.get("x-nf-client-connection-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    "unknown";
  return `${role}:${ip}`;
}

export type LoginResult =
  | { ok: true }
  | { ok: false; error: "wrong"; remaining: number }
  | { ok: false; error: "locked"; retryInSeconds: number };

export async function attemptLogin(role: Role, input: string): Promise<LoginResult> {
  const key = await clientKey(role);
  const now = Date.now();
  const entry = attempts.get(key) ?? { count: 0, lockedUntil: 0 };

  if (entry.lockedUntil > now) {
    return { ok: false, error: "locked", retryInSeconds: Math.ceil((entry.lockedUntil - now) / 1000) };
  }
  if (entry.lockedUntil && entry.lockedUntil <= now) {
    entry.count = 0;
    entry.lockedUntil = 0;
  }

  if (safeEqual(input, roleSecret(role))) {
    attempts.delete(key);
    await startSession(role);
    return { ok: true };
  }

  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS) {
    entry.lockedUntil = now + LOCKOUT_MS;
    attempts.set(key, entry);
    return { ok: false, error: "locked", retryInSeconds: LOCKOUT_MS / 1000 };
  }
  attempts.set(key, entry);
  // Small delay on every wrong attempt to slow scripted guessing.
  await new Promise((r) => setTimeout(r, 400));
  return { ok: false, error: "wrong", remaining: MAX_ATTEMPTS - entry.count };
}
