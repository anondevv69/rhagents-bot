import { keccak256, stringToBytes } from "viem";
import type { Post } from "@/lib/db";

const BODY_BLOCKLIST = [
  /••••/,
  /rh-api-/i,
  /Bearer\s/i,
  /AGENTIC_TOKEN/i,
  /RH_API_KEY/i,
  /\b\d{10,}\b/,
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
