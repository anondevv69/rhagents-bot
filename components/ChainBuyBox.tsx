"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  executeEthToTokenSwap,
  walletErrorMessage,
  type SwapQuoteClient,
} from "@/lib/browser-uniswap-swap";

type QuoteResponse = SwapQuoteClient & {
  ok?: boolean;
  error?: string;
  message?: string;
  notional_usd?: number | null;
  eth_usd?: number | null;
  slippage_bps?: number;
};

type Props = {
  symbol: string;
  contract: string;
  loggedIn: boolean;
  /** Copy-trade: original post id */
  parentId?: string | null;
  /** Prefill ETH amount */
  defaultAmountEth?: string;
  loginHref?: string;
  nextPath?: string;
  /** Compact mode for modal / copy-trade */
  compact?: boolean;
  onDone?: (result: { post_url?: string; tx_hash?: string }) => void;
};

const PRESETS = ["0.001", "0.005", "0.01"] as const;

/**
 * One-click Uniswap V2 buy (ETH → token) for logged-in MetaMask Chain users.
 * Optional thesis posts as trade_fill via /api/viewer/trade-post after the swap.
 */
export function ChainBuyBox({
  symbol,
  contract,
  loggedIn,
  parentId,
  defaultAmountEth = "0.001",
  loginHref = "/login",
  nextPath,
  compact = false,
  onDone,
}: Props) {
  const router = useRouter();
  const [amountEth, setAmountEth] = useState(defaultAmountEth);
  const [thesis, setThesis] = useState(
    parentId ? "Copied this trade." : "",
  );
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const loginNext =
    nextPath ?? `/tickers/${encodeURIComponent(symbol)}?product=chain`;

  const refreshQuote = useCallback(async () => {
    if (!loggedIn || !contract) return;
    setQuoting(true);
    setQuoteError(null);
    try {
      const q = new URLSearchParams({
        token: contract,
        amount_eth: amountEth,
      });
      const res = await fetch(`/api/viewer/swap/quote?${q}`);
      const data = (await res.json()) as QuoteResponse;
      if (!res.ok || data.ok === false) {
        setQuote(null);
        setQuoteError(data.message || data.error || `Quote failed (${res.status})`);
        return;
      }
      setQuote(data);
    } catch (err) {
      setQuote(null);
      setQuoteError(err instanceof Error ? err.message : "Quote failed");
    } finally {
      setQuoting(false);
    }
  }, [loggedIn, contract, amountEth]);

  useEffect(() => {
    if (!loggedIn) return;
    const t = setTimeout(() => {
      void refreshQuote();
    }, 400);
    return () => clearTimeout(t);
  }, [loggedIn, refreshQuote]);

  async function buy(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !loggedIn) return;
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      let q = quote;
      if (!q?.calldata) {
        setStatus("Getting quote…");
        const params = new URLSearchParams({ token: contract, amount_eth: amountEth });
        const res = await fetch(`/api/viewer/swap/quote?${params}`);
        const data = (await res.json()) as QuoteResponse;
        if (!res.ok || data.ok === false) {
          throw new Error(data.message || data.error || "Quote failed");
        }
        q = data;
        setQuote(data);
      }

      setStatus("Confirm swap in MetaMask…");
      const { txHash } = await executeEthToTokenSwap(q);

      setStatus("Posting fill…");
      const thesisText = thesis.trim();
      const ethIn = Number(q.amountInEth);
      const notional =
        q.notional_usd != null && Number.isFinite(q.notional_usd)
          ? q.notional_usd
          : Number.isFinite(ethIn)
            ? ethIn * (q.eth_usd && q.eth_usd > 0 ? q.eth_usd : 2500)
            : null;
      const postRes = await fetch("/api/viewer/trade-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product: "chain",
          symbol: contract,
          side: "buy",
          quantity: q.amountOut,
          notional_usd: notional != null ? String(Math.max(notional, 0.01)) : undefined,
          thesis: thesisText || undefined,
          parent_id: parentId || undefined,
          tx_hash: txHash,
          via: "rhagent_web_wallet",
        }),
      });
      const postData = (await postRes.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        message?: string;
        post_url?: string;
      };
      if (!postRes.ok || postData.ok === false) {
        throw new Error(
          postData.message ||
            postData.error ||
            `Swap sent (${txHash.slice(0, 10)}…) but fill post failed (${postRes.status})`,
        );
      }

      setStatus("Done");
      setThesis(parentId ? "Copied this trade." : "");
      onDone?.({ post_url: postData.post_url, tx_hash: txHash });
      router.refresh();
    } catch (err) {
      setError(walletErrorMessage(err, "Buy failed"));
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  if (!contract || !/^0x[a-fA-F0-9]{40}$/i.test(contract)) {
    return null;
  }

  if (!loggedIn) {
    return (
      <div className={`panel chain-buy${compact ? " chain-buy--compact" : ""}`}>
        <p className="owner-settings-note" style={{ marginBottom: 10 }}>
          Log in with MetaMask to buy ${symbol} on Uniswap (Robinhood Chain) in one click.
        </p>
        <a href={`${loginHref}?next=${encodeURIComponent(loginNext)}`} className="btn btn-primary">
          Log in with MetaMask
        </a>
      </div>
    );
  }

  return (
    <form
      className={`panel chain-buy${compact ? " chain-buy--compact" : ""}`}
      onSubmit={buy}
    >
      <label
        className="owner-settings-note"
        htmlFor={compact ? `chain-buy-amt-${contract}` : "chain-buy-amount"}
        style={{ display: "block", marginBottom: 8 }}
      >
        Buy ${symbol} on Uniswap
        <span style={{ opacity: 0.7 }}> — ETH → token (Uniswap on Robinhood Chain)</span>
      </label>

      <div className="chain-buy-row" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <input
          id={compact ? `chain-buy-amt-${contract}` : "chain-buy-amount"}
          className="input"
          type="text"
          inputMode="decimal"
          value={amountEth}
          onChange={(e) => setAmountEth(e.target.value)}
          disabled={busy}
          aria-label="ETH amount"
          style={{ width: 120 }}
        />
        <span className="owner-settings-note" style={{ alignSelf: "center" }}>
          ETH
        </span>
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => setAmountEth(p)}
            style={{ padding: "6px 10px", fontSize: 12 }}
          >
            {p}
          </button>
        ))}
      </div>

      <div className="owner-settings-note" style={{ marginBottom: 10, minHeight: 20 }}>
        {quoting
          ? "Quoting…"
          : quoteError
            ? quoteError
            : quote
              ? `≈ ${Number(quote.amountOut).toLocaleString(undefined, { maximumFractionDigits: 4 })} ${symbol}${
                  quote.notional_usd != null
                    ? ` · ~$${quote.notional_usd.toFixed(2)}`
                    : ""
                } · ${quote.slippage_bps != null ? `${(Number(quote.slippage_bps) / 100).toFixed(1)}%` : "1%"} slip`
              : null}
      </div>

      <textarea
        className="input"
        rows={compact ? 2 : 3}
        maxLength={1000}
        value={thesis}
        onChange={(e) => setThesis(e.target.value)}
        placeholder={
          parentId
            ? "Optional thesis (copy-trade)…"
            : "Optional thesis to post with this buy…"
        }
        disabled={busy}
        style={{ width: "100%", resize: "vertical", marginBottom: 10 }}
      />

      {error ? (
        <p className="owner-settings-note" style={{ color: "var(--danger, #e55)", marginBottom: 8 }}>
          {error}
        </p>
      ) : null}
      {status && !error ? (
        <p className="owner-settings-note" style={{ marginBottom: 8 }}>
          {status}
        </p>
      ) : null}

      <button
        type="submit"
        className="btn btn-primary"
        disabled={busy || quoting || !!quoteError || !amountEth}
      >
        {busy ? "Buying…" : parentId ? "Copy trade on Uniswap" : "Buy on Uniswap"}
      </button>
    </form>
  );
}
