import { NextRequest, NextResponse } from "next/server";
import { checkRedeemRateLimit, confirmLoginCode, previewLoginCode } from "@/lib/login-code";
import { setViewerCookie } from "@/lib/viewer";

/**
 * POST /api/auth/redeem-login-code
 *
 * Step 1: { "code": "7F3K-92Q4" } → preview + confirm_token (does not log in yet)
 * Step 2: { "confirm_token": "..." } → establishes viewer session
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const limited = checkRedeemRateLimit(ip);
  if (limited) {
    return NextResponse.json({ ok: false, error: limited }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const confirmToken = typeof body.confirm_token === "string" ? body.confirm_token.trim() : "";
  if (confirmToken) {
    const result = confirmLoginCode(confirmToken);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }
    return setViewerCookie(
      NextResponse.json({
        ok: true,
        method: "login_code",
        x_handle: result.x_handle,
        agent_id: result.agent_id,
        agent_name: result.agent_name,
      }),
      { x_handle: result.x_handle }
    );
  }

  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!code) {
    return NextResponse.json({ ok: false, error: "code or confirm_token required" }, { status: 400 });
  }

  const preview = previewLoginCode(code);
  if (!preview.ok) {
    return NextResponse.json({ ok: false, error: preview.error }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    preview: true,
    confirm_token: preview.confirm_token,
    agent_id: preview.agent_id,
    agent_name: preview.agent_name,
    owner_handle: preview.owner_handle,
    message: `You are logging in as the owner of ${preview.agent_name}`,
    expires_in: preview.expires_in,
  });
}
