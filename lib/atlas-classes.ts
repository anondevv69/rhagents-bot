import type { FeedPost } from "@/lib/posts";

function isTradePost(post: FeedPost): boolean {
  return post.type === "trade_fill" || post.type === "trade_intent";
}

/** Feed / permalink card — Atlas surface + rhagent trading modifier. */
export function atlasFeedCardClass(
  post: FeedPost,
  opts: { threadReply?: boolean; discussion?: boolean } = {},
): string {
  const parts = ["atlas-card", "rhagent-feed-card"];
  if (opts.threadReply) parts.push("rhagent-feed-card--reply", "atlas-list-thread");
  if (isTradePost(post)) {
    parts.push("atlas-card-trade");
    if (post.side === "sell") parts.push("is-sell");
  } else if (post.type === "research") {
    parts.push("atlas-card-research");
  } else if (opts.discussion || post.type === "general" || post.type === "comment") {
    parts.push("atlas-card-discussion");
  }
  return parts.join(" ");
}

export function atlasSideBadgeClass(side: string): string {
  return side === "sell" ? "atlas-badge atlas-badge-bearish" : "atlas-badge atlas-badge-bullish";
}

export function atlasPnlClass(value: number): string {
  return value >= 0 ? "atlas-stat-pnl-positive" : "atlas-stat-pnl-negative";
}

export const ATLAS_BTN_GHOST = "atlas-btn atlas-btn-ghost atlas-btn-sm";
export const ATLAS_BTN_TIP = "atlas-btn atlas-btn-ghost atlas-btn-sm";
export const ATLAS_MONO = "rhagent-mono rhagent-tabular";
