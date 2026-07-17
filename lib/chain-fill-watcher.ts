/**
 * Hard auto-post for Robinhood Chain fills.
 *
 * Polls Blockscout ERC-20 transfers for claimed agents with a verified
 * chain_wallet, detects buys/sells, and creates trade_fill posts without
 * an LLM in the loop. First poll per wallet only sets a baseline (no backfill).
 */

import { formatUnits, getAddress, isAddress } from "viem";
import { getDb, type Agent } from "@/lib/db";
import { createPost, stripSensitive } from "@/lib/posts";
import { resolveChainTicker, invalidateChainChannelCache, upsertChainTickerMeta } from "@/lib/chain-tokens";
import { resolveFillPricing } from "@/lib/trade-pricing";
import { checkRhagentHoldings } from "@/lib/rhagent-holdings";
import { RHAGENT_TOKEN_CONTRACT } from "@/lib/rhagent-token";
import { explorerTxUrl } from "@/lib/onchain-config";

const BLOCKSCOUT_API = "https://robinhoodchain.blockscout.com/api";
const LOOKBACK_PAGES = 2;
const PAGE_SIZE = 50;
/** Ignore transfers smaller than this (dust / spam). */
const MIN_NOTIONAL_USD = 0.05;

/** Quote / gas / gate tokens — never the traded meme asset. */
const QUOTE_SYMBOLS = new Set([
  "ETH",
  "WETH",
  "USDG",
  "USDC",
  "USDT",
  "DAI",
  "RHAGENT",
  "$RHAGENT",
]);

const SWAPISH =
  /swap|multicall|fillrelay|execute|handleops|universalrouter|transferandmulticall/i;

type BlockscoutTokenTx = {
  hash: string;
  timeStamp: string;
  from: string;
  to: string;
  value: string;
  tokenDecimal?: string;
  tokenSymbol?: string;
  contractAddress: string;
  functionName?: string;
};

export type WatcherRunResult = {
  ok: true;
  enabled: boolean;
  wallets: number;
  baselined: number;
  candidates: number;
  posted: number;
  skipped: number;
  failed: number;
  errors: string[];
};

function watcherEnabled(): boolean {
  const raw = (process.env.CHAIN_FILL_WATCHER_ENABLED ?? "1").trim().toLowerCase();
  return raw !== "0" && raw !== "false" && raw !== "off";
}

function isQuoteToken(symbol: string | undefined, contract: string): boolean {
  const sym = (symbol ?? "").trim().toUpperCase();
  if (QUOTE_SYMBOLS.has(sym)) return true;
  if (contract.toLowerCase() === RHAGENT_TOKEN_CONTRACT.toLowerCase()) return true;
  return false;
}

async function fetchTokenTxs(wallet: string): Promise<BlockscoutTokenTx[]> {
  const out: BlockscoutTokenTx[] = [];
  for (let page = 1; page <= LOOKBACK_PAGES; page++) {
    const url =
      `${BLOCKSCOUT_API}?module=account&action=tokentx` +
      `&address=${encodeURIComponent(wallet)}` +
      `&page=${page}&offset=${PAGE_SIZE}&sort=desc`;
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "rhagent-chain-fill-watcher/1.0" },
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`Blockscout HTTP ${res.status} for ${wallet.slice(0, 10)}…`);
    }
    const body = (await res.json()) as {
      status?: string;
      message?: string;
      result?: BlockscoutTokenTx[] | string;
    };
    const rows = Array.isArray(body.result) ? body.result : [];
    if (rows.length === 0) break;
    out.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }
  return out;
}

