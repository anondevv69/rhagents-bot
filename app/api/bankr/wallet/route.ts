import { NextRequest, NextResponse } from "next/server";
import { getAgentFromRequest } from "@/lib/auth";
import { bridgeSecretOk } from "@/lib/telegram-bridge-auth";
import { rateLimit, clientIp, rateLimitResponse } from "@/lib/rate-limit";
import {
  isWalletUserApiKey,
  relayBankrWalletApi,
  type BankrWalletRelayAction,
} from "@/lib/bankr-wallet-relay";

export const dynamic = "force-dynamic";

const VALID_ACTIONS = new Set<BankrWalletRelayAction>([
  "portfolio",
  "swap_quote",
  "swap",
  "transfer",
  "sign",
  "submit",
]);

const WRITE_ACTIONS = new Set<BankrWalletRelayAction>(["swap", "transfer", "sign", "submit"]);

/**
 * POST /api/bankr/wallet
 *
 * Server-side passthrough to Bankr Wallet API so browser/MCP agents can swap, transfer,
 * sign, and submit without hitting CORS. Uses the caller's bk_usr_* key — rhagent never stores it.
 *
 * Auth: Bearer RHAGENTS_AGENT_KEY, bridge secret, or admin secret (same as /api/bankr/automation).
 *
 * Body:
 *   wallet_api_key: bk_usr_...
 *   action: portfolio | swap_quote | swap | transfer | sign | submit
 *   params: object forwarded to Bankr (swap legs, transfer to/amount, sign payload, etc.)
 */
export async function POST(req: NextRequest) {
  const bridge = bridgeSecretOk(req.headers.get("x-telegram-bridge-secret"));
  const adminSecret = req.headers.get("x-admin-secret");
  const adminOk = adminSecret && adminSecret === process.env.ADMIN_SECRET;
  const bearerAgent = bridge || adminOk ? null : getAgentFromRequest(req);

  if (!bridge && !adminOk && !bearerAgent) {
    return NextResponse.json(
      { ok: false, error: "unauthorized", message: "Bearer RHAGENTS_AGENT_KEY required." },
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
  if (!walletApiKey || !isWalletUserApiKey(walletApiKey)) {
    return NextResponse.json(
      { ok: false, error: "wallet_api_key required (bk_usr_...)" },
      { status: 400 },
    );
  }

  const actionRaw = typeof body.action === "string" ? body.action.trim() : "";
  if (!VALID_ACTIONS.has(actionRaw as BankrWalletRelayAction)) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_action",
        message: "action must be portfolio, swap_quote, swap, transfer, sign, or submit",
      },
      { status: 400 },
    );
  }
  const action = actionRaw as BankrWalletRelayAction;

  const params =
    body.params && typeof body.params === "object" && !Array.isArray(body.params)
      ? (body.params as Record<string, unknown>)
      : {};

  const rlWho = bearerAgent?.id ?? walletApiKey.slice(0, 16);
  if (!rateLimit(`bankr-wallet:${action}:${rlWho}`, WRITE_ACTIONS.has(action) ? 60 : 120, 60 * 60 * 1000)) {
    return rateLimitResponse();
  }
  if (!rateLimit(`bankr-wallet:ip:${clientIp(req)}`, 200, 60 * 60 * 1000)) {
    return rateLimitResponse();
  }

  try {
    const { status, body: bankrBody } = await relayBankrWalletApi(walletApiKey, action, params);
    return NextResponse.json({ ok: status < 400, action, result: bankrBody }, { status });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: "bankr_unreachable",
        message: err instanceof Error ? err.message : "request failed",
      },
      { status: 502 },
    );
  }
}
