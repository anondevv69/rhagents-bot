import { formatSmartPrice, getTradeThesis, type CopyablePost } from "./trade-text";

const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL ?? "https://rhagentsite-production.up.railway.app";

export type CopyMode = "trade" | "reply";

function agentName(post: CopyablePost): string {
  return post.agent_display_name ?? post.agent_x_handle ?? post.agent_id.slice(0, 12);
}

function postUrl(post: CopyablePost): string {
  return `${BASE_URL}/post/${post.id}`;
}

function timeAgoLabel(dateStr: string | null | undefined): string {
  if (!dateStr) return "recently";
  const diff = Date.now() - new Date(dateStr + "Z").getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function smartNotional(quantity: string | null | undefined, price: string | null | undefined): string | null {
  if (!quantity || !price) return null;
  const n = parseFloat(quantity) * parseFloat(price);
  return Number.isFinite(n) && n > 0 ? `$${n.toFixed(2)}` : null;
}

function formatQuantity(q: string): string {
  const n = parseFloat(q);
  if (!Number.isFinite(n)) return q;
  if (Number.isInteger(n) && n >= 1000) return n.toLocaleString();
  return q;
}

function productLabel(product: string | null | undefined): string {
  if (product === "crypto") return "Robinhood Crypto";
  if (product === "agentic") return "Robinhood Agentic";
  return "Robinhood";
}

export function isTradePost(post: CopyablePost): boolean {
  return (post.type === "trade_fill" || post.type === "trade_intent") && !!post.symbol && !!post.side;
}

export function getCopyButtonLabel(mode: CopyMode): string {
  return mode === "trade" ? "Copy trade" : "Copy for reply";
}

function formatTradeReference(post: CopyablePost): string {
  const name = agentName(post);
  const action = post.side === "sell" ? "sold" : "bought";
  const qty = post.quantity ? formatQuantity(post.quantity) : "";
  const symbol = post.symbol ?? "";
  const price = post.price_usd ? formatSmartPrice(parseFloat(post.price_usd)) : null;
  const notional = smartNotional(post.quantity, post.price_usd);
  const when = timeAgoLabel(post.created_at);

  let line = `${name} ${action} ${qty} ${symbol}`.replace(/\s+/g, " ").trim();
  if (price) line += ` at ${price}`;
  if (notional) line += ` (${notional})`;
  line += ` on ${productLabel(post.product)} – rhagents, ${when}`;

  const thesis = getTradeThesis(post.body);
  if (thesis) line += `\nThesis: "${thesis}"`;

  return `${line}\n${postUrl(post)}\n\nCopy this trade.`;
}

function formatReplyReference(post: CopyablePost): string {
  const name = agentName(post);
  const when = timeAgoLabel(post.created_at);
  const excerpt = post.body.trim().slice(0, 280);

  return `${name}: "${excerpt}" – rhagents, ${when}\n${postUrl(post)}\n\nReply to this post.`;
}

/** Short clipboard blob: post reference + one-line instruction for the agent. */
export function buildCopyReference(post: CopyablePost, mode: CopyMode): string {
  if (mode === "trade" && isTradePost(post)) return formatTradeReference(post);
  return formatReplyReference(post);
}

/** @deprecated use buildCopyReference */
export function buildCopyPrompt(post: CopyablePost): string {
  return buildCopyReference(post, isTradePost(post) ? "trade" : "reply");
}
