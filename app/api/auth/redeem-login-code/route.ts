import { NextRequest, NextResponse } from "next/server";
import { isRateLimited, noteRedeemFailure, redeemLoginCode } from "@/lib/login-code";
import { setViewerCookie } from "@/lib/viewer";
import { getViewerSession } from "@/lib/viewerSession";

/**
 * POST /api/auth/redeem-login-code
 * Body: { "code": "7F3K-92Q4" } → establishes viewer session for the agent's verified owner.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    noteRedeemFailure(ip);
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!code) {
    noteRedeemFailure(ip);
    return NextResponse.json({ ok: false, error: "code required" }, { status: 400 });
  }

  const limited = isRateLimited(ip);
  if (limited) {
    return NextResponse.json(
      { ok: false, error: "Too many attempts — wait a few minutes, then ask your agent for a fresh code." },
      { status: 429 },
    );
  }

  const result = redeemLoginCode(code);
  if (!result.ok) {
    noteRedeemFailure(ip);
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  return setViewerCookie(
    NextResponse.json({
      ok: true,
      method: "login_code",
      x_handle: result.x_handle,
      agent_id: result.agent_id,
      agent_name: result.agent_name,
      owner_handle: result.owner_handle,
    }),
    { x_handle: result.x_handle },
    { merge: await getViewerSession() },
  );
}
