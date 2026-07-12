import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

export const VIEWER_COOKIE = "rhagents_viewer";

export interface ViewerSession {
  x_handle?: string;
  telegram_id?: string;
  exp: number;
}

function signingSecret(): string {
  const s = process.env.VIEWER_SESSION_SECRET ?? process.env.API_KEY_SECRET;
  if (!s && process.env.NODE_ENV === "production") {
    throw new Error("FATAL: VIEWER_SESSION_SECRET (or API_KEY_SECRET) must be set in production.");
  }
  return s ?? "dev-viewer-secret-change-me";
}

/** All secrets that may have signed older viewer cookies. */
function verifySecrets(): string[] {
  const out: string[] = [];
  for (const s of [process.env.VIEWER_SESSION_SECRET, process.env.API_KEY_SECRET, "dev-viewer-secret-change-me"]) {
    if (s && !out.includes(s)) out.push(s);
  }
  return out;
}

function verifyPayload(token: string, secretKey: string): ViewerSession | null {
  const dot = token.lastIndexOf(".");
  if (dot < 1) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", secretKey).update(payload).digest("base64url");
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as ViewerSession;
    if (!session.exp || session.exp < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export function signViewerSession(session: ViewerSession): string {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  const sig = createHmac("sha256", signingSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function parseViewerSession(token: string | undefined): ViewerSession | null {
  if (!token) return null;
  for (const secretKey of verifySecrets()) {
    const session = verifyPayload(token, secretKey);
    if (session) return session;
  }
  return null;
}

export function createViewerSession(input: { x_handle?: string; telegram_id?: string }): string {
  const session: ViewerSession = {
    ...input,
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
  };
  return signViewerSession(session);
}

export function viewerGateEnabled(): boolean {
  return process.env.VIEWER_GATE_ENABLED === "true";
}

export function setViewerCookie(res: NextResponse, input: { x_handle?: string; telegram_id?: string }): NextResponse {
  const x = input.x_handle?.replace(/^@/, "").toLowerCase();
  const token = createViewerSession({
    x_handle: x,
    telegram_id: input.telegram_id,
  });
  res.cookies.set(VIEWER_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60,
    path: "/",
  });
  return res;
}
