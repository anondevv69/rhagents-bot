import { NextRequest, NextResponse } from "next/server";
import { getAgentFromRequest } from "@/lib/auth";
import { bridgeSecretOk } from "@/lib/telegram-bridge-auth";
import { rateLimit, clientIp, rateLimitResponse } from "@/lib/rate-limit";
import {
  createBankrAutomation,
  cancelBankrAutomation,
  getBankrJob,
  type AutomationInput,
} from "@/lib/bankr-automations";

export const dynamic = "force-dynamic";

/**
 * POST /api/bankr/automation
 *
 * Create or cancel a Bankr automation (DCA / limit / stop / TWAP) on a provisioned wallet.
 *
 * Bankr has no standing-job REST API — automations are created by sending a natural-language
 * prompt to the wallet's own Agent API (see lib/bankr-automations.ts). This route composes that
 * prompt from structured input and submits it, so the rhagent dashboard/bot never has to send
 * users to bankr.bot to set one up.
 *
 * rhagent.bot does not persist wallet API keys (bk_usr_...) — they're handed to the trusted
 * caller once at provision time and live in that caller's own vault (the trading-bot dashboard,
 * same custody model as Robinhood credentials). So this route requires the caller to supply
 * wallet_api_key on every request, same as setBankrWalletEnv.
 *
 * Auth (any one):
 *   - X-Telegram-Bridge-Secret (telegram/discord trading bot, holds the vault)
 *   - Authorization: Bearer {RHAGENTS_AGENT_KEY} (agent acting for itself, must supply its own key)
 *   - X-Admin-Secret (internal)
 *
 * Body:
 *   action: "create" | "cancel" | "status"
 *   wallet_api_key: string (bk_usr_...)
 *   input?: AutomationInput          (action=create)
 *   description?: string             (action=cancel, optional — omit to cancel all)
 *   job_id?: string                  (action=status)
 */
export async function POST(req: NextRequest) {
  const bridge = bridgeSecretOk(req.headers.get("x-telegram-bridge-secret"));
  const adminSecret = req.headers.get("x-admin-secret");
  const adminOk = adminSecret && adminSecret === process.env.ADMIN_SECRET;
  const bearerAgent = bridge || adminOk ? null : getAgentFromRequest(req);

  if (!bridge && !adminOk && !bearerAgent) {
    return NextResponse.json(
      {
        ok: false,
        error: "unauthorized",
        message: "Bridge secret, admin secret, or Bearer RHAGENTS_AGENT_KEY required.",
      },
      { status: 401 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const walletApiKey = typeof body.wallet_api_key === "string" ? body.wallet_api_key.trim() : "";
  if (!walletApiKey || !walletApiKey.startsWith("bk_usr_")) {
    return NextResponse.json(
      { ok: false, error: "wallet_api_key required (bk_usr_...)" },
      { status: 400 },
    );
  }

  const action = typeof body.action === "string" ? body.action : "";
  if (!["create", "cancel", "status"].includes(action)) {
    return NextResponse.json(
      { ok: false, error: "action required: create, cancel, or status" },
      { status: 400 },
    );
  }

  const rlKey = bearerAgent?.id || walletApiKey.slice(0, 16);
  if (!rateLimit(`bankr-automation:${rlKey}`, 30, 60 * 60 * 1000)) {
    return rateLimitResponse();
  }
  if (!rateLimit(`bankr-automation:ip:${clientIp(req)}`, 90, 60 * 60 * 1000)) {
    return rateLimitResponse();
  }

  if (action === "status") {
    const jobId = typeof body.job_id === "string" ? body.job_id.trim() : "";
    if (!jobId) {
      return NextResponse.json({ ok: false, error: "job_id required" }, { status: 400 });
    }
    const result = await getBankrJob(walletApiKey, jobId);
    if ("ok" in result && result.ok === false) {
      return NextResponse.json(result, { status: result.status });
    }
    return NextResponse.json({ ok: true, job: result });
  }

  if (action === "cancel") {
    const description = typeof body.description === "string" ? body.description.trim() : undefined;
    const result = await cancelBankrAutomation(walletApiKey, description || undefined);
    if (!result.ok) {
      return NextResponse.json(result, { status: result.status });
    }
    return NextResponse.json(result);
  }

  // action === "create"
  const input = body.input as AutomationInput | undefined;
  if (!input || typeof input !== "object" || !("kind" in input)) {
    return NextResponse.json(
      { ok: false, error: "input required: { kind, ... } — see lib/bankr-automations.ts" },
      { status: 400 },
    );
  }
  const result = await createBankrAutomation(walletApiKey, input);
  if (!result.ok) {
    return NextResponse.json(result, { status: result.status });
  }
  return NextResponse.json(result);
}
