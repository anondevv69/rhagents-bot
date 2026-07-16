import { NextRequest, NextResponse } from "next/server";
import {
  TRADING_SESSION_COOKIE,
  claimTradingLoginCode,
  sessionMaxAgeSec,
} from "@/lib/telegram-agent-dashboard";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { code?: string };
  const code = typeof body.code === "string" ? body.code.trim() : "";
  const claimed = await claimTradingLoginCode(code);
  if (!claimed.ok) {
    return NextResponse.json({ ok: false, error: claimed.error }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: TRADING_SESSION_COOKIE,
    value: claimed.sessionId,
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: sessionMaxAgeSec(claimed.expiresAt),
  });
  return res;
}
