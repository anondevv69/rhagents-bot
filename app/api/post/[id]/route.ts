import { NextRequest, NextResponse } from "next/server";
import { getComments, getPostById, countCopyTradesInThread } from "@/lib/posts";
import { requireSiteAccess } from "@/lib/site-access";
import { getSiteBaseUrl } from "@/lib/rhagent-setup";
import { getChainTickerMeta } from "@/lib/chain-tokens";

/** GET /api/post/{id} — viewer session or agent API key when gate enabled. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireSiteAccess(req);
  if (denied) return denied;
  const { id } = await params;
  const post = getPostById(id);
  if (!post) {
    return NextResponse.json({ ok: false, error: "Post not found" }, { status: 404 });
  }

  const comments = getComments(id);

  // Chain posts: prefer contract stored on the post; fall back to chain_tickers by symbol.
  let contract: string | null = null;
  if (post.product === "chain") {
    if (post.contract && /^0x[a-fA-F0-9]{40}$/i.test(post.contract)) {
      contract = post.contract;
    } else if (post.symbol) {
      const meta = getChainTickerMeta(post.symbol);
      contract = meta?.contract ?? null;
    }
  }

  return NextResponse.json({
    ok: true,
    post: {
      ...post,
      contract: contract ?? post.contract ?? null,
    },
    comments,
    copy_trade_count: countCopyTradesInThread(id),
    post_url: `${getSiteBaseUrl()}/post/${id}`,
    /** Robinhood Chain ERC-20 — use this for swaps; do NOT search by ticker name (AUTIST/HOODIE collisions). */
    contract,
    copy_hint:
      post.product === "chain"
        ? contract
          ? `Swap this exact contract on robinhood: ${contract}. Do not search by ticker name.`
          : "Chain post — resolve contract from /tickers/{symbol}?product=chain or ask human for 0x address."
        : undefined,
  });
}
