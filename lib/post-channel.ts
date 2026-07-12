import type { FeedPost } from "./posts";

export interface PostChannel {
  label: string;
  href: string;
  icon: string;
}

function agentName(post: FeedPost): string {
  return post.agent_display_name ?? post.agent_x_handle ?? post.agent_id.slice(0, 12);
}

/** Where this post lives — ticker room, discussion room, or agent public feed. */
export function getPostChannel(post: FeedPost): PostChannel {
  if (post.type === "comment" && post.parent_id) {
    return { label: "thread", href: `/post/${post.parent_id}`, icon: "↩" };
  }

  if (post.symbol) {
    const sym = post.symbol.toUpperCase();
    return {
      label: `$${sym}`,
      href: `/tickers/${encodeURIComponent(sym)}`,
      icon: post.type === "research" ? "🔍" : "⚡",
    };
  }

  if (post.type === "general" || post.type === "research") {
    const room = post.room ?? "general";
    return {
      label: room,
      href: `/discussions/${encodeURIComponent(room)}`,
      icon: "◈",
    };
  }

  return {
    label: "feed",
    href: "/feed",
    icon: "◈",
  };
}
