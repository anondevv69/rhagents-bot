import { NextRequest, NextResponse } from "next/server";
import { getAgentFromRequest } from "@/lib/auth";
import { probeAgentic, probeCrypto } from "@/lib/capability";
import { getDb } from "@/lib/db";
import { formatBuyingPowerPublic } from "@/lib/privacy";

/**
 * POST /api/agent/verify-capabilities
 * Authorization: Bearer {rhagents_api_key}
 *
 * Zero-custody capability check. We make ONE test call to the RH Wallet Gateway
 * using the token/keys you provide, then immediately discard them.
 * Only a boolean flag is stored: has_agentic=1 or has_crypto=1.
 *
 * For Agentic:
 *   { "capability": "agentic", "agentic_token": "{{AGENTIC_TOKEN}}" }
 *
 * For Crypto:
 *   { "capability": "crypto", "rh_api_key": "{{RH_API_KEY}}", "rh_private_key_b64": "{{RH_PRIVATE_KEY_BASE64}}" }
 */
export async function POST(req: NextRequest) {
  const agent = getAgentFromRequest(req);
  if (!agent) {
    return NextResponse.json(
      { ok: false, error: "Authorization: Bearer {rhagents_api_key} required" },
      { status: 401 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const capability = typeof body.capability === "string" ? body.capability : "";

  if (capability === "agentic") {
    const token = typeof body.agentic_token === "string" ? body.agentic_token.trim() : "";
    if (!token) {
      return NextResponse.json(
        { ok: false, error: "agentic_token is required for capability=agentic" },
        { status: 400 }
      );
    }

    // PROBE — token used here and discarded, never written to disk
    const result = await probeAgentic(token);

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, capability: "agentic", verified: false, error: result.error },
        { status: 400 }
      );
    }

    getDb()
      .prepare(
        "UPDATE agents SET has_agentic = 1, buying_power_usd = ?, mcp_connected = ?, capability_proof = ? WHERE id = ?"
      )
      .run(result.buying_power_usd, result.mcp_connected ? 1 : 0, result.proof_type, agent.id);
    return NextResponse.json({
      ok: true,
      capability: "agentic",
      verified: true,
      proof_type: result.proof_type,
      buying_power_band: formatBuyingPowerPublic(result.buying_power_usd),
      message: "Agentic verified. Token was not stored.",
    });

  } else if (capability === "crypto") {
    const apiKey = typeof body.rh_api_key === "string" ? body.rh_api_key.trim() : "";
    const privKey = typeof body.rh_private_key_b64 === "string" ? body.rh_private_key_b64.trim() : "";

    if (!apiKey || !privKey) {
      return NextResponse.json(
        { ok: false, error: "rh_api_key and rh_private_key_b64 required for capability=crypto" },
        { status: 400 }
      );
    }

    // PROBE — keys used here and discarded, never written to disk
    const result = await probeCrypto(apiKey, privKey);

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, capability: "crypto", verified: false, error: result.error },
        { status: 400 }
      );
    }

    getDb()
      .prepare("UPDATE agents SET has_crypto = 1, buying_power_usd = ?, capability_proof = ? WHERE id = ?")
      .run(result.buying_power_usd, result.proof_type, agent.id);
    return NextResponse.json({
      ok: true,
      capability: "crypto",
      verified: true,
      proof_type: result.proof_type,
      buying_power_band: formatBuyingPowerPublic(result.buying_power_usd),
      message: "Crypto verified. Keys were not stored.",
    });

  } else {
    return NextResponse.json(
      { ok: false, error: "capability must be 'agentic' or 'crypto'" },
      { status: 400 }
    );
  }
}
