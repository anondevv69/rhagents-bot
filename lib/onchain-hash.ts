import { keccak256, stringToBytes } from "viem";
import type { Post } from "@/lib/db";

const BODY_BLOCKLIST = [
  /••••/,
  /rh-api-/i,
  /Bearer\s/i,
  /AGENTIC_TOKEN/i,
  /RH_API_KEY/i,
  /** Phone/account digits only (10–12) — not ERC-20 wei fractions (often 18 digits). */
  /\b\d{10,12}\b/,
];

export function bodyLooksUnsafe(body: string | null | undefined): boolean {
  if (!body) return false;
  return BODY_BLOCKLIST.some((re) => re.test(body));
}

/** Canonical JSON for contentHash — keys alphabetical, omit null/empty. */
export function buildPostCanonicalJson(
  post: Post,
  username: string,
): Record<string, string> {
  const out: Record<string, string> = {};
  const put = (k: string, v: string | null | undefined) => {
    if (v == null) return;
    const s = String(v).trim();
    if (!s) return;
    out[k] = s;
  };

  put("body", post.body);
  put("created_at", post.created_at);
  put("parent_id", post.parent_id);
  put("post_id", post.id);
  put("price_usd", post.price_usd);
  put("product", post.product);
  put("quantity", post.quantity);
  put("side", post.side);
  put("symbol", post.symbol);
  put("type", post.type);
  put("username", username);
  put("via", post.via);

  return Object.keys(out)
    .sort()
    .reduce<Record<string, string>>((acc, k) => {
      acc[k] = out[k];
      return acc;
    }, {});
}

export function contentHashForPost(post: Post, username: string): `0x${string}` {
  const canonical = buildPostCanonicalJson(post, username);
  const json = JSON.stringify(canonical);
  return keccak256(stringToBytes(json));
}

/**
 * Body string written to RhagentPostJournal.journalPost — Blockscout-visible.
 * Trades get a leading BUY/SELL (and symbol/qty). Prefer the dedicated `action`
 * field for bagwork scrapers (journalActionForPost).
 */
export function journalBodyWithAction(post: Post): string {
  const thesis = (post.body ?? "").trim();
  const isTrade = post.type === "trade_fill" || post.type === "trade_intent";
  if (!isTrade) return thesis;

  const side = (post.side ?? "").trim().toLowerCase();
  const action = side === "buy" ? "BUY" : side === "sell" ? "SELL" : "TRADE";
  const parts: string[] = [action];
  const symbol = (post.symbol ?? "").trim();
  if (symbol) parts.push(symbol);
  if (post.product?.trim()) parts.push(`product=${post.product.trim()}`);
  if (post.quantity?.trim()) parts.push(`qty=${post.quantity.trim()}`);
  if (post.price_usd?.trim()) parts.push(`price_usd=${post.price_usd.trim()}`);

  const head = parts.join(" ");
  return thesis ? `${head} | ${thesis}` : head;
}

/** Dedicated on-chain action string for scrapers: "buy" | "sell" | "post" | "". */
export function journalActionForPost(post: Post): string {
  if (post.type === "trade_fill" || post.type === "trade_intent") {
    const side = (post.side ?? "").trim().toLowerCase();
    if (side === "buy" || side === "sell") return side;
    return "trade";
  }
  if (post.type === "research" || post.type === "comment" || post.type === "general") {
    return "post";
  }
  return "";
}


