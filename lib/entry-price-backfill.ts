/**
 * Backfill entry prices for theses written before price capture existed.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Why this is legitimate, and where the line is
 *
 * `entry_price_usd` is normally snapshotted at post time. Capture only started
 * existing on 2026-08-08, so every research post before that has none — which
 * means no chart marker, no track record, and nothing for the impact scorer to
 * work with. On a site whose whole premise is that research gets scored, the
 * entire back catalogue of research is unscored.
 *
 * For a THESIS, "entry price" means nothing more than "what the asset cost when
 * they said it". That is a matter of public record — it is in the OHLC history —
 * so reading it back is a lookup, not an invention.
 *
 * For a TRADE it would be an invention. A fill is a specific execution at a
 * specific price with slippage, and no candle can tell you what someone
 * actually paid. So trade posts are never backfilled here; they either carry
 * their real fill price or they carry nothing.
 *
 * Every backfilled row is written with `entry_price_source = 'backfill_ohlc'`,
 * so a reconstructed entry can always be told apart from one captured live.
 * That distinction has to survive, because a backfill is an estimate of the
 * bucket the post landed in, not a tick-accurate quote.
 */

import { getDb } from "@/lib/db";
import { getChainTickerMeta } from "@/lib/chain-tokens";
import { rwaTokenFor } from "@/lib/rwa-tokens";
import { candlesForContract, type ChartInterval } from "@/lib/channel-chart";

export const BACKFILL_SOURCE = "backfill_ohlc";

export interface BackfillResult {
  post_id: string;
  symbol: string;
  at: string;
  status: "filled" | "skipped" | "failed";
  price_usd?: number;
  reason?: string;
}

export interface BackfillSummary {
  scanned: number;
  filled: number;
  skipped: number;
  failed: number;
  dry_run: boolean;
  results: BackfillResult[];
}

interface Candidate {
  id: string;
  symbol: string;
  product: string | null;
  type: string;
  created_at: string;
}

/** SQLite writes UTC without a marker; JS would read that as local time. */
function asUtcMs(raw: string): number {
  const s = raw.trim().replace(" ", "T");
  return new Date(/(?:Z|[+-]\d{2}:?\d{2})$/.test(s) ? s : `${s}Z`).getTime();
}

/**
 * The candle covering a moment.
 *
 * Hourly buckets first, because a thesis is a view held over hours or days and
 * the hourly close is the honest resolution for one. Falls back to daily for
 * older posts, since GeckoTerminal's hourly history does not run forever.
 *
 * A bucket is only accepted if the post actually falls inside it — never the
 * "nearest" candle. Grabbing the closest bar to a post from three days earlier
 * would silently attribute a price the author never saw, which is exactly the
 * kind of quiet fabrication this module exists to avoid.
 */
async function priceAtMoment(
  contract: string,
  atMs: number,
): Promise<{ price: number; interval: ChartInterval } | null> {
  const intervals: { interval: ChartInterval; widthMs: number }[] = [
    { interval: "hour", widthMs: 3600_000 },
    { interval: "day", widthMs: 86_400_000 },
  ];

  for (const { interval, widthMs } of intervals) {
    const candles = await candlesForContract(contract, interval, 1000);
    if (!candles.length) continue;

    for (const c of candles) {
      const start = new Date(c.t).getTime();
      if (atMs >= start && atMs < start + widthMs) {
        // Close of the bucket the post landed in.
        if (Number.isFinite(c.c) && c.c > 0) return { price: c.c, interval };
      }
    }
  }
  return null;
}

function contractFor(symbol: string, product: string | null): string | null {
  if (product === "chain" || product == null) {
    const meta = getChainTickerMeta(symbol);
    if (meta?.contract) return meta.contract;
  }
  return null;
}

/**
 * Find and fill missing entry prices.
 *
 * Dry-run by default — this writes to historical rows, and a bad backfill would
 * quietly rewrite everyone's track record.
 */
export async function backfillEntryPrices(
  opts: { dryRun?: boolean; limit?: number; symbol?: string } = {},
): Promise<BackfillSummary> {
  const dryRun = opts.dryRun ?? true;
  const limit = Math.min(Math.max(opts.limit ?? 200, 1), 2000);
  const db = getDb();

  // Research only. Trade fills are excluded on purpose — see the header.
  const rows = db
    .prepare(
      `SELECT id, symbol, product, type, created_at
         FROM posts
        WHERE entry_price_usd IS NULL
          AND symbol IS NOT NULL
          AND parent_id IS NULL
          AND type NOT IN ('trade_fill', 'trade_intent')
          ${opts.symbol ? "AND UPPER(symbol) = UPPER(@symbol)" : ""}
        ORDER BY created_at DESC
        LIMIT @limit`,
    )
    .all(opts.symbol ? { symbol: opts.symbol, limit } : { limit }) as Candidate[];

  const results: BackfillResult[] = [];
  let filled = 0;
  let skipped = 0;
  let failed = 0;

  const write = db.prepare(
    `UPDATE posts
        SET entry_price_usd = ?, entry_price_at = ?, entry_price_source = ?
      WHERE id = ? AND entry_price_usd IS NULL`,
  );

  for (const r of rows) {
    const base = { post_id: r.id, symbol: r.symbol, at: r.created_at };

    // An RWA-registry hit means the channel is a tokenised equity; chart the
    // token, matching how the channel chart resolves the same symbol.
    const rwa = await rwaTokenFor(r.symbol);
    const contract = rwa?.contract ?? contractFor(r.symbol, r.product);
    if (!contract) {
      results.push({ ...base, status: "skipped", reason: "no on-chain contract for this symbol" });
      skipped++;
      continue;
    }

    const atMs = asUtcMs(r.created_at);
    if (!Number.isFinite(atMs)) {
      results.push({ ...base, status: "failed", reason: "unparseable created_at" });
      failed++;
      continue;
    }

    try {
      const hit = await priceAtMoment(contract, atMs);
      if (!hit) {
        results.push({
          ...base,
          status: "skipped",
          reason: "no candle covers this timestamp — post predates available history",
        });
        skipped++;
        continue;
      }

      if (!dryRun) {
        write.run(String(hit.price), new Date(atMs).toISOString(), BACKFILL_SOURCE, r.id);
      }
      results.push({ ...base, status: "filled", price_usd: hit.price });
      filled++;
    } catch (e) {
      results.push({
        ...base,
        status: "failed",
        reason: e instanceof Error ? e.message.slice(0, 120) : "lookup failed",
      });
      failed++;
    }
  }

  return { scanned: rows.length, filled, skipped, failed, dry_run: dryRun, results };
}
