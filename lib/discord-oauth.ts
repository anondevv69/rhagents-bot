/** Discord OAuth2 (Authorization Code) — the website login bridge, parallel to the Telegram deep link. */
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { getSiteBaseUrl } from "./rhagent-setup";

function clientId(): string | null {
  const id = process.env.DISCORD_APPLICATION_ID?.trim();
  return id && id.length > 0 ? id : null;
}

function clientSecret(): string | null {
  const s = process.env.DISCORD_CLIENT_SECRET?.trim();
  return s && s.length > 0 ? s : null;
}

export function discordOAuthConfigured(): boolean {
  return !!clientId() && !!clientSecret();
}

function redirectUri(): string {
  return `${getSiteBaseUrl().replace(/\/$/, "")}/api/viewer/discord/callback`;
}

function stateSecret(): string {
  return process.env.VIEWER_SESSION_SECRET ?? process.env.API_KEY_SECRET ?? "dev-viewer-secret-change-me";
}

/** Signed `state` param — CSRF protection + carries `next` without needing server-side storage. */
export function signDiscordState(next: string): string {
  const payload = Buffer.from(JSON.stringify({ next, n: randomBytes(6).toString("hex") })).toString("base64url");
  const sig = createHmac("sha256", stateSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyDiscordState(state: string): { next: string } | null {
  const dot = state.lastIndexOf(".");
  if (dot < 1) return null;
  const payload = state.slice(0, dot);
  const sig = state.slice(dot + 1);
  const expected = createHmac("sha256", stateSecret()).update(payload).digest("base64url");
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { next?: unknown };
    const next = typeof parsed.next === "string" && parsed.next.startsWith("/") && !parsed.next.startsWith("//")
      ? parsed.next
      : "/feed";
    return { next };
  } catch {
    return null;
  }
}

export function buildDiscordAuthorizeUrl(state: string): string | null {
  const id = clientId();
  if (!id) return null;
  const params = new URLSearchParams({
    client_id: id,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: "identify",
    state,
    prompt: "none",
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

export async function exchangeDiscordCodeForUser(
  code: string,
): Promise<{ id: string; username: string } | null> {
  const id = clientId();
  const secret = clientSecret();
  if (!id || !secret) return null;
  try {
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: id,
        client_secret: secret,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri(),
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!tokenRes.ok) return null;
    const tokenData = (await tokenRes.json()) as { access_token?: string };
    if (!tokenData.access_token) return null;

    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!userRes.ok) return null;
    const user = (await userRes.json()) as { id: string; username: string; global_name?: string | null };
    return { id: user.id, username: user.global_name ?? user.username };
  } catch (err) {
    console.error("[discord-oauth] exchange failed", err);
    return null;
  }
}
