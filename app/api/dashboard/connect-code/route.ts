import { NextRequest, NextResponse } from "next/server";
import {
  TRADING_SESSION_COOKIE,
  proxyTradingAgent,
  sessionMaxAgeSec,
} from "@/lib/telegram-agent-dashboard";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { platform?: string };
  const platform = body.platform === "discord" ? "discord" : "telegram";
  const sessionId = req.cookies.get(TRADING_SESSION_COOKIE)?.value;
  if (!sessionId) {
    return NextResponse.json({ ok: false, error: "Not logged in." }, { status: 401 });
  }

  const { status, body: upstream } = await proxyTradingAgent(sessionId, "/api/dashboard/connect-code", {
    method: "POST",
    body: JSON.stringify({ platform }),
  });

  const data = upstream as {
    ok?: boolean;
    error?: string;
    startParam?: string;
    deepLinkTelegram?: string | null;
    ttlMinutes?: number;
    dashboardUrl?: string;
  };

  if (status !== 200 || !data.ok) {
    return NextResponse.json({ ok: false, error: data.error || "Failed to create connect code." }, { status });
  }

  return NextResponse.json({ ok: true, ...data });
}