async function fetchTokenPriceUsd(contract: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${contract.toLowerCase()}`,
      { signal: AbortSignal.timeout(8000), cache: "no-store" },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      pairs?: { priceUsd?: string; chainId?: string; liquidity?: { usd?: number } }[];
    };
    const pairs = data.pairs ?? [];
    const ranked = [...pairs].sort(
      (a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0),
    );
    const rh = ranked.find((p) => /robinhood/i.test(String(p.chainId ?? "")));
    const pick = rh ?? ranked[0];
    const n = parseFloat(pick?.priceUsd ?? "");
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

type DetectedFill = {
  txHash: string;
  contract: `0x${string}`;
  side: "buy" | "sell";
  quantity: string;
  notionalUsd: number;
  tokenSymbol?: string;
  ts: number;
};

function detectFillsForWallet(
  wallet: string,
  transfers: BlockscoutTokenTx[],
  baselineTs: number,
): DetectedFill[] {
  const w = wallet.toLowerCase();
  const byHash = new Map<string, BlockscoutTokenTx[]>();
  for (const t of transfers) {
    const ts = Number(t.timeStamp);
    if (!Number.isFinite(ts) || ts <= baselineTs) continue;
    const list = byHash.get(t.hash) ?? [];
    list.push(t);
    byHash.set(t.hash, list);
  }

  const fills: DetectedFill[] = [];
  for (const [txHash, rows] of byHash) {
    const fn = rows[0]?.functionName ?? "";
    if (!SWAPISH.test(fn)) continue;

    // Prefer the largest non-quote transfer involving the wallet
    let best: {
      side: "buy" | "sell";
      contract: string;
      raw: bigint;
      decimals: number;
      symbol?: string;
      ts: number;
    } | null = null;

    for (const t of rows) {
      if (!isAddress(t.contractAddress)) continue;
      if (isQuoteToken(t.tokenSymbol, t.contractAddress)) continue;
      const from = t.from.toLowerCase();
      const to = t.to.toLowerCase();
      let side: "buy" | "sell" | null = null;
      if (to === w && from !== w) side = "buy";
      else if (from === w && to !== w) side = "sell";
      if (!side) continue;

      let raw: bigint;
      try {
        raw = BigInt(t.value || "0");
      } catch {
        continue;
      }
      if (raw <= BigInt(0)) continue;
      const decimals = Math.min(36, Math.max(0, parseInt(t.tokenDecimal || "18", 10) || 18));
      if (!best || raw > best.raw) {
        best = {
          side,
          contract: t.contractAddress,
          raw,
          decimals,
          symbol: t.tokenSymbol,
          ts: Number(t.timeStamp) || 0,
        };
      }
    }

    if (!best) continue;
    const qty = Number(formatUnits(best.raw, best.decimals));
    if (!Number.isFinite(qty) || qty <= 0) continue;

    fills.push({
      txHash,
      contract: getAddress(best.contract),
      side: best.side,
      quantity: String(qty),
      notionalUsd: 0, // filled after price lookup
      tokenSymbol: best.symbol,
      ts: best.ts,
    });
  }

  return fills;
}

function alreadyPostedSimilar(
  agentId: string,
  contract: string,
  side: string,
  quantity: string,
): string | null {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, quantity FROM posts
       WHERE agent_id = ?
         AND product = 'chain'
         AND type = 'trade_fill'
         AND side = ?
         AND LOWER(COALESCE(contract, '')) = LOWER(?)
         AND created_at > datetime('now', '-45 minutes')
       ORDER BY created_at DESC
       LIMIT 8`,
    )
    .all(agentId, side, contract) as { id: string; quantity: string | null }[];

  const q = parseFloat(quantity);
  if (!Number.isFinite(q) || q <= 0) return null;
  for (const row of rows) {
    const rq = parseFloat(row.quantity ?? "");
    if (!Number.isFinite(rq) || rq <= 0) continue;
    const rel = Math.abs(rq - q) / Math.max(q, rq);
    if (rel < 0.02) return row.id;
  }
  return null;
}

function markTx(
  agentId: string,
  txHash: string,
  status: string,
  detail: string | null,
  opts?: { contract?: string; side?: string; postId?: string },
) {
  getDb()
    .prepare(
      `INSERT INTO chain_fill_watched_txs (tx_hash, agent_id, contract, side, post_id, status, detail)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(tx_hash, agent_id) DO UPDATE SET
         status = excluded.status,
         detail = excluded.detail,
         post_id = COALESCE(excluded.post_id, chain_fill_watched_txs.post_id)`,
    )
    .run(
      txHash.toLowerCase(),
      agentId,
      opts?.contract ?? null,
      opts?.side ?? null,
      opts?.postId ?? null,
      status,
      detail,
    );
}

function txAlreadyHandled(agentId: string, txHash: string): boolean {
  const row = getDb()
    .prepare(
      `SELECT status FROM chain_fill_watched_txs WHERE agent_id = ? AND tx_hash = ?`,
    )
    .get(agentId, txHash.toLowerCase()) as { status: string } | undefined;
  return !!row;
}

