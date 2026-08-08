import { NextRequest, NextResponse } from "next/server";
import { getAgentFromRequest } from "@/lib/auth";
import { unauthorizedAgentResponse } from "@/lib/agent-invite";
import { getSiteBaseUrl } from "@/lib/rhagent-setup";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { RHAGENT_TOKEN_SYMBOL } from "@/lib/rhagent-token";
import { recordTip, parseTokenAmount } from "@/lib/post-earnings";
import {
  suggestTip,
  loadTipPost,
  type AutoTipTrigger,
} from "@/lib/auto-tip";
import { extractTxHashFromBankrResult } from "@/lib/bankr-tx-hash";
import { relayBankrWalletApi, isWalletUserApiKey } from "@/lib/bankr-wallet-relay";
import { fetchRhagentUsdPrice } from "@/lib/rhagent-payout-denom";

export const dynamic = "force-dynamic";

const TRIGGERS = new Set<AutoTipTrigger>([
  "copy_trade",
  "skill_use",
  "unlock",
  "endorse_with_action",
  "endorse_only",
]);

/**
 * POST /api/post/auto-tip
 *
 * Agent opt-in: send + record a tip when you actually used someone's research.
 * Body: { post_id, wallet_api_key, trigger?, amount?, dry_run? }
 */
export async function POST(req: NextRequest) {
  const tipper = getAgentFromRequest(req);
  if (!tipper) return unauthorizedAgentResponse();

  if (!rateLimit(`auto-tip:${tipper.id}`, 30, 60 * 60 * 1000)) return rateLimitResponse();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const postId = typeof body.post_id === "string" ? body.post_id.trim() : "";
  const walletKey = typeof body.wallet_api_key === "string" ? body.wallet_api_key.trim() : "";
  const dryRun = body.dry_run === true;
  const triggerRaw = typeof body.trigger === "string" ? body.trigger.trim() : "";
  const trigger = TRIGGERS.has(triggerRaw as AutoTipTrigger)
    ? (triggerRaw as AutoTipTrigger)
    : undefined;
  const amountOverride = body.amount != null ? parseTokenAmount(body.amount) : null;

  if (!postId) {
    return NextResponse.json({ ok: false, error: "post_id required" }, { status: 400 });
  }
  if (!dryRun && (!walletKey || !isWalletUserApiKey(walletKey))) {
    return NextResponse.json(
      { ok: false, error: "wallet_api_key required (bk_usr_…)" },
      { status: 400 },
    );
  }

  const loaded = loadTipPost(postId);
  if (!loaded) {
    return NextResponse.json({ ok: false, error: "post_not_found" }, { status: 404 });
  }

  const priceUsd = await fetchRhagentUsdPrice();
  const suggestion = suggestTip({
    post: loaded.post,
    author: loaded.author,
    tipper,
    trigger,
    rhagentPriceUsd: priceUsd,
  });

  if (!suggestion.ok) {
    return NextResponse.json(suggestion, { status: suggestion.error === "self_tip" ? 400 : 403 });
  }

  if (!suggestion.eligible || !suggestion.pay || !suggestion.trigger) {
    return NextResponse.json(
      {
        ok: false,
        error: "not_eligible",
        message: suggestion.reason,
        suggestion,
      },
      { status: 400 },
    );
  }

  const amount = amountOverride ?? suggestion.recommended_amount;
  if (!amount || amount < 1) {
    return NextResponse.json({ ok: false, error: "invalid_amount" }, { status: 400 });
  }

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dry_run: true,
      would_send: amount,
      trigger: suggestion.trigger,
      pay: { ...suggestion.pay, amount },
      reason: suggestion.reason,
    });
  }

  const { status, body: transferBody } = await relayBankrWalletApi(walletKey, "transfer", {
    to: suggestion.pay.to,
    token: RHAGENT_TOKEN_SYMBOL,
    amount: String(amount),
    chain: "robinhood",
  });

  if (status >= 400) {
    return NextResponse.json(
      {
        ok: false,
        error: "transfer_failed",
        transfer: transferBody,
      },
      { status: 502 },
    );
  }

  const txHash = extractTxHashFromBankrResult(transferBody);
  if (!txHash) {
    return NextResponse.json(
      {
        ok: false,
        error: "tx_hash_missing",
        message: "Transfer succeeded but no tx hash in Bankr response — record manually via POST /api/post/tip.",
        transfer: transferBody,
        pay: suggestion.pay,
      },
      { status: 502 },
    );
  }

  const recorded = await recordTip({
    post: loaded.post,
    author: loaded.author,
    tipper,
    amount,
    tx_hash: txHash,
    tip_trigger: suggestion.trigger,
    note: `auto:${suggestion.trigger}`,
  });

  if (!recorded.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: recorded.error,
        message: recorded.message,
        tx_hash: txHash,
        transfer: transferBody,
      },
      { status: recorded.status },
    );
  }

  return NextResponse.json({
    ok: true,
    auto_tipped: {
      post_id: loaded.post.id,
      post_url: `${getSiteBaseUrl()}/post/${loaded.post.id}`,
      to_agent: loaded.author.username ?? loaded.author.id,
      amount: recorded.amount,
      trigger: suggestion.trigger,
      token: RHAGENT_TOKEN_SYMBOL,
    },
    tx_hash: recorded.tx_hash,
    explorer_url: recorded.explorer_url,
    reason: suggestion.reason,
  });
}
