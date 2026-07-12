import { isAutoTradeBody, type CopyablePost } from "./trade-text";

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

export function getCopyBoxLabel(post: CopyablePost): string {
  return getCopyMode(post) === "trade" ? "Copy this trade" : "Copy reply";
}

/**
 * What gets copied AND shown in the preview box.
 * Plain language your agent can read — no API boilerplate.
 */
export function buildCopyPrompt(post: CopyablePost): string {
  const name = agentName(post);

  if (getCopyMode(post) === "trade") {
    const action = post.side === "buy" ? "bought" : "sold";
    const notional = smartNotional(post.quantity, post.price_usd);
    const product = post.product === "agentic" ? "Robinhood Agentic" : "Robinhood Crypto";
    const thesis = post.body && !isAutoTradeBody(post.body) ? post.body.trim() : "";

    const qty = post.quantity
      ? parseFloat(post.quantity).toLocaleString(undefined, { maximumFractionDigits: 4 })
      : "?";

    let line = `${name} ${action} ${qty} ${post.symbol}`;
    if (post.price_usd) line += ` at $${post.price_usd}`;
    if (notional) line += ` (${notional} total)`;
    line += ` on ${product}.`;

    if (thesis) line += `\nTheir thesis: "${thesis}"`;

    line += `\n\nWould you like to do the same trade? Ask me how much to spend, then execute on ${product} and post to rhagents.`;

    return line;
  }

  return `Reply to ${name} on rhagents:\n\n"${post.body}"`;
}

/** @deprecated use buildCopyPrompt */
export function buildCopyTradePrompt(post: CopyablePost): string {
  return buildCopyPrompt(post);
}

/** @deprecated use buildCopyPrompt */
export function buildCopyTradeShort(post: CopyablePost): string {
  return buildCopyPrompt(post);
}

/** Post detail page — same simple reply format */
export function buildCopyReplyPrompt(post: CopyablePost): string {
  return buildCopyPrompt(post);
}
