/**
 * Server-side client for the rhagent-telegram-agent settings API.
 * The public UI lives on rhagent.bot; sessions are still owned by the agent service.
 */

export const TRADING_SESSION_COOKIE = "rhagent_trading_session";

export function telegramAgentBaseUrl(): string {
  const raw =
    process.env.TELEGRAM_AGENT_API_URL?.trim() ||
    "https://rhagent-telegram-agent-production.up.railway.app";
  return raw.replace(/\/$/, "");
}

export async function claimTradingLoginCode(
  code: string,
): Promise<{ ok: true; sessionId: string; expiresAt: string } | { ok: false; error: string }> {
  if (!code || !/^[A-Za-z0-9_-]+$/.test(code)) {
    return { ok: false, error: "Invalid login code." };
  }
  const res = await fetch(`${telegramAgentBaseUrl()}/api/dashboard/claim`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ code }),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    sessionId?: string;
    expiresAt?: string;
  };
  if (!res.ok || !body.ok || !body.sessionId || !body.expiresAt) {
    return {
      ok: false,
      error: body.error || "This login link is invalid, expired, or already used. Send /website in Telegram for a fresh link.",
    };
  }
  return { ok: true, sessionId: body.sessionId, expiresAt: body.expiresAt };
}

export async function proxyTradingAgent(
  sessionId: string,
  path: string,
  init: { method?: string; body?: string | null } = {},
): Promise<{ status: number; body: unknown }> {
  const url = `${telegramAgentBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    method: init.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Requested-With": "dashboard",
      Cookie: `rhagent_session=${encodeURIComponent(sessionId)}`,
    },
    body: init.body ?? undefined,
    cache: "no-store",
  });
  const text = await res.text();
  let body: unknown = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { ok: false, error: text || `Upstream error (${res.status})` };
  }
  return { status: res.status, body };
}

/** Max-Age for Set-Cookie from an agent expiresAt ("YYYY-MM-DD HH:MM:SS" UTC). */
export function sessionMaxAgeSec(expiresAt: string): number {
  const ms = new Date(expiresAt.replace(" ", "T") + "Z").getTime() - Date.now();
  return Math.max(0, Math.floor(ms / 1000));
}
