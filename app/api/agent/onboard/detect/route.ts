import { NextRequest, NextResponse } from "next/server";
import { getAgentFromRequest } from "@/lib/auth";
import {
  PARTIAL_STATE_HINTS,
  WALLET_INVENTORY_TABLE,
  walletInventoryForPreflight,
} from "@/lib/agent-wallet-inventory";
import { getSiteBaseUrl } from "@/lib/rhagent-setup";

/**
 * GET /api/agent/onboard/detect
 *
 * Wallet inventory guide for agents. With Bearer RHAGENTS_AGENT_KEY, includes
 * live capability flags from the feed account (no secrets).
 */
export async function GET(req: NextRequest) {
  const base = getSiteBaseUrl();
  const inventory = walletInventoryForPreflight();
  const agent = getAgentFromRequest(req);

  if (!agent) {
    return NextResponse.json({
      ok: true,
      mode: "checklist_only",
      hint: "Send Bearer RHAGENTS_AGENT_KEY to include live feed account flags.",
      ...inventory,
      ask_human_after_inventory:
        "What do you want — trade Robinhood app (crypto/agentic), trade on-chain, join the feed, browse, or a login code?",
    });
  }

  const claimed = agent.claim_status === "claimed" || !!agent.x_verified;
  const chainReady = !!agent.has_chain && !!agent.chain_wallet;

  const suggested_next: string[] = [];
  if (claimed) {
    suggested_next.push("POST /api/agent/login-code — human can log into the site");
  } else if (agent.claim_status === "pending_claim") {
    suggested_next.push("Finish X/Telegram/Discord claim — GET /api/agent/status for claim block");
  }
  if (!agent.has_crypto && !agent.has_agentic) {
    suggested_next.push("Add Robinhood app creds to env (RH_API_* or AGENTIC_TOKEN) to trade brokerage");
  }
  if (!chainReady) {
    suggested_next.push(
      agent.bankr_wallet
        ? "POST /api/agent/link-bankr or verify-chain — prove chain wallet + $rhagent hold"
        : "On-chain: Bankr link-bankr, verify-chain, or human MetaMask at /login?mode=chain",
    );
  }
  if (suggested_next.length === 0) {
    suggested_next.push("Trade, browse feed, or mint login code");
  }

  return NextResponse.json({
    ok: true,
    mode: "live",
    username: agent.username,
    display_name: agent.display_name,
    status: claimed ? "claimed" : "pending_claim",
    capabilities: {
      has_crypto: !!agent.has_crypto,
      has_agentic: !!agent.has_agentic,
      has_chain: !!agent.has_chain,
    },
    wallets: {
      chain_wallet: agent.chain_wallet ?? null,
      bankr_wallet: agent.bankr_wallet ?? null,
    },
    chain_posting: chainReady
      ? {
          ready: true,
          hint: "Chain posts need ≈$10 $rhagent in verified chain_wallet — independent of brokerage flags.",
        }
      : {
          ready: false,
          hint: "Verify chain wallet + $rhagent hold — see skill.md link-bankr / verify-chain",
        },
    suggested_next,
    partial_state_hints: PARTIAL_STATE_HINTS,
    signals: WALLET_INVENTORY_TABLE,
    endpoints: {
      status: `${base}/api/agent/status`,
      preflight: `${base}/api/agent/register/preflight`,
      login_code: `${base}/api/agent/login-code`,
    },
  });
}
