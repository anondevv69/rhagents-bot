import { getTradeThesis, type CopyablePost } from "./trade-text";

const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL ?? "https://rhagentsite-production.up.railway.app";

export type CopyMode = "trade" | "reply";

function agentName(post: CopyablePost): string {
  return post.agent_display_name ?? post.agent_x_handle ?? post.agent_id.slice(0, 12);
}

function smartNotional(quantity: string | null | undefined, price: string | null | undefined): string | null {
  if (!quantity || !price) return null;
  const n = parseFloat(quantity) * parseFloat(price);
  return Number.isFinite(n) && n > 0 ? `$${n.toFixed(2)}` : null;
}

export function getCopyMode(post: CopyablePost): CopyMode {
  const isTrade = post.type === "trade_fill" || post.type === "trade_intent";
  return isTrade && post.symbol && post.side ? "trade" : "reply";
}

export function getCopyButtonLabel(post: CopyablePost): string {
  return getCopyMode(post) === "trade" ? "Copy trade" : "Copy reply";
}

/** Small label above the reference line — matches reply style */
export function getCopyBoxLabel(post: CopyablePost): string {
  return getCopyMode(post) === "trade" ? "Reference trade" : "Reference reply";
}

/**
 * Short paste reference for humans → optional paste to agent.
 * Agents should read posts via GET /api/feed and GET /api/post/{id} instead.
 */
export function buildCopyPrompt(post: CopyablePost): string {
  const name = agentName(post);
  const postUrl = `${BASE_URL}/post/${post.id}`;

  if (getCopyMode(post) === "trade") {
    const action = post.side === "buy" ? "buy" : "sell";
    const notional = smartNotional(post.quantity, post.price_usd);
    const thesis = getTradeThesis(post.body);

    let line = `Same trade on rhagents: ${action} ${post.symbol}`;
    if (notional) line += ` ~${notional}`;
    line += ` (${name})`;

    if (thesis) line += `\nThesis: "${thesis}"`;

    return `${line}\n${postUrl}`;
  }

  return `Reply on rhagents to ${name}:\n\n"${post.body}"\n\n${postUrl}`;
}

/** @deprecated use buildCopyPrompt */
export function buildCopyTradePrompt(post: CopyablePost): string {
  return buildCopyPrompt(post);
}

/** @deprecated use buildCopyPrompt */
export function buildCopyTradeShort(post: CopyablePost): string {
  return buildCopyPrompt(post);
}

/** @deprecated use buildCopyPrompt */
export function buildCopyReplyPrompt(post: CopyablePost): string {
  return buildCopyPrompt(post);
}
