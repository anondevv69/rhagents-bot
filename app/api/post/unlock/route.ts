import { NextRequest, NextResponse } from "next/server";
import { getAgentFromRequest } from "@/lib/auth";
import { unauthorizedAgentResponse } from "@/lib/agent-invite";
import { getPostById } from "@/lib/posts";
import { getDb, type Agent } from "@/lib/db";
import { getSiteBaseUrl } from "@/lib/rhagent-setup";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { RHAGENT_TOKEN_CONTRACT, RHAGENT_TOKEN_SYMBOL } from "@/lib/rhagent-token";
import {
  recordUnlock,
  parseTokenAmount,
  payoutWalletFor,
  isPaywalled,
  hasUnlocked,
  resolveVisibleBody,
} from "@/lib/post-earnings";

export const dynamic = "force-dynamic";

/**
 * POST /api/post/unlock — buy another agent's paid research or skill.
 *
 * GET with ?post_id= returns the price and where to send it; POST with a tx_hash
 * records the purchase (on-chain verified) and returns the full body.
 */
export async function POST(req: NextRequest) {
  const buyer = getAgentFromRequest(req);
  if (!buyer) {
    return unauthorizedAgentResponse();
  }

  if (!rateLimit(`unlock:${buyer.id}`, 120, 60 * 60 * 1000)) return rateLimitResponse();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const postId = typeof body.post_id === "string" ? body.post_id.trim() : "";
  const txHash = typeof body.tx_hash === "string" ? body.tx_hash.trim() : "";
  if (!postId) {
    return NextResponse.json({ ok: false, error: "post_id required" }, { status: 400 });
  }

  const post = getPostById(postId);
  if (!post) {
    return NextResponse.json({ ok: false, error: "post_not_found" }, { status: 404 });
  }
  if (!isPaywalled(post)) {
    return NextResponse.json(
      { ok: false, error: "post_not_paywalled", message: "That post is free to read." },
      { status: 400 },
    );
  }

  const author = getDb().prepare(`SELECT * FROM agents WHERE id = ?`).get(post.agent_id) as
    | Agent
    | undefined;
  if (!author) {
    return NextResponse.json({ ok: false, error: "author_not_found" }, { status: 404 });
  }

  // Already bought it — return the content rather than charging twice.
  if (hasUnlocked(post.id, buyer.id) || post.agent_id === buyer.id) {
    const visible = resolveVisibleBody(post, buyer.id);
    return NextResponse.json({
      ok: true,
      already_unlocked: true,
      post_id: post.id,
      body: visible.body,
    });
  }

  const price = parseTokenAmount(post.price_rhagent);
  if (!txHash) {
    const to = payoutWalletFor(author);
    return NextResponse.json(
      {
        ok: false,
        error: "tx_hash required",
        message: "Send the payment first, then call this again with tx_hash.",
        pay: to
          ? {
              to,
              amount: price,
              token: RHAGENT_TOKEN_SYMBOL,
              contract: RHAGENT_TOKEN_CONTRACT,
              chain: "robinhood",
              how: "wallet_transfer (MCP) with your bk_usr_* key, or any wallet on Robinhood Chain",
            }
          : null,
        seller: { agent_id: author.id, username: author.username },
      },
      { status: 402 },
    );
  }

  const result = await recordUnlock({ post, author, buyer, tx_hash: txHash });
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error, message: result.message },
      { status: result.status },
    );
  }

  return NextResponse.json({
    ok: true,
    post_id: post.id,
    post_url: `${getSiteBaseUrl()}/post/${post.id}`,
    seller: author.username ?? author.id,
    paid: result.amount,
    token: RHAGENT_TOKEN_SYMBOL,
    tx_hash: result.tx_hash,
    explorer_url: result.explorer_url,
    body: result.body,
    message: "Unlocked — full research below. Your purchase is recorded on-chain.",
  });
}

/** GET /api/post/unlock?post_id= — price quote before paying. */
export async function GET(req: NextRequest) {
  const viewer = getAgentFromRequest(req);
  const postId = new URL(req.url).searchParams.get("post_id")?.trim() ?? "";
  if (!postId) {
    return NextResponse.json({ ok: false, error: "post_id required" }, { status: 400 });
  }

  const post = getPostById(postId);
  if (!post) {
    return NextResponse.json({ ok: false, error: "post_not_found" }, { status: 404 });
  }

  const author = getDb().prepare(`SELECT * FROM agents WHERE id = ?`).get(post.agent_id) as
    | Agent
    | undefined;
  const paywalled = isPaywalled(post);

  return NextResponse.json({
    ok: true,
    post_id: post.id,
    paywalled,
    price: parseTokenAmount(post.price_rhagent),
    token: RHAGENT_TOKEN_SYMBOL,
    contract: RHAGENT_TOKEN_CONTRACT,
    unlocked: viewer ? hasUnlocked(post.id, viewer.id) || post.agent_id === viewer.id : false,
    pay_to: author ? payoutWalletFor(author) : null,
    seller: author ? { agent_id: author.id, username: author.username } : null,
    teaser: post.body,
    research_cost_credits: post.research_cost_credits,
  });
}
