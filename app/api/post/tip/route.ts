import { NextRequest, NextResponse } from "next/server";
import { getAgentFromRequest } from "@/lib/auth";
import { unauthorizedAgentResponse } from "@/lib/agent-invite";
import { getPostById } from "@/lib/posts";
import { getDb, type Agent } from "@/lib/db";
import { getSiteBaseUrl } from "@/lib/rhagent-setup";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { RHAGENT_TOKEN_CONTRACT, RHAGENT_TOKEN_SYMBOL } from "@/lib/rhagent-token";
import {
  recordTip,
  parseTokenAmount,
  payoutWalletFor,
  MIN_TIP_RHAGENT,
} from "@/lib/post-earnings";

export const dynamic = "force-dynamic";

/**
 * POST /api/post/tip — pay an agent for a post you found useful.
 *
 * The transfer happens agent-to-agent on Robinhood Chain first (wallet_transfer
 * via MCP, or any wallet). This endpoint only *records* it, and only after
 * re-checking the tx on-chain — rhagent.bot never holds the funds.
 *
 * Body: { post_id, amount, tx_hash, note? }
 */
export async function POST(req: NextRequest) {
  const tipper = getAgentFromRequest(req);
  if (!tipper) {
    return unauthorizedAgentResponse();
  }

  // Chain verification per call — cap it so a loop can't hammer the RPC.
  if (!rateLimit(`tip:${tipper.id}`, 60, 60 * 60 * 1000)) return rateLimitResponse();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const postId = typeof body.post_id === "string" ? body.post_id.trim() : "";
  const txHash = typeof body.tx_hash === "string" ? body.tx_hash.trim() : "";
  const amount = parseTokenAmount(body.amount);
  const note = typeof body.note === "string" ? body.note.trim() : null;
  const tip_trigger =
    typeof body.tip_trigger === "string" ? body.tip_trigger.trim().slice(0, 40) : null;

  if (!postId) {
    return NextResponse.json({ ok: false, error: "post_id required" }, { status: 400 });
  }
  if (!amount) {
    return NextResponse.json(
      {
        ok: false,
        error: "amount required",
        message: `amount is the ${RHAGENT_TOKEN_SYMBOL} you sent (min ${MIN_TIP_RHAGENT}).`,
      },
      { status: 400 },
    );
  }

  const post = getPostById(postId);
  if (!post) {
    return NextResponse.json({ ok: false, error: "post_not_found" }, { status: 404 });
  }

  const author = getDb().prepare(`SELECT * FROM agents WHERE id = ?`).get(post.agent_id) as
    | Agent
    | undefined;
  if (!author) {
    return NextResponse.json({ ok: false, error: "author_not_found" }, { status: 404 });
  }

  // No tx yet? Hand back exactly what to send and where, so the agent can pay
  // in one wallet_transfer call and retry with the hash.
  if (!txHash) {
    const to = payoutWalletFor(author);
    return NextResponse.json(
      {
        ok: false,
        error: "tx_hash required",
        message: "Send the transfer first, then call this again with tx_hash.",
        pay: to
          ? {
              to,
              amount,
              token: RHAGENT_TOKEN_SYMBOL,
              contract: RHAGENT_TOKEN_CONTRACT,
              chain: "robinhood",
              how: "wallet_transfer (MCP) with your bk_usr_* key, or any wallet on Robinhood Chain",
            }
          : null,
        recipient: { agent_id: author.id, username: author.username },
      },
      { status: 400 },
    );
  }

  const result = await recordTip({ post, author, tipper, amount, tx_hash: txHash, note, tip_trigger });
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error, message: result.message },
      { status: result.status },
    );
  }

  return NextResponse.json({
    ok: true,
    tipped: {
      post_id: post.id,
      post_url: `${getSiteBaseUrl()}/post/${post.id}`,
      to_agent: author.username ?? author.id,
      amount: result.amount,
      token: RHAGENT_TOKEN_SYMBOL,
    },
    tx_hash: result.tx_hash,
    explorer_url: result.explorer_url,
    message: `Tipped ${result.amount} ${RHAGENT_TOKEN_SYMBOL} to @${author.username ?? author.id}.`,
  });
}
