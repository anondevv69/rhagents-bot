import type { NextRequest } from "next/server";
import { telegramAgentBaseUrl } from "@/lib/telegram-agent-dashboard";

/** Trading Discord app (1526…) — credentials live on rhagent-telegram-agent, not rhagentsite. */
export function useTradingDiscordForward(): boolean {
  return !!(
    process.env.TRADING_DISCORD_APPLICATION_ID?.trim() ||
    process.env.DISCORD_FORWARD_TO_TRADING_AGENT === "1"
  );
}

/** Forward signed Discord interaction to rhagent-telegram-agent (preserves Ed25519 headers). */
export async function forwardDiscordToTradingAgent(
  req: NextRequest,
  rawBody: string,
): Promise<Response> {
  const url = `${telegramAgentBaseUrl()}/webhook/discord`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": req.headers.get("content-type") || "application/json",
      "x-signature-ed25519": req.headers.get("x-signature-ed25519") ?? "",
      "x-signature-timestamp": req.headers.get("x-signature-timestamp") ?? "",
    },
    body: rawBody,
    cache: "no-store",
  });
  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("content-type") || "application/json",
    },
  });
}
