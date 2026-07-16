import { NextRequest, NextResponse } from "next/server";
import { TRADING_SESSION_COOKIE, proxyTradingAgent } from "@/lib/telegram-agent-dashboard";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const sessionId = req.cookies.get(TRADING_SESSION_COOKIE)?.value;
  if (sessionId) {
    await proxyTradingAgent(sessionId, "/dashboard/logout", { method: "POST", body: "{}" }).catch(() => null);
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: TRADING_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  return res;
}
