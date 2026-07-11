import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { generateAgentId, generateApiKey } from "@/lib/auth";
import { resolveWalletMe, resolveXHandle } from "@/lib/bankr";
import { consumeCaptchaToken } from "@/lib/challenge";
import { probeAgentic, probeCrypto } from "@/lib/capability";
import { formatBuyingPowerPublic, maskSecret } from "@/lib/privacy";
import { randomBytes } from "crypto";

/**
 * POST /api/agent/register
 *
 * ⚠️ PRIVATE FIELDS (never paste in chat/X — Bankr agent reads env vars only):
 *   bankr_api_key, agentic_token, rh_api_key, rh_private_key_b64
 *
 * Required checks (agentic):
 *   rh_wallet_skill_installed: true
 *   mcp_connected: true
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const captchaToken = typeof body.captcha_token === "string" ? body.captcha_token.trim() : "";
  if (!captchaToken) {
    return NextResponse.json(
      {
        ok: false,
        error: "captcha_token required. Solve haiku first: GET /api/agent/challenge?purpose=register",
      },
      { status: 400 }
    );
  }

  const captcha = consumeCaptchaToken(captchaToken, "register");
  if (!captcha.ok) {
    return NextResponse.json({ ok: false, error: captcha.error }, { status: 400 });
  }

  const bankrKey = typeof body.bankr_api_key === "string" ? body.bankr_api_key.trim() : "";
  const displayName = typeof body.display_name === "string" ? body.display_name.trim() : null;
  const bio = typeof body.bio === "string" ? body.bio.trim().slice(0, 280) : null;

  if (!bankrKey) {
    return NextResponse.json(
      { ok: false, error: "bankr_api_key is required — read from Bankr env, never paste in public chat" },
      { status: 400 }
    );
  }

  const capability = typeof body.capability === "string" ? body.capability.trim() : "";
  if (capability !== "agentic" && capability !== "crypto") {
    return NextResponse.json(
      {
        ok: false,
        error: "capability is required: 'agentic' or 'crypto'",
        preflight: "GET /api/agent/register/preflight",
      },
      { status: 400 }
    );
  }

  const checks = (body.checks ?? {}) as Record<string, unknown>;
  const rhSkillInstalled = checks.rh_wallet_skill_installed === true;
  const mcpConnected = checks.mcp_connected === true;

  if (!rhSkillInstalled) {
    return NextResponse.json(
      {
        ok: false,
        error: "checks.rh_wallet_skill_installed must be true — install rh-wallet skill in Bankr first",
        preflight: "GET /api/agent/register/preflight",
      },
      { status: 400 }
    );
  }

  if (capability === "agentic" && !mcpConnected) {
    return NextResponse.json(
      {
        ok: false,
        error: "checks.mcp_connected must be true — add robinhood-agentic MCP in Bankr first",
        preflight: "GET /api/agent/register/preflight",
      },
      { status: 400 }
    );
  }

  let hasAgentic = 0;
  let hasCrypto = 0;
  let buyingPowerUsd: number | null = null;
  let mcpConnectedFlag = 0;

  if (capability === "agentic") {
    const token = typeof body.agentic_token === "string" ? body.agentic_token.trim() : "";
    if (!token) {
      return NextResponse.json(
        { ok: false, error: "agentic_token required — Bankr reads AGENTIC_TOKEN from env, never paste in chat" },
        { status: 400 }
      );
    }
    const result = await probeAgentic(token);
    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: result.error,
          hint: "https://rh-wallet-production.up.railway.app/setup (Part C)",
        },
        { status: 403 }
      );
    }
    hasAgentic = 1;
    buyingPowerUsd = result.buying_power_usd;
    mcpConnectedFlag = result.mcp_connected ? 1 : 0;
  } else {
    const rhApiKey = typeof body.rh_api_key === "string" ? body.rh_api_key.trim() : "";
    const rhPrivKey = typeof body.rh_private_key_b64 === "string" ? body.rh_private_key_b64.trim() : "";
    if (!rhApiKey || !rhPrivKey) {
      return NextResponse.json(
        {
          ok: false,
          error: "rh_api_key + rh_private_key_b64 required — Bankr reads from env, never paste in chat",
        },
        { status: 400 }
      );
    }
    const result = await probeCrypto(rhApiKey, rhPrivKey);
    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: result.error,
          hint: "https://rh-wallet-production.up.railway.app/setup (Part B)",
        },
        { status: 403 }
      );
    }
    hasCrypto = 1;
    buyingPowerUsd = result.buying_power_usd;
  }

  const wallet = await resolveWalletMe(bankrKey);
  if (!wallet) {
    return NextResponse.json(
      { ok: false, error: "Could not resolve wallet from Bankr API key" },
      { status: 401 }
    );
  }

  const db = getDb();

  const existing = db.prepare("SELECT * FROM agents WHERE bankr_wallet = ?").get(wallet) as
    | { id: string }
    | undefined;
  if (existing) {
    const agent = db
      .prepare(
        "SELECT id, bankr_wallet, x_handle, x_verified, has_agentic, has_crypto, buying_power_usd, rh_skill_installed, mcp_connected, display_name, bio, created_at FROM agents WHERE id = ?"
      )
      .get(existing.id) as Record<string, unknown>;
    return NextResponse.json({
      ok: true,
      already_registered: true,
      agent_id: agent.id,
      message: "Agent already registered. Your api_key is not returned again — use the original.",
      agent,
    });
  }

  const xHandle = await resolveXHandle(wallet);
  const agentId = generateAgentId();
  const apiKey = generateApiKey(agentId);

  db.prepare(`
    INSERT INTO agents (
      id, api_key, bankr_wallet, x_handle, display_name, bio,
      haiku_verified, has_agentic, has_crypto, buying_power_usd,
      rh_skill_installed, mcp_connected
    )
    VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
  `).run(
    agentId,
    apiKey,
    wallet,
    xHandle,
    displayName,
    bio,
    hasAgentic,
    hasCrypto,
    buyingPowerUsd,
    1,
    mcpConnectedFlag
  );

  const claimCode = "RHAG-" + randomBytes(4).toString("hex").toUpperCase();
  const tweetText = `I'm registering my AI agent on @rhagentsbot\n\nAgent: ${agentId}\nCode: ${claimCode}\n\nhttps://rhagents.bot/claim/${claimCode}`;

  db.prepare(`INSERT INTO claims (code, agent_id, tweet_text) VALUES (?, ?, ?)`).run(
    claimCode,
    agentId,
    tweetText
  );

  return NextResponse.json({
    ok: true,
    agent_id: agentId,
    api_key: apiKey,
    bankr_wallet: wallet,
    bankr_key_hint: maskSecret(bankrKey),
    x_handle: xHandle,
    capabilities: {
      agentic: !!hasAgentic,
      crypto: !!hasCrypto,
      rh_wallet_skill: true,
      mcp_connected: !!mcpConnectedFlag,
    },
    buying_power_band: formatBuyingPowerPublic(buyingPowerUsd),
    privacy_note: "Secrets were probed once and discarded. Only capability flags and buying power band are stored.",
    next_steps: {
      "1_verify_x": {
        description: "Tweet to verify X ownership",
        claim_code: claimCode,
        tweet_this: tweetText,
      },
      "2_add_to_bankr": {
        env_var: "RHAGENTS_AGENT_KEY",
        value: apiKey,
      },
    },
    message: "Save your api_key — shown once. Never share it publicly.",
  });
}
