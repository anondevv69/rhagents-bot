import { NextRequest, NextResponse } from "next/server";
import { getViewerSession } from "@/lib/viewerSession";
import { viewerHasIdentity } from "@/lib/agent-identity";
import { resolveOwnedAgentForViewer } from "@/lib/viewer-agent";
import {
  BANKR_CLUB_MONTHLY_USD,
  fetchBaseUsdcBalance,
  fetchClubStatus,
  isWalletApiKey,
  mintKeyForProvisionedWallet,
  promptJoinClub,
} from "@/lib/bankr-club";
import { autoProvisionAgentWallet } from "@/lib/bankr-provision";
import { getDb, type Agent } from "@/lib/db";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * POST /api/viewer/bankr/pro/activate
 *
 * Activate rhagent Pro (Bankr Club membership) for the viewer's owned agent.
 *
 * Body (all optional):
 *   { bankr_api_key?: string }   — required only for externally linked wallets
 *
 * Steps:
 *   1. Ensure the agent has a managed wallet (auto-provision if missing).
 *   2. Obtain an ephemeral key (partner mint for provisioned wallets, or the
 *      caller-supplied bk_usr_* for linked terminal users). Never persisted.
 *   3. If already a member → done. Otherwise verify the $20 USDC deposit landed
 *      on Base, then ask the wallet's agent to join Club paying with USDC.
 *   4. Poll status briefly; Bankr executes asynchronously, so the client keeps
 *      polling GET /api/viewer/bankr/pro/status afterwards.
 */
export async function POST(req: NextRequest) {
  if (!rateLimit(`bankr-pro-activate:${clientIp(req)}`, 6, 15 * 60 * 1000)) {
    return rateLimitResponse();
  }

  const session = await getViewerSession();
  if (!session || !viewerHasIdentity(session)) {
    return NextResponse.json({ ok: false, error: "session_required" }, { status: 401 });
  }

  let agent = resolveOwnedAgentForViewer(session);
  if (!agent) {
    return NextResponse.json(
      { ok: false, error: "agent_required", message: "Connect or create an agent profile first." },
      { status: 400 },
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    /* empty body allowed */
  }
  const suppliedKey =
    typeof body.bankr_api_key === "string" && body.bankr_api_key.trim().startsWith("bk_")
      ? body.bankr_api_key.trim()
      : null;

  // 1. Managed wallet — provision one if the agent has none yet.
  if (!agent.bankr_wallet) {
    const prov = await autoProvisionAgentWallet(agent.id);
    if (!prov.attached && !prov.evm_address) {
      return NextResponse.json(
        { ok: false, error: prov.error ?? "provision_failed" },
        { status: 502 },
      );
    }
    agent = getDb().prepare(`SELECT * FROM agents WHERE id = ?`).get(agent.id) as Agent;
  }

  // 2. Ephemeral key.
  const key = suppliedKey && isWalletApiKey(suppliedKey)
    ? suppliedKey
    : await mintKeyForProvisionedWallet(agent);
  if (!key) {
    return NextResponse.json(
      {
        ok: false,
        error: "key_required",
        message:
          "This wallet was linked from an existing Bankr account — paste its bk_usr_ API key to activate Pro. The key is used once and never stored.",
      },
      { status: 400 },
    );
  }

  // 3. Already a member?
  const before = await fetchClubStatus(key);
  if (before?.member === true) {
    return NextResponse.json({ ok: true, state: "member", club: before });
  }

  // Deposit check — Club is paid from the wallet's own Base USDC.
  const usdc = await fetchBaseUsdcBalance(key);
  if (usdc != null && usdc < BANKR_CLUB_MONTHLY_USD) {
    return NextResponse.json({
      ok: false,
      error: "insufficient_funds",
      state: "needs_deposit",
      base_usdc: usdc,
      needed_usd: BANKR_CLUB_MONTHLY_USD,
      bankr_wallet: agent.bankr_wallet,
      message: `Deposit at least $${BANKR_CLUB_MONTHLY_USD} USDC on Base to your managed wallet first.`,
    });
  }

  // 4. Ask the wallet's agent to join Club.
  const join = await promptJoinClub(key);
  if (!join.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: "join_failed",
        state: "join_failed",
        status: join.status,
        message:
          join.reply ??
          "Bankr rejected the join request — the wallet may need LLM credits or the deposit hasn't settled yet.",
      },
      { status: 502 },
    );
  }

  // Brief poll — Bankr processes joins asynchronously.
  let club = before;
  for (let i = 0; i < 3; i++) {
    await new Promise((r) => setTimeout(r, 4000));
    const s = await fetchClubStatus(key);
    if (s) club = s;
    if (s?.member === true) break;
  }

  return NextResponse.json({
    ok: true,
    state: club?.member === true ? "member" : "pending",
    club,
    agent_reply: join.reply,
    message:
      club?.member === true
        ? "Pro is active — automations, env storage, and 1,000 messages/day unlocked."
        : "Join request submitted — membership usually activates within a minute. This page will keep checking.",
  });
}
