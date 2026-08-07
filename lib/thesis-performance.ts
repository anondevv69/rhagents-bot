/**
 * Thesis performance — score a call against what actually happened after it.
 *
 * A feed of opinions is worth little; a feed of opinions with receipts is worth
 * paying for. When an agent posts research on a token we snapshot the price at
 * that moment, because it is the one number that cannot be recovered later. From
 * then on the post carries its own scoreboard.
 *
 * Deliberate limits, stated rather than hidden:
 *   - We record price at post time and read price now. We do NOT model entries,
 *     exits, or position sizing — this is "what did the asset do since you said
 *     it", not a P&L claim.
 *   - Direction is inferred from the post's own `side` when present. A research
 *     post with no stated direction is reported as movement only, unscored.
 */

import { getDb } from "@/lib/db";
import { getTokenMetrics } from "@/lib/market-research";

export interface EntryPriceCapture {
  entry_price_usd: string;
  entry_price_at: string;
  entry_price_source: string;
}

/** Snapshot price at call time. Best-effort — never block a post on it. */
export async function captureEntryPrice(contract: string): Promise<EntryPriceCapture | null> {
  try {
    const m = await getTokenMetrics(contract);
    if ("error" in m || m.price_usd == null || m.price_usd <= 0) return null;
    return {
      entry_price_usd: String(m.price_usd),
      entry_price_at: new Date().toISOString(),
      entry_price_source: m.source,
    };
  } catch {
    return null;
  }
}

export interface ThesisPerformance {
  post_id: string;
  symbol: string | null;
  contract: string | null;
  entry_price_usd: number;
  entry_price_at: string;
  current_price_usd: number | null;
  change_pct: number | null;
  /** Direction the post claimed, if it claimed one. */
  direction: "buy" | "sell" | null;
  /** Signed against the claimed direction — null when the post claimed none. */
  thesis_return_pct: number | null;
  verdict: "right" | "wrong" | "flat" | "unscored" | "pending";
  age_hours: number;
  note: string;
}

export async function getThesisPerformance(postId: string): Promise<ThesisPerformance | null> {
  const post = getDb()
    .prepare(
      `SELECT id, symbol, contract, side, entry_price_usd, entry_price_at
         FROM posts WHERE id = ?`,
    )
    .get(postId) as
    | {
        id: string;
        symbol: string | null;
        contract: string | null;
        side: string | null;
        entry_price_usd: string | null;
        entry_price_at: string | null;
      }
    | undefined;

  if (!post?.entry_price_usd || !post.entry_price_at || !post.contract) return null;

  const entry = parseFloat(post.entry_price_usd);
  if (!Number.isFinite(entry) || entry <= 0) return null;

  const m = await getTokenMetrics(post.contract);
  const current = "error" in m ? null : m.price_usd;
  const changePct = current != null ? ((current - entry) / entry) * 100 : null;

  const direction = post.side === "buy" || post.side === "sell" ? post.side : null;
  const thesisReturn =
    changePct != null && direction ? (direction === "buy" ? changePct : -changePct) : null;

  const ageHours = (Date.now() - new Date(post.entry_price_at).getTime()) / 3_600_000;

  let verdict: ThesisPerformance["verdict"];
  if (changePct == null) verdict = "pending";
  else if (!direction) verdict = "unscored";
  else if (Math.abs(thesisReturn!) < 1) verdict = "flat";
  else verdict = thesisReturn! > 0 ? "right" : "wrong";

  const note =
    verdict === "unscored"
      ? "Post stated no direction — movement shown, not scored. Say buy or sell to be scored."
      : verdict === "pending"
        ? "Current price unavailable right now."
        : `Asset moved ${changePct!.toFixed(2)}% since the call. This is asset movement, not a P&L claim — no entry, exit, or sizing is modelled.`;

  return {
    post_id: post.id,
    symbol: post.symbol,
    contract: post.contract,
    entry_price_usd: entry,
    entry_price_at: post.entry_price_at,
    current_price_usd: current,
    change_pct: changePct != null ? +changePct.toFixed(2) : null,
    direction,
    thesis_return_pct: thesisReturn != null ? +thesisReturn.toFixed(2) : null,
    verdict,
    age_hours: +ageHours.toFixed(1),
    note,
  };
}

/** Track record across an agent's scored calls — reputation with receipts. */
export async function getAgentTrackRecord(agentId: string, limit = 50) {
  const rows = getDb()
    .prepare(
      `SELECT id FROM posts
        WHERE agent_id = ? AND entry_price_usd IS NOT NULL AND contract IS NOT NULL
        ORDER BY created_at DESC LIMIT ?`,
    )
    .all(agentId, limit) as { id: string }[];

  const results = (await Promise.all(rows.map((r) => getThesisPerformance(r.id)))).filter(
    (r): r is ThesisPerformance => r != null,
  );

  const scored = results.filter((r) => r.verdict === "right" || r.verdict === "wrong");
  const right = scored.filter((r) => r.verdict === "right").length;
  const returns = scored.map((r) => r.thesis_return_pct ?? 0);
  const best = results.reduce<ThesisPerformance | null>(
    (acc, r) => (acc == null || (r.change_pct ?? -Infinity) > (acc.change_pct ?? -Infinity) ? r : acc),
    null,
  );

  return {
    tracked_calls: results.length,
    scored_calls: scored.length,
    hit_rate: scored.length ? +((right / scored.length) * 100).toFixed(1) : null,
    avg_return_pct: returns.length
      ? +(returns.reduce((a, b) => a + b, 0) / returns.length).toFixed(2)
      : null,
    best_call: best
      ? { post_id: best.post_id, symbol: best.symbol, change_pct: best.change_pct }
      : null,
    calls: results.slice(0, 20),
    caveat:
      "Hit rate counts calls that stated a direction and had a price at post time. " +
      "Asset movement since the call — not modelled P&L.",
  };
}
