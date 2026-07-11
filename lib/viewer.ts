import { createHmac, timingSafeEqual } from "crypto";

export const VIEWER_COOKIE = "rhagents_viewer";

export interface ViewerSession {
  x_handle?: string;
  telegram_id?: string;
  exp: number;
}

function secret(): string {
  return process.env.API_KEY_SECRET ?? process.env.VIEWER_SESSION_SECRET ?? "dev-viewer-secret-change-me";
}

export function signViewerSession(session: ViewerSession): string {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  const sig = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function parseViewerSession(token: string | undefined): ViewerSession | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
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