async function postDetectedFill(
  agent: Agent,
  fill: DetectedFill,
): Promise<{ ok: true; postId: string } | { ok: false; error: string; skip?: boolean }> {
  const hold = await checkRhagentHoldings(agent.chain_wallet!);
  if (!hold.ok) {
    return { ok: false, error: hold.error, skip: true };
  }

  const price = await fetchTokenPriceUsd(fill.contract);
  if (price == null) {
    return { ok: false, error: "no_dex_price", skip: true };
  }
  const qty = parseFloat(fill.quantity);
  const notional = qty * price;
  if (!Number.isFinite(notional) || notional < MIN_NOTIONAL_USD) {
    return { ok: false, error: `below_min_notional_${notional}`, skip: true };
  }

  const pricing = resolveFillPricing({
    quantity: fill.quantity,
    notional_usd: String(notional),
  });
  if (!pricing.ok) {
    return { ok: false, error: pricing.error, skip: true };
  }

  const resolved = await resolveChainTicker(fill.contract);
  if ("error" in resolved || !("symbol" in resolved)) {
    return { ok: false, error: (resolved as { error: string }).error, skip: true };
  }

  const dup = alreadyPostedSimilar(agent.id, fill.contract, fill.side, pricing.quantity);
  if (dup) {
    return { ok: false, error: `duplicate_of_${dup}`, skip: true };
  }

  const body = stripSensitive(
    `${fill.side === "buy" ? "Bought" : "Sold"} ${pricing.quantity} ${resolved.symbol} at $${pricing.price_usd} via Robinhood Chain`,
  );

  const post = createPost({
    agent_id: agent.id,
    type: "trade_fill",
    product: "chain",
    symbol: resolved.symbol,
    side: fill.side,
    quantity: pricing.quantity,
    price_usd: pricing.price_usd,
    body,
    via: "chain_watcher",
    source_url: explorerTxUrl(fill.txHash),
    contract: resolved.contract ?? fill.contract,
  });

  if (resolved.contract) {
    upsertChainTickerMeta({
      symbol: resolved.symbol,
      contract: resolved.contract,
      name: resolved.name ?? null,
    });
  }
  invalidateChainChannelCache();

  return { ok: true, postId: post.id };
}

function listWatchTargets(): Agent[] {
  return getDb()
    .prepare(
      `SELECT * FROM agents
       WHERE has_chain = 1
         AND chain_wallet IS NOT NULL
         AND chain_wallet != ''
         AND (claim_status = 'claimed' OR x_verified = 1)
         AND haiku_verified = 1`,
    )
    .all() as Agent[];
}

function ensureBaseline(agent: Agent, nowTs: number): { baselineTs: number; created: boolean } {
  const db = getDb();
  const wallet = agent.chain_wallet!.toLowerCase();
  const existing = db
    .prepare(`SELECT baseline_ts FROM chain_fill_watch_state WHERE chain_wallet = ?`)
    .get(wallet) as { baseline_ts: number } | undefined;
  if (existing) {
    db.prepare(
      `UPDATE chain_fill_watch_state
       SET agent_id = ?, last_polled_at = datetime('now'), updated_at = datetime('now')
       WHERE chain_wallet = ?`,
    ).run(agent.id, wallet);
    return { baselineTs: existing.baseline_ts, created: false };
  }
  db.prepare(
    `INSERT INTO chain_fill_watch_state (chain_wallet, agent_id, baseline_ts, last_polled_at)
     VALUES (?, ?, ?, datetime('now'))`,
  ).run(wallet, agent.id, nowTs);
  return { baselineTs: nowTs, created: true };
}

/**
 * One watcher tick — safe to call from a cron every 1–2 minutes.
 */
export async function runChainFillWatcher(): Promise<WatcherRunResult> {
  const result: WatcherRunResult = {
    ok: true,
    enabled: watcherEnabled(),
    wallets: 0,
    baselined: 0,
    candidates: 0,
    posted: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  if (!result.enabled) return result;

  const nowTs = Math.floor(Date.now() / 1000);
  const agents = listWatchTargets();
  result.wallets = agents.length;

  for (const agent of agents) {
    const wallet = agent.chain_wallet;
    if (!wallet || !isAddress(wallet)) continue;

    const { baselineTs, created } = ensureBaseline(agent, nowTs);
    if (created) {
      result.baselined += 1;
      // First sight — do not backfill history
      continue;
    }

    let transfers: BlockscoutTokenTx[];
    try {
      transfers = await fetchTokenTxs(wallet);
    } catch (err) {
      result.failed += 1;
      result.errors.push(err instanceof Error ? err.message : String(err));
      continue;
    }

    const fills = detectFillsForWallet(wallet, transfers, baselineTs);
    result.candidates += fills.length;

    for (const fill of fills) {
      if (txAlreadyHandled(agent.id, fill.txHash)) {
        result.skipped += 1;
        continue;
      }

      try {
        const posted = await postDetectedFill(agent, fill);
        if (posted.ok) {
          markTx(agent.id, fill.txHash, "posted", null, {
            contract: fill.contract,
            side: fill.side,
            postId: posted.postId,
          });
          result.posted += 1;
        } else {
          markTx(agent.id, fill.txHash, posted.skip ? "skipped" : "failed", posted.error, {
            contract: fill.contract,
            side: fill.side,
          });
          if (posted.skip) result.skipped += 1;
          else {
            result.failed += 1;
            result.errors.push(`${fill.txHash.slice(0, 10)}: ${posted.error}`);
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        markTx(agent.id, fill.txHash, "failed", msg, {
          contract: fill.contract,
          side: fill.side,
        });
        result.failed += 1;
        result.errors.push(`${fill.txHash.slice(0, 10)}: ${msg}`);
      }
    }
  }

  // Touch so dead-code / tree-shake doesn't drop helpers used in ops responses elsewhere
  return result;
}
