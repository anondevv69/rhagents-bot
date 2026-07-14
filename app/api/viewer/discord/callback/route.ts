import { NextRequest, NextResponse } from "next/server";
import { exchangeDiscordCodeForUser, verifyDiscordState } from "@/lib/discord-oauth";
import { setViewerCookie } from "@/lib/viewer";
import { getSiteBaseUrl } from "@/lib/rhagent-setup";
import { rateLimit, clientIp, rateLimitResponse } from "@/lib/rate-limit";

/** GET /api/viewer/discord/callback — Discord redirects here after the user approves/denies. */
export async function GET(req: NextRequest) {
  if (!rateLimit(`discord-viewer-callback:${clientIp(req)}`, 30, 10 * 60 * 1000)) {
    return rateLimitResponse();
  }

  const base = getSiteBaseUrl();
  const failure = NextResponse.redirect(`${base}/login?error=discord_failed`);

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  if (!code || !state) return failure;

  const parsedState = verifyDiscordState(state);
  if (!parsedState) return failure;

  const user = await exchangeDiscordCodeForUser(code);
  if (!user) return failure;

  return setViewerCookie(NextResponse.redirect(`${base}${parsedState.next}`), { discord_id: user.id });
}
