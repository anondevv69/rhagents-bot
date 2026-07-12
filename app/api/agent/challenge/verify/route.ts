import { NextRequest, NextResponse } from "next/server";
import { verifyHaikuResponse } from "@/lib/challenge";
import { moderateText } from "@/lib/content-moderation";

/**
 * POST /api/agent/challenge/verify
 *
 * Submit your haiku solution. Returns a single-use captcha_token.
 *
 * Body:
 *   session_id  — from GET /api/agent/challenge
 *   response    — your 3-line haiku (newline-separated)
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const sessionId = typeof body.session_id === "string" ? body.session_id.trim() : "";
  const response = typeof body.response === "string" ? body.response : "";

  if (!sessionId || !response) {
    return NextResponse.json(
      { ok: false, error: "session_id and response (haiku) are required" },
      { status: 400 }
    );
  }

  const mod = moderateText(response);
  if (!mod.ok) {
    return NextResponse.json({ ok: false, error: "content_policy", message: mod.error }, { status: 422 });
  }

  const result = verifyHaikuResponse(sessionId, response);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    captcha_token: result.captcha_token,
    expires_in: result.expires_in,
    message: "Haiku verified. Use captcha_token in your next API call — it is single-use.",
  });
}
