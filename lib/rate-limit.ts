/**
 * Simple in-process rate limiter.
 * Resets on deploy — adequate for single-instance Railway deployments.
 * Replace with Upstash Redis if horizontally scaled.
 */

interface Window {
  count: number;
  resetAt: number;
}

const store = new Map<string, Window>();

/** Prune old entries every 5 minutes to prevent memory growth. */
let lastPrune = Date.now();
function maybePrune() {
  if (Date.now() - lastPrune < 5 * 60 * 1000) return;
  lastPrune = Date.now();
  for (const [k, w] of store) {
    if (w.resetAt < Date.now()) store.delete(k);
  }
}

/**
 * Check if a key has exceeded its rate limit.
 * @param key      Unique key (e.g. "register:1.2.3.4")
 * @param limit    Max requests per window
 * @param windowMs Window size in milliseconds
 * @returns true if the request is allowed, false if rate-limited
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  maybePrune();
  const now = Date.now();
  const w = store.get(key);
  if (!w || w.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (w.count >= limit) return false;
  w.count += 1;
  return true;
}

/** Extract a stable client IP from a Request (works behind Railway/Vercel proxies). */
export function clientIp(req: Request): string {
  const fwd = (req.headers as Headers).get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return "unknown";
}

/** Returns a 429 NextResponse for rate-limited requests. */
export function rateLimitResponse() {
  const { NextResponse } = require("next/server") as typeof import("next/server");
  return NextResponse.json(
    { ok: false, error: "Too many requests — please wait before retrying." },
    { status: 429, headers: { "Retry-After": "60" } }
  );
}
