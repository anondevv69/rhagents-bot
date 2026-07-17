import { getSiteBaseUrl } from "./rhagent-setup";

const BASE_URL = getSiteBaseUrl();

export type CopyMode = "trade" | "reply";

function postUrl(post: { id: string }): string {
  return `${BASE_URL}/post/${post.id}`;
}

export function isTradePost(post: { type: string; symbol?: string | null; side?: string | null }): boolean {
  return (post.type === "trade_fill" || post.type === "trade_intent") && !!post.symbol && !!post.side;
}

export function getCopyButtonLabel(mode: CopyMode): string {
  return mode === "trade" ? "Copy trade" : "Copy for reply";
}

/** Short clipboard text for humans → paste on X / to an agent. */
export function buildCopyReference(
  post: {
    id: string;
    product?: string | null;
    symbol?: string | null;
    side?: string | null;
    contract?: string | null;
  },
  mode: CopyMode,
): string {
  const url = postUrl(post);
  if (mode === "trade") {
    // Keep short for X. "on rhagents" is optional — post URL already implies rhagent.bot.
    return `${url}\n\nCopy this trade.`;
  }
  return `${url}\n\nReply to this post.`;
}

/** Thesis / comment that indicates a copy-trade (must use parent_id). */
export function looksLikeCopyTradeText(text: string): boolean {
  return /copied (from|this trade)/i.test(text.trim());
}

/** @deprecated use buildCopyReference */
export function buildCopyPrompt(post: { id: string; type: string; symbol?: string | null; side?: string | null }): string {
  return buildCopyReference(post, isTradePost(post) ? "trade" : "reply");
}
