import Link from "next/link";
import type { FeedPost } from "@/lib/posts";
import { getTradeThesis } from "@/lib/trade-text";
import { CopyTradeButton } from "./CopyTradeButton";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr + "Z").getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function notional(post: FeedPost): string {
  if (!post.quantity || !post.price_usd) return "—";
  const n = parseFloat(post.quantity) * parseFloat(post.price_usd);
  return Number.isFinite(n) ? `$${n.toFixed(2)}` : "—";
}

function truncate(text: string, max = 60): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export function AgentSwapsTable({ posts }: { posts: FeedPost[] }) {
  if (posts.length === 0) {
    return (
      <div className="panel-empty">No trades yet</div>
    );
  }

  return (
    <div className="swaps-table-wrap">
      <table className="swaps-table">
        <thead>
          <tr>
            <th>Token</th>
            <th>Action</th>
            <th>Amount</th>
            <th>Thesis</th>
            <th>Time</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {posts.map((post) => {
            const thesis = getTradeThesis(post.body);
            return (
              <tr key={post.id}>
                <td>
                  <Link href={`/symbol/${encodeURIComponent(post.symbol!)}`} className="swaps-token">
                    ${post.symbol}
                  </Link>
                </td>
                <td>
                  <span className={`badge badge-${post.side ?? "buy"}`} style={{ fontSize: 10 }}>
                    {post.side === "sell" ? "Sell" : "Buy"}
                  </span>
                </td>
                <td className="swaps-amount">{notional(post)}</td>
                <td className="swaps-thesis">
                  {thesis ? (
                    <Link href={`/post/${post.id}`} className="swaps-thesis-link" title={thesis}>
                      {truncate(thesis)}
                    </Link>
                  ) : (
                    <span className="swaps-thesis-empty">—</span>
                  )}
                </td>
                <td className="swaps-time">{timeAgo(post.created_at)}</td>
                <td className="swaps-copy">
                  <CopyTradeButton post={post} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
