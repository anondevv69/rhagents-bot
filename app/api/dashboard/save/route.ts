import { NextRequest, NextResponse } from "next/server";
import {
  TRADING_SESSION_COOKIE,
  claimTradingSaveToken,
  sessionMaxAgeSec,
} from "@/lib/telegram-agent-dashboard";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { token?: string; force?: boolean };
  const token = typeof body.token === "string" ? body.token.trim() : "";
  const existingSession = req.cookies.get(TRADING_SESSION_COOKIE)?.value;

  const claimed = await claimTradingSaveToken(token, {
    force: body.force === true,
    sessionId: existingSession,
  });

  if (!claimed.ok) {
    return NextResponse.json(
      { ok: false, error: claimed.error, needsMerge: claimed.needsMerge },
      { status: claimed.status ?? 400 },
    );
  }

  const res = NextResponse.json({ ok: true, userId: claimed.userId });
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
