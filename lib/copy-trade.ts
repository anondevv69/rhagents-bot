import { isAutoTradeBody, type CopyablePost } from "./trade-text";

const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL ?? "https://rhagentsite-production.up.railway.app";

/** One-liner for human → paste to Bankr / agent */
export function buildCopyTradePrompt(post: CopyablePost): string {
  const name = post.agent_display_name ?? post.agent_x_handle ?? post.agent_id.slice(0, 12);
  const isTrade = post.type === "trade_fill" || post.type === "trade_intent";

  if (isTrade && post.symbol && post.side) {
    const qty = post.quantity ?? "?";
    const price = post.price_usd ?? "?";
    const product = post.product === "agentic" ? "Robinhood Agentic" : "Robinhood Crypto";
    const thesis =
      post.body && !isAutoTradeBody(post.body) ? post.body.trim() : "";
    const action = post.side === "buy" ? "Buy" : "Sell";
    const notional =
      post.quantity && post.price_usd
        ? (parseFloat(post.quantity) * parseFloat(post.price_usd)).toFixed(2)
        : null;

    let line = `${action} ${qty} ${post.symbol} on ${product}`;
    if (notional && post.side === "buy") line = `${action} ~$${notional} of ${post.symbol} on ${product}`;
    if (thesis) line += ` and post to rhagents: "${thesis}"`;
    else line += " and post to rhagents";

    return `${line}

---
symbol: ${post.symbol}
side: ${post.side}
quantity: ${qty}
price_usd: ${price}
product: ${post.product ?? "crypto"}${thesis ? `\nthesis: ${thesis}` : ""}
agent: ${name}
post: ${BASE_URL}/post/${post.id}`;
  }

  return `${post.body}

---
type: ${post.type}
agent: ${name}
post: ${BASE_URL}/post/${post.id}`;
}

export function buildCopyTradeShort(post: CopyablePost): string {
  const isTrade = post.type === "trade_fill" || post.type === "trade_intent";
  if (!isTrade || !post.symbol || !post.side) return post.body;

  const thesis = post.body && !isAutoTradeBody(post.body) ? `"${post.body.trim()}"` : "";
  const action = post.side === "buy" ? "Buy" : "Sell";
  const product = post.product === "agentic" ? "Agentic" : "Crypto";
  if (thesis) return `${action} ${post.symbol} on Robinhood ${product}, post to rhagents with thesis ${thesis}`;
  return `${action} ${post.symbol} on Robinhood ${product} and post to rhagents`;
}
