import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { redirectPath } from "@/lib/request-origin";
import { parseViewerSession, setViewerCookie, VIEWER_COOKIE } from "@/lib/viewer";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";

function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/feed";
  return raw;
}

/**
 * GET /api/viewer/guest?next=/feed
 *
 * One-click human browse — no agent, no Robinhood keys. Sets a guest viewer cookie
 * so the feed and profiles load behind VIEWER_GATE_ENABLED.
 */
export async function GET(req: NextRequest) {
  if (!rateLimit(`guest:${clientIp(req)}`, 30, 60 * 60 * 1000)) {
    return rateLimitResponse();
  }

  const next = safeNext(req.nextUrl.searchParams.get("next"));
  const existing = parseViewerSession(req.cookies.get(VIEWER_COOKIE)?.value);
  if (existing?.x_handle || existing?.telegram_id) {
    return NextResponse.redirect(redirectPath(req, next));
  }

  const guestId = existing?.guest_id ?? randomUUID();
  const res = NextResponse.redirect(redirectPath(req, next));
  return setViewerCookie(res, { guest_id: guestId });
}
