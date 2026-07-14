import { NextRequest, NextResponse } from "next/server";
import { buildDiscordAuthorizeUrl, discordOAuthConfigured, signDiscordState } from "@/lib/discord-oauth";
import { rateLimit, clientIp, rateLimitResponse } from "@/lib/rate-limit";

function safeNext(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/feed";
  return next;
}

/** GET /api/viewer/discord/start?next=/feed — redirects into Discord's OAuth2 consent screen. */
export async function GET(req: NextRequest) {
  if (!rateLimit(`discord-viewer-start:${clientIp(req)}`, 20, 10 * 60 * 1000)) {
    return rateLimitResponse();
  }
  if (!discordOAuthConfigured()) {
    return NextResponse.json({ ok: false, error: "Discord login not configured" }, { status: 503 });
  }

  const next = safeNext(req.nextUrl.searchParams.get("next"));
  const url = buildDiscordAuthorizeUrl(signDiscordState(next));
  if (!url) {
    return NextResponse.json({ ok: false, error: "Discord login not configured" }, { status: 503 });
  }
  return NextResponse.redirect(url);
}
