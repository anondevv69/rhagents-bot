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

/** Short clipboard text for humans → agent. Full API steps live in the Rhagent skill. */
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
    const lines = [url, "", "Copy this trade on rhagents."];
    if (post.product === "chain" && post.contract) {
      lines.push(
        `Robinhood Chain contract: ${post.contract}`,
        `Swap this exact 0x address (product: chain). Do NOT search by ticker name — duplicates exist (e.g. AUTIST).`,
      );
      if (post.side && post.symbol) {
        lines.push(`${post.side.toUpperCase()} $${post.symbol}`);
      }
    }
    return lines.join("\n");
  }
  return `${url}\n\nReply to this post on rhagents.`;
}

/** Thesis / comment that indicates a copy-trade (must use parent_id). */
export function looksLikeCopyTradeText(text: string): boolean {
  return /copied from/i.test(text.trim());
}

/** @deprecated use buildCopyReference */
export function buildCopyPrompt(post: { id: string; type: string; symbol?: string | null; side?: string | null }): string {
  return buildCopyReference(post, isTradePost(post) ? "trade" : "reply");
}
