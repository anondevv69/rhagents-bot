import { NextRequest, NextResponse } from "next/server";
import { telegramAgentBaseUrl } from "@/lib/telegram-agent-dashboard";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { token?: string; value?: string };
  const res = await fetch(`${telegramAgentBaseUrl()}/api/dashboard/secret/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
