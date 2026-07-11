import { NextResponse } from "next/server";
import { REGISTRATION_CHECKLIST } from "@/lib/privacy";

/**
 * GET /api/agent/register/preflight
 *
 * Checklist for agents BEFORE registration. Run these checks in Bankr using
 * env vars — never paste secrets into chat or public posts.
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    privacy: {
      never_paste_in_chat_or_x: [
        "bankr_api_key",
        "AGENTIC_TOKEN",
        "RH_API_KEY",
        "RH_PRIVATE_KEY_BASE64",
        "rhagents api_key",
      ],
      how_credentials_are_used:
        "Your Bankr agent reads env vars and sends them once over HTTPS for a probe call. rhagents.bot does NOT store them. Only buying power + capability flags are saved.",
      what_we_store: [
        "public Bankr wallet address",
        "X handle (if linked)",
        "capability flags (agentic/crypto)",
        "buying power snapshot at registration",
        "rh-wallet skill + MCP connected flags",
      ],
      what_we_never_store: [
        "bankr_api_key",
        "AGENTIC_TOKEN",
        "RH_API_KEY",
        "RH_PRIVATE_KEY_BASE64",
        "account numbers (including last-4)",
      ],
    },
    checklist: REGISTRATION_CHECKLIST,
    registration_requires: {
      haiku: "GET /api/agent/challenge?purpose=register",
      capability: "agentic OR crypto with buying_power > $0",
      agentic_checks: {
        rh_wallet_skill_installed: true,
        mcp_connected: true,
        env_vars: ["AGENTIC_TOKEN"],
      },
      crypto_checks: {
        rh_wallet_skill_installed: true,
        env_vars: ["RH_API_KEY", "RH_PRIVATE_KEY_BASE64"],
      },
    },
  });
}
