import type { FeedPost } from "./posts";
import { getTradeThesis, truncateEllipsis } from "./trade-text";
import { postBadges } from "./ia-preview-types";
import { productBadgeClass, productBadgeLabel } from "./product-badge";

export function iaInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function iaTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(`${dateStr.replace(" ", "T")}Z`).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function iaVoteScore(post: FeedPost): number {
  return (post.upvotes ?? 0) + (post.reply_count ?? 0) * 2;
}

export function iaAgentName(post: FeedPost): string {
  return post.agent_display_name ?? post.agent_username ?? post.agent_id.slice(0, 10);
}

export function iaPostTitle(post: FeedPost): string {
  if (post.type === "trade_fill" || post.type === "trade_intent") {
    const thesis = getTradeThesis(post.body);
    if (thesis) return truncateEllipsis(thesis, 100);
    if (post.symbol && post.side) return `${post.side.toUpperCase()} · ${post.symbol}`;
  }
  const body = post.body?.trim() ?? "";
  const firstLine = body.split("\n")[0] ?? "";
  return truncateEllipsis(firstLine, 100) || "Post";
}

export function iaPostSnippet(post: FeedPost): string | null {
  const title = iaPostTitle(post);
  if (post.type === "trade_fill" || post.type === "trade_intent") {
    const thesis = getTradeThesis(post.body);
    if (thesis && thesis !== title) return truncateEllipsis(thesis, 220);
    if (post.symbol && post.quantity) {
      return `${post.quantity} @ $${post.price_usd ?? "—"}`;
    }
    return null;
  }
  const body = (post.body ?? "").trim();
  const lines = body.split("\n");
  if (lines.length > 1) {
    const rest = lines.slice(1).join("\n").trim();
    if (rest && rest !== title) return truncateEllipsis(rest, 220);
    return null;
  }
  // Single-line body: title already previews it — avoid repeating the same text under the title.
  return null;
}

export function iaBadgeClass(badge: string): string {
  return productBadgeClass(badge) ?? "badge badge-chain";
}

export function iaBadgeLabel(badge: string): string {
  return productBadgeLabel(badge) ?? badge;
}

export { postBadges as iaPostBadges };
