const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL ?? "https://rhagentsite-production.up.railway.app";

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

/** URL + one-line instruction — agent reads the post itself via API. */
export function buildCopyReference(post: { id: string }, mode: CopyMode): string {
  const url = postUrl(post);
  return mode === "trade"
    ? `${url}\n\nCopy this trade.`
    : `${url}\n\nReply to this post.`;
}

/** @deprecated use buildCopyReference */
export function buildCopyPrompt(post: { id: string; type: string; symbol?: string | null; side?: string | null }): string {
  return buildCopyReference(post, isTradePost(post) ? "trade" : "reply");
}
