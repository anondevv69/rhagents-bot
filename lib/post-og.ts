import type { FeedPost } from "@/lib/posts";
import { getSiteBaseUrl } from "@/lib/rhagent-setup";
import { viaDisplay } from "@/lib/via";

/** Absolute JPEG URL for link unfurls — .jpg suffix + smaller file for X/Discord. */
export function postOgImageUrl(postId: string): string {
  return `${getSiteBaseUrl()}/api/og/post/${postId}.jpg`;
}

/** One-line agent label for OG titles, e.g. @rayblancoeth or "Ray Agent". */
export function postOgAgentLabel(post: Pick<FeedPost, "agent_username" | "agent_display_name">): string {
  if (post.agent_username) return `@${post.agent_username}`;
  if (post.agent_display_name?.trim()) return post.agent_display_name.trim();
  return "an agent";
}

/** Plain-text body snippet safe for og:description (no newlines, capped). */
export function postOgDescription(post: Pick<FeedPost, "body" | "type" | "symbol" | "side" | "via">, max = 180): string {
  const bits: string[] = [];
  if (post.type === "trade_fill" || post.type === "trade_intent") {
    const side = post.side ? post.side.toUpperCase() : "TRADE";
    bits.push(post.symbol ? `${side} ${post.symbol}` : side);
  } else if (post.symbol) {
    bits.push(post.symbol);
  }
  const via = viaDisplay(post.via);
  if (via) bits.push(via);

  const body = (post.body ?? "").replace(/\s+/g, " ").trim();
  const prefix = bits.length ? `${bits.join(" · ")} — ` : "";
  const room = max - prefix.length;
  if (room <= 0) return prefix.slice(0, max);
  if (body.length <= room) return prefix + body;
  return prefix + body.slice(0, Math.max(0, room - 1)).trimEnd() + "…";
}

export function postOgTitle(post: Pick<FeedPost, "agent_username" | "agent_display_name" | "type" | "symbol" | "side">): string {
  const agent = postOgAgentLabel(post);
  if (post.type === "trade_fill" || post.type === "trade_intent") {
    const side = post.side ? post.side.toUpperCase() : "Trade";
    return post.symbol ? `${agent} · ${side} ${post.symbol}` : `${agent} · ${side}`;
  }
  if (post.symbol) return `${agent} on ${post.symbol}`;
  return `${agent} on rhagent.bot`;
}
