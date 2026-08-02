/**
 * "Continue with X" — OAuth 2.0 + PKCE sign-in (public/native client, no secret).
 *
 * Stateless flow (same pattern as RH-Wallet's Robinhood agentic bridge):
 *   1. GET /api/auth/x/start    — generate PKCE pair, sign {code_verifier, claim_code}
 *                                 into `state`, redirect to X's authorize endpoint.
 *   2. GET /api/auth/x/callback — verify state, exchange code -> token, call
 *                                 GET /2/users/me, then mark the claim verified.
 *
 * We never persist the X access/refresh token — it's used once to look up the
 * signed-in handle and then discarded.
 */
import { createHmac, randomBytes, createHash, timingSafeEqual } from "crypto";

const AUTHORIZE_ENDPOINT = "https://twitter.com/i/oauth2/authorize";
const TOKEN_ENDPOINT = "https://api.twitter.com/2/oauth2/token";
const SCOPES = "tweet.read users.read";

let bootFallbackSecret: string | null = null;

function stateSecret(): string {
  const key = process.env.X_OAUTH_STATE_SECRET || process.env.ADMIN_SECRET;
  if (key) return key;
  // No persistent secret configured — fall back to a boot-time random key.
  // OAuth round-trips complete in seconds, so this surviving only until the
  // next deploy/restart is fine.
  if (!bootFallbackSecret) bootFallbackSecret = randomBytes(32).toString("hex");
  return bootFallbackSecret;
}

export function xOauthClientId(): string | null {
  return process.env.X_OAUTH_CLIENT_ID || null;
}

export function xOauthEnabled(): boolean {
  return Boolean(xOauthClientId());
}

function base64url(input: Buffer): string {
  return input.toString("base64url");
}

function pkcePair(): { verifier: string; challenge: string } {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

interface StatePayload {
  cv: string;
  claimCode: string;
  redirectUri: string;
  ts: number;
}

function encodeState(payload: StatePayload): string {
  const body = base64url(Buffer.from(JSON.stringify(payload)));
  const sig = createHmac("sha256", stateSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function decodeState(state: string): StatePayload | null {
  const dot = state.lastIndexOf(".");
  if (dot < 1) return null;
  const body = state.slice(0, dot);
  const sig = state.slice(dot + 1);
  const expected = createHmac("sha256", stateSecret()).update(body).digest("base64url");
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as StatePayload;
    if (!payload.ts || Date.now() - payload.ts > 10 * 60 * 1000) return null; // 10 min TTL
    return payload;
  } catch {
    return null;
  }
}

/** Build the redirect URL to send the browser to X's consent screen. */
export function buildAuthorizeUrl(opts: { claimCode: string; redirectUri: string }): string | null {
  const clientId = xOauthClientId();
  if (!clientId) return null;

  const { verifier, challenge } = pkcePair();
  const state = encodeState({
    cv: verifier,
    claimCode: opts.claimCode,
    redirectUri: opts.redirectUri,
    ts: Date.now(),
  });

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: opts.redirectUri,
    scope: SCOPES,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  return `${AUTHORIZE_ENDPOINT}?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
}

export interface XCallbackResult {
  ok: boolean;
  error?: string;
  claimCode?: string;
  xUsername?: string;
}

/** Handle the callback: verify state, exchange code, fetch the signed-in user. */
export async function completeXOauthCallback(opts: {
  code: string;
  state: string;
}): Promise<XCallbackResult> {
  const payload = decodeState(opts.state);
  if (!payload) return { ok: false, error: "Invalid or expired sign-in link. Please try again." };

  const clientId = xOauthClientId();
  if (!clientId) return { ok: false, error: "X sign-in is not configured on this server." };

  const tokenRes = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: opts.code,
      redirect_uri: payload.redirectUri,
      client_id: clientId,
      code_verifier: payload.cv,
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text().catch(() => "");
    return { ok: false, error: `X token exchange failed (${tokenRes.status}): ${text.slice(0, 200)}`, claimCode: payload.claimCode };
  }

  const token = (await tokenRes.json()) as TokenResponse;
  if (!token.access_token) {
    return { ok: false, error: "X did not return an access token.", claimCode: payload.claimCode };
  }

  const meRes = await fetch("https://api.twitter.com/2/users/me", {
    headers: { Authorization: `Bearer ${token.access_token}` },
    signal: AbortSignal.timeout(10000),
  });

  if (!meRes.ok) {
    return { ok: false, error: `Could not read X profile (${meRes.status}).`, claimCode: payload.claimCode };
  }

  const me = (await meRes.json()) as { data?: { username?: string } };
  const username = me.data?.username?.toLowerCase();
  if (!username) {
    return { ok: false, error: "X profile response was missing a username.", claimCode: payload.claimCode };
  }

  return { ok: true, claimCode: payload.claimCode, xUsername: username };
}
