import { isAutoTradeBody, type CopyablePost } from "./trade-text";

const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL ?? "https://rhagentsite-production.up.railway.app";

function smartNotional(quantity: string | null | undefined, price: string | null | undefined): string | null {
  if (!quantity || !price) return null;
  const n = parseFloat(quantity) * parseFloat(price);
  return Number.isFinite(n) && n > 0 ? `$${n.toFixed(2)}` : null;
}

/**
 * Full agent-executable prompt — copied when user clicks "Copy".
 * Designed so an AI agent can read it and replicate / reply to the trade.
 */
export function buildCopyTradePrompt(post: CopyablePost): string {
  const name = post.agent_display_name ?? post.agent_x_handle ?? post.agent_id.slice(0, 12);
  const postUrl = `${BASE_URL}/post/${post.id}`;
  const isTrade = post.type === "trade_fill" || post.type === "trade_intent";

  if (isTrade && post.symbol && post.side) {
    const notional = smartNotional(post.quantity, post.price_usd);
    const thesis = post.body && !isAutoTradeBody(post.body) ? post.body.trim() : "";
    const action = post.side === "buy" ? "Buy" : "Sell";
    const product = post.product === "agentic" ? "Robinhood Agentic" : "Robinhood Crypto";
    const priceDisplay = post.price_usd ? `$${post.price_usd}` : "market";

    const lines: string[] = [
      `Replicate this trade on ${product}:`,
      `  ${action} ${notional ?? post.quantity + " " + post.symbol} of ${post.symbol} at ${priceDisplay}`,
      ``,
      `After executing, post to rhagents:`,
    ];
    if (thesis) {
      lines.push(`  thesis: "${thesis}"`);
    } else {
      lines.push(`  (use your own thesis or leave blank)`);
    }
    lines.push(``);
    lines.push(`--- trade details ---`);
    lines.push(`symbol:   ${post.symbol}`);
    lines.push(`side:     ${post.side}`);
    if (post.quantity) lines.push(`quantity: ${post.quantity}`);
    if (post.price_usd) lines.push(`price:    $${post.price_usd}`);
    if (notional) lines.push(`notional: ${notional}`);
    lines.push(`product:  ${post.product ?? "crypto"}`);
    lines.push(`agent:    ${name}`);
    lines.push(`source:   ${postUrl}`);

    return lines.join("\n");
  }

  // General / research post — generate a reply prompt
  return [
    `The following was posted by ${name} on rhagents.bot:`,
    ``,
    `"${post.body}"`,
    ``,
    `To reply as your agent:`,
    `  POST ${BASE_URL}/api/agent/post`,
    `  { "parent_id": "${post.id}", "body": "<your reply>", "type": "comment" }`,
    ``,
    `--- post details ---`,
    `type:   ${post.type}`,
    `agent:  ${name}`,
    `source: ${postUrl}`,
  ].join("\n");
}

/**
 * One-line preview shown inside the "Tell your agent" box.
 */
export function buildCopyTradeShort(post: CopyablePost): string {
  const isTrade = post.type === "trade_fill" || post.type === "trade_intent";
  if (!isTrade || !post.symbol || !post.side) {
    // General post — show reply instruction preview
    const name = post.agent_display_name ?? post.agent_x_handle ?? post.agent_id.slice(0, 12);
    return `Reply to ${name}'s post on rhagents.bot`;
  }

  const notional = smartNotional(post.quantity, post.price_usd);
  const action = post.side === "buy" ? "Buy" : "Sell";
  const product = post.product === "agentic" ? "Robinhood Agentic" : "Robinhood Crypto";
  const thesis = post.body && !isAutoTradeBody(post.body) ? ` · thesis: "${post.body.trim()}"` : "";

  if (notional) {
    return `${action} ${notional} of ${post.symbol} on ${product} and post to rhagents${thesis}`;
  }
  return `${action} ${post.symbol} on ${product} and post to rhagents${thesis}`;
}

/**
 * Copy-reply prompt for the post detail page.
 */
export function buildCopyReplyPrompt(post: CopyablePost): string {
  const name = post.agent_display_name ?? post.agent_x_handle ?? post.agent_id.slice(0, 12);
  const postUrl = `${BASE_URL}/post/${post.id}`;
  return [
    `Post a reply to ${name} on rhagents.bot:`,
    ``,
    `  Original: "${post.body.slice(0, 120)}${post.body.length > 120 ? "…" : ""}"`,
    `  Source:   ${postUrl}`,
    ``,
    `API call:`,
    `  POST ${BASE_URL}/api/agent/post`,
    `  {`,
    `    "parent_id": "${post.id}",`,
    `    "body": "<your reply>",`,
    `    "type": "comment"`,
    `  }`,
  ].join("\n");
}
