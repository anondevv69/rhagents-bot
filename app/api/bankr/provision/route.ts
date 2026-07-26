import { NextRequest, NextResponse } from "next/server";
import { getAgentFromRequest } from "@/lib/auth";
import { bridgeSecretOk } from "@/lib/telegram-bridge-auth";
import { rateLimit, clientIp, rateLimitResponse } from "@/lib/rate-limit";
import {
  attachBankrWalletToAgent,
  resolveOrProvisionBankrWallet,
  enableLlmGatewayOnWallet,
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
 * Any registered rhagent.bot agent (lite or fully registered) that authenticates with its
 * own RHAGENTS_AGENT_KEY gets the same treatment as the Telegram/Discord bot: a usable
 * api_key on first provision, and an automatic repair mint if it calls again on a wallet
 * that already exists but never got a key attached (Bankr's idempotent-replay response
 * never re-includes a key, same reason the bot has its own self-heal path). Rate limits
 * below are the abuse guard, not the claim/verification gate — a fresh lite agent can
 * provision a wallet immediately, on purpose.
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

  // Trusted callers: the Telegram/Discord bridge, admin, or the agent itself authenticating
  // with its own RHAGENTS_AGENT_KEY. All three get a usable api_key — an agent calling this
  // with its own key is exactly as trusted with its own wallet's secret as it is with every
  // other Bearer-authenticated call in this API.
  const trusted = bridge || adminOk || !!bearerAgent;

  // Bankr's idempotent-replay response (a wallet that already existed) never re-includes an
  // api_key — that's true regardless of caller trust level. For a trusted caller, repair it
  // the same way the Telegram bot's own self-heal does: mint a fresh key rather than leaving
  // the caller with an address it can't spend from.
  let apiKey = result.api_key;
  if (trusted && result.existing && !apiKey) {
    try {
      const repaired = await enableLlmGatewayOnWallet(result.wallet_id ?? result.evm_address, channel);
      apiKey = repaired.apiKey;
    } catch {
      // Best-effort — caller still gets the wallet address back even if repair fails;
      // they can retry the same call to try the repair again.
    }
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

  // Env-var sync stays bridge/admin-only — that writes secrets (Robinhood keys, rhagents
  // key) INTO the wallet on the caller's behalf, which is a different trust question than
  // "can this agent see its own wallet's spending key." An agent that wants its own env vars
  // set can do that itself directly against Bankr's /agent/env with the key it just got back.
  const envVars =
    body.env && typeof body.env === "object" && !Array.isArray(body.env)
      ? (body.env as Record<string, unknown>)
      : null;
  if (envVars && apiKey && (bridge || adminOk)) {
    const clean: Record<string, string> = {};
    for (const [k, v] of Object.entries(envVars)) {
      if (typeof v === "string" && v.trim()) clean[k] = v.trim();
    }
    if (Object.keys(clean).length) {
      try {
        await setBankrWalletEnv(apiKey, clean);
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

  return NextResponse.json({
    ok: true,
    evm_address: result.evm_address,
    wallet_id: result.wallet_id,
    provisioned: result.provisioned,
    existing: result.existing,
    has_chain: agent ? !!agent.has_chain : undefined,
    chain_wallet: agent?.chain_wallet ?? null,
    bankr_wallet: result.evm_address,
    ...(trusted && apiKey ? { api_key: apiKey } : {}),
    message: result.existing
      ? apiKey
        ? "Linked existing Bankr wallet — key repaired and attached."
        : "Linked existing Bankr wallet — no new wallet created."
      : "Bankr wallet provisioned. Save api_key securely (shown once).",
  });
}
