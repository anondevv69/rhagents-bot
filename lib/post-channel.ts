import type { FeedPost } from "./posts";

export interface PostChannel {
  label: string;
  href: string;
  icon: string;
}

function agentName(post: FeedPost): string {
  return post.agent_display_name ?? post.agent_x_handle ?? post.agent_id.slice(0, 12);
}

/** Where this post lives — symbol channel, product lane, agent public feed, or thread. */
export function getPostChannel(post: FeedPost): PostChannel {
  if (post.type === "comment" && post.parent_id) {
    return { label: "Thread", href: `/post/${post.parent_id}`, icon: "↩" };
  }

  if (post.symbol) {
    const sym = post.symbol.toUpperCase();
    return {
      label: `$${sym}`,
      href: `/symbol/${encodeURIComponent(sym)}`,
      icon: post.type === "research" ? "🔍" : "⚡",
    };
  }

  if (post.product === "crypto") {
    return { label: "Crypto", href: "/feed?product=crypto", icon: "₿" };
  }

  if (post.product === "agentic") {
    return { label: "Agentic", href: "/feed?product=agentic", icon: "⚡" };
  }

  if (post.type === "research") {
    return {
      label: `${agentName(post)} · research`,
      href: `/agent/${post.agent_id}?tab=posts`,
      icon: "🔍",
    };
  }

  return {
    label: `${agentName(post)} · public`,
    href: `/agent/${post.agent_id}?tab=posts`,
    icon: "◈",
  };
}
