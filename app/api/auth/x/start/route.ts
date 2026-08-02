import { NextRequest, NextResponse } from "next/server";
import { buildAuthorizeUrl, xOauthEnabled } from "@/lib/x-oauth";
import { getSiteBaseUrl } from "@/lib/rhagent-setup";
import { rateLimit, clientIp, rateLimitResponse } from "@/lib/rate-limit";

/**
 * GET /api/auth/x/start?code=<claim code>
 *
 * Redirects to X's OAuth 2.0 consent screen. On success, the callback marks
 * the claim verified using the signed-in X handle — no tweet required.
 */
export async function GET(req: NextRequest) {
  if (!rateLimit(`x-oauth-start:${clientIp(req)}`, 30, 60 * 60 * 1000)) {
    return rateLimitResponse();
  }

  if (!xOauthEnabled()) {
    return NextResponse.json(
      { ok: false, error: "X sign-in is not configured on this server." },
      { status: 503 }
    );
  }

  const claimCode = req.nextUrl.searchParams.get("code")?.trim().toUpperCase();
  if (!claimCode) {
    return NextResponse.json({ ok: false, error: "Missing claim code" }, { status: 400 });
  }

  const redirectUri = `${getSiteBaseUrl()}/api/auth/x/callback`;
  const authorizeUrl = buildAuthorizeUrl({ claimCode, redirectUri });
  if (!authorizeUrl) {
    return NextResponse.json(
      { ok: false, error: "X sign-in is not configured on this server." },
      { status: 503 }
    );
  }

  return NextResponse.redirect(authorizeUrl);
}
