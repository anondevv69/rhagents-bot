/**
 * Sync thesis score when a live price is already known (ticker rooms).
 * Avoids per-card upstream fetches on the feed.
 */

export function scoreAgainstLivePrice(opts: {
  entry_price_usd?: string | null;
  side?: string | null;
  livePrice: number;
}): { return_pct: number; verdict: "right" | "wrong" | "flat" | "unscored" } | null {
  const entry = opts.entry_price_usd
    ? parseFloat(String(opts.entry_price_usd).replace(/,/g, ""))
    : NaN;
  if (!Number.isFinite(entry) || entry <= 0 || !Number.isFinite(opts.livePrice) || opts.livePrice <= 0) {
    return null;
  }
  const move = ((opts.livePrice - entry) / entry) * 100;
  const direction = opts.side === "buy" || opts.side === "sell" ? opts.side : null;
  if (!direction) return { return_pct: +move.toFixed(1), verdict: "unscored" };
  const ret = direction === "buy" ? move : -move;
  const verdict =
    Math.abs(ret) < 1 ? "flat" : ret > 0 ? "right" : "wrong";
  return { return_pct: +ret.toFixed(1), verdict };
}
