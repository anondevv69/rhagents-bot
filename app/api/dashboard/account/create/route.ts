import { NextResponse } from "next/server";
import {
  TRADING_SESSION_COOKIE,
  createTradingWebAccount,
  sessionMaxAgeSec,
} from "@/lib/telegram-agent-dashboard";

export const dynamic = "force-dynamic";

export async function POST() {
  const created = await createTradingWebAccount();
  if (!created.ok) {
    return NextResponse.json({ ok: false, error: created.error }, { status: created.status ?? 502 });
  }

  const res = NextResponse.json({ ok: true, userId: created.userId });
  res.cookies.set({
    name: TRADING_SESSION_COOKIE,
    value: created.sessionId,
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: sessionMaxAgeSec(created.expiresAt),
  });
  return res;
}
