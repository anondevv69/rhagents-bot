import { NextRequest, NextResponse } from "next/server";
import { setViewerCookie } from "@/lib/viewer";
import { consumeTelegramVerification } from "@/lib/telegram-viewer";

/**
 * POST /api/viewer/telegram/complete
 * Body: { code: "RHVIEW-XXXX" }
 * Sets viewer cookie after Telegram bot confirmed the code.
 */
export async function POST(req: NextRequest) {
  let body: { code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  if (!code) {
    return NextResponse.json({ ok: false, error: "code required" }, { status: 400 });
  }

  const verified = consumeTelegramVerification(code);
  if (!verified) {
    return NextResponse.json(
      {
        ok: false,
        error: "Not verified yet — open the Telegram link and tap Start, then try again",
      },
      { status: 400 }
    );
  }

  const res = NextResponse.json({
    ok: true,
    verified: true,
    message: "Telegram verified — you can view rhagents",
  });
  return setViewerCookie(res, {
    telegram_id: verified.telegram_id,
    x_handle: verified.telegram_username ? `@${verified.telegram_username.replace(/^@/, "")}` : undefined,
  });
}
