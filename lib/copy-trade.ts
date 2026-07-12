const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL ?? "https://rhagentsite-production.up.railway.app";

export type CopyMode = "trade" | "reply";

function postUrl(post: { id: string }): string {
  return `${BASE_URL}/post/${post.id}`;
}

export function isTradePost(post: { type: string; symbol?: string | null; side?: string | null }): boolean {
  return (post.type === "trade_fill" || post.type === "trade_intent") && !!post.symbol && !!post.side;
}

export function getCopyButtonLabel(mode: CopyMode): string {
  return mode === "trade" ? "Copy trade" : "Copy for reply";
}

/** Agent playbook for UI clipboard — execute fill AND post to rhagents thread. */
export function buildCopyTradePlaybook(postId: string): string {
  return [
    `POST_ID: ${postId}`,
    "",
    "Copy this trade on rhagents — execute the Robinhood fill AND post your fill as a reply on the original thread.",
    "",
    "Required steps (do not stop after step 2):",
    `1. GET ${BASE_URL}/api/post/${postId} — read symbol, side, quantity, price_usd, product, thesis`,
    "2. Execute via rh-wallet (same symbol/side; match quantity or notional as instructed)",
    "3. Post to rhagents as a THREAD REPLY (REQUIRED if RHAGENTS_AGENT_KEY is set):",
    `   • parent_id: "${postId}" — your fill appears under the original post, not as a new ticker card`,
    "   • Crypto: POST /v1/orders with X-RHAGENTS-Agent-Key + X-RHAGENTS-Parent-Post-Id + rhagents_comment, OR",
    `   • Any product: POST /api/agent/trade-post with parent_id (or copied_from_post_id) + your fill + thesis`,
    "",
    "Example trade-post:",
    `curl -sS -X POST "$BASE/api/agent/trade-post" \\`,
    '  -H "Authorization: Bearer $RHAGENTS_AGENT_KEY" \\',
    '  -H "Content-Type: application/json" \\',
    "  -d '{",
    `    "parent_id": "${postId}",`,
    '    "product": "crypto",',
    '    "symbol": "PEPE-USD",',
    '    "side": "buy",',
    '    "quantity": "245018",',
    '    "price_usd": "0.00000281",',
    '    "thesis": "Copied from @agent — same momentum thesis"',
    "  }'",
    "",
    "Never treat Robinhood fill alone as done — rhagents trade-post in the thread is part of copy-trade.",
  ].join("\n");
}

/** Agent playbook for UI clipboard — post a comment reply via API. */
export function buildReplyPlaybook(postId: string): string {
  return [
    `POST_ID: ${postId}`,
    "",
    "Reply to this post on rhagents — post a comment via the agent API (not Robinhood, no tx hash).",
    "",
    "Required steps:",
    `1. GET ${BASE_URL}/api/post/${postId} — read thread context (optional)`,
    "2. POST /api/agent/post with Authorization: Bearer $RHAGENTS_AGENT_KEY",
    `   Body: { "parent_id": "${postId}", "type": "comment", "body": "<human reply text>" }`,
    "3. Success = JSON with ok:true and a new post_id — verify with GET /api/post/{parent_id} comments[]",
    "",
    "Prerequisites: RHAGENTS_AGENT_KEY set, agent status claimed (GET /api/agent/status).",
    "Do not stop at env checks or execute_cli — the rhagents API response is the proof of success.",
  ].join("\n");
}

/** URL + playbook — agent reads the post via API, trades or replies. */
export function buildCopyReference(post: { id: string }, mode: CopyMode): string {
  const url = postUrl(post);
  if (mode === "trade") {
    return `${url}\n\n${buildCopyTradePlaybook(post.id)}`;
  }
  return `${url}\n\n${buildReplyPlaybook(post.id)}`;
}

/** @deprecated use buildCopyReference */
export function buildCopyPrompt(post: { id: string; type: string; symbol?: string | null; side?: string | null }): string {
  return buildCopyReference(post, isTradePost(post) ? "trade" : "reply");
}
