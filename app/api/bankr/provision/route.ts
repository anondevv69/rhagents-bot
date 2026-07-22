import { NextRequest, NextResponse } from "next/server";
import { getAgentFromRequest } from "@/lib/auth";
import { bridgeSecretOk } from "@/lib/telegram-bridge-auth";
import { rateLimit, clientIp, rateLimitResponse } from "@/lib/rate-limit";
import {
  attachBankrWalletToAgent,
  resolveOrProvisionBankrWallet,
  setBankrWalletEnv,
  type ProvisionChannel,
} from "@/lib/bankr-provision";

export const dynamic = "force-dynamic";

/**
 * POST /api/bankr/provision
 *
 * Auto-provision a Bankr wallet OR link an existing terminal user's wallet.
 *
 * Auth (any one):
 *   - X-Telegram-Bridge-Secret (telegram/discord trading bot)
 *   - Authorization: Bearer {RHAGENTS_AGENT_KEY} + body.agent_id
 *   - X-Admin-Secret (internal)
 *
 * Body:
 *   channel, external_id, bankr_api_key?, agent_id?, env?
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

  const channelRaw = typeof body.channel === "string" ? body.channel.trim() : "";
  const validChannels: ProvisionChannel[] = ["telegram", "discord", "rhagents", "bankr", "web"];
  const channel = validChannels.includes(channelRaw as ProvisionChannel)
    ? (channelRaw as ProvisionChannel)
    : null;
  if (!channel) {
    return NextResponse.json(
      { ok: false, error: "channel required: telegram, discord, rhagents, bankr, web" },
      { status: 400 },
    );
  }

  const externalId = typeof body.external_id === "string" ? body.external_id.trim() : "";
  if (!externalId) {
    return NextResponse.json({ ok: false, error: "external_id required" }, { status: 400 });
  }

  const agentIdBody = typeof body.agent_id === "string" ? body.agent_id.trim() : "";
  if (bearerAgent && agentIdBody && agentIdBody !== bearerAgent.id) {
    return NextResponse.json({ ok: false, error: "agent_id mismatch" }, { status: 403 });
  }
  const agentId = agentIdBody || bearerAgent?.id || "";

  if (!rateLimit(`bankr-provision:${channel}:${externalId}`, 10, 60 * 60 * 1000)) {
    return rateLimitResponse();
  }
  if (!rateLimit(`bankr-provision:ip:${clientIp(req)}`, 60, 60 * 60 * 1000)) {
    return rateLimitResponse();
  }

  const bankrApiKey = typeof body.bankr_api_key === "string" ? body.bankr_api_key.trim() : "";
  const result = await resolveOrProvisionBankrWallet(channel, externalId, bankrApiKey || null);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  let agent = null;
  if (agentId) {
    agent = await attachBankrWalletToAgent(
      agentId,
      result.evm_address,
      result.wallet_id,
      result.provisioned,
    );
  }

  const envVars =
    body.env && typeof body.env === "object" && !Array.isArray(body.env)
      ? (body.env as Record<string, unknown>)
      : null;
  if (envVars && result.api_key && (bridge || adminOk)) {
    const clean: Record<string, string> = {};
    for (const [k, v] of Object.entries(envVars)) {
      if (typeof v === "string" && v.trim()) clean[k] = v.trim();
    }
    if (Object.keys(clean).length) {
      try {
        await setBankrWalletEnv(result.api_key, clean);
      } catch (err) {
        return NextResponse.json(
          {
            ok: false,
            error: "env_save_failed",
            message: err instanceof Error ? err.message : "env save failed",
            evm_address: result.evm_address,
          },
          { status: 502 },
        );
      }
    }
  }

  const trusted = bridge || adminOk;
  return NextResponse.json({
    ok: true,
    evm_address: result.evm_address,
    wallet_id: result.wallet_id,
    provisioned: result.provisioned,
    existing: result.existing,
    has_chain: agent ? !!agent.has_chain : undefined,
    chain_wallet: agent?.chain_wallet ?? null,
    bankr_wallet: result.evm_address,
    ...(trusted && result.api_key ? { api_key: result.api_key } : {}),
    message: result.existing
      ? "Linked existing Bankr wallet — no new wallet created."
      : "Bankr wallet provisioned. Save api_key securely (shown once).",
  });
}
