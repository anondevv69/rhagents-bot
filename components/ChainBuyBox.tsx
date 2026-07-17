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

type Mode = "buy" | "post";

type Props = {
  symbol: string;
  contract?: string | null;
  loggedIn: boolean;
  /** Copy-trade: original post id */
  parentId?: string | null;
  /** Prefill ETH amount */
  defaultAmountEth?: string;
  loginHref?: string;
  nextPath?: string;
  /** Compact mode for modal / copy-trade (buy-only) */
  compact?: boolean;
  /**
   * Ticker-page mode: one panel for Buy on Uniswap (+ optional thesis) or Post thesis only.
   * Ignored when compact / parentId (copy-trade stays buy-focused).
   */
  combined?: boolean;
  onDone?: (result: { post_url?: string; tx_hash?: string }) => void;
};

const PRESETS = ["0.001", "0.005", "0.01"] as const;

/**
 * Normie Chain actions: Uniswap buy with optional thesis, and/or post-only thesis.
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
  combined = false,
  onDone,
}: Props) {
  const router = useRouter();
  const hasContract = !!(contract && /^0x[a-fA-F0-9]{40}$/i.test(contract));
  const showCombined = combined && !compact && !parentId;
  const [mode, setMode] = useState<Mode>(hasContract ? "buy" : "post");
  const [amountEth, setAmountEth] = useState(defaultAmountEth);
  const [thesis, setThesis] = useState(parentId ? "Copied this trade." : "");
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const loginNext =
    nextPath ?? `/tickers/${encodeURIComponent(symbol)}?product=chain`;

  const refreshQuote = useCallback(async () => {
    if (!loggedIn || !hasContract || !contract) return;
    if (showCombined && mode !== "buy") return;
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
  }, [loggedIn, hasContract, contract, amountEth, showCombined, mode]);

  useEffect(() => {
    if (!loggedIn || !hasContract) return;
    if (showCombined && mode !== "buy") return;
    const t = setTimeout(() => {
      void refreshQuote();
    }, 400);
    return () => clearTimeout(t);
  }, [loggedIn, hasContract, showCombined, mode, refreshQuote]);

  async function postThesisOnly() {
    const text = thesis.trim();
    if (!text) throw new Error("Write a thesis to post.");
    const res = await fetch("/api/viewer/post", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product: "chain",
        symbol: hasContract && contract ? contract : symbol,
        body: text,
        type: parentId ? "comment" : "general",
        parent_id: parentId || undefined,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      message?: string;
      post_url?: string;
    };
    if (!res.ok || data.ok === false) {
      throw new Error(data.message || data.error || `Post failed (${res.status})`);
    }
    return data;
  }

  async function buyWithThesis() {
    if (!hasContract || !contract) throw new Error("Missing token contract.");
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
    return { ...postData, tx_hash: txHash };
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !loggedIn) return;
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const doPost = showCombined ? mode === "post" : false;
      if (doPost || !hasContract) {
        setStatus("Posting…");
        const data = await postThesisOnly();
        setThesis("");
        setStatus("Done");
        onDone?.({ post_url: data.post_url });
        router.refresh();
        return;
      }

      const data = await buyWithThesis();
      setStatus("Done");
      setThesis(parentId ? "Copied this trade." : "");
      onDone?.({ post_url: data.post_url, tx_hash: data.tx_hash });
      router.refresh();
    } catch (err) {
      setError(walletErrorMessage(err, doPostLabel(showCombined, mode, hasContract)));
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  if (!showCombined && !hasContract) {
    return null;
  }

  if (!loggedIn) {
    return (
      <div className={`panel chain-buy${compact ? " chain-buy--compact" : ""}`}>
        <p className="owner-settings-note" style={{ marginBottom: 10 }}>
          {showCombined
            ? `Log in with MetaMask to buy $${symbol} on Uniswap or post a thesis. Need ≈$10 of $rhagent${hasContract ? " (and the token to post-only)" : ""}.`
            : `Log in with MetaMask to buy $${symbol} on Uniswap (Robinhood Chain) in one click.`}
        </p>
        <a href={`${loginHref}?next=${encodeURIComponent(loginNext)}`} className="btn btn-primary">
          Log in with MetaMask
        </a>
      </div>
    );
  }

  const buyMode = !showCombined || mode === "buy";
  const postMode = showCombined && mode === "post";

  return (
    <form
      className={`panel chain-buy${compact ? " chain-buy--compact" : ""}${showCombined ? " chain-buy--combined" : ""}`}
      onSubmit={onSubmit}
    >
      {showCombined ? (
        <div className="chain-buy-modes" role="tablist" aria-label="Buy or post">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "buy"}
            className={`chain-buy-mode${mode === "buy" ? " chain-buy-mode--active" : ""}`}
            disabled={!hasContract || busy}
            onClick={() => {
              setMode("buy");
              setError(null);
              setStatus(null);
            }}
          >
            Buy + thesis
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "post"}
            className={`chain-buy-mode${mode === "post" ? " chain-buy-mode--active" : ""}`}
            disabled={busy}
            onClick={() => {
              setMode("post");
              setError(null);
              setStatus(null);
            }}
          >
            Post only
          </button>
        </div>
      ) : (
        <label
          className="owner-settings-note"
          htmlFor={compact ? `chain-buy-amt-${contract}` : "chain-buy-amount"}
          style={{ display: "block", marginBottom: 8 }}
        >
          Buy ${symbol} on Uniswap
          <span style={{ opacity: 0.7 }}> — ETH → token (Uniswap on Robinhood Chain)</span>
        </label>
      )}

      {buyMode && hasContract ? (
        <>
          {showCombined ? (
            <p className="owner-settings-note" style={{ marginBottom: 8 }}>
              Buy ${symbol} on Uniswap, then post the fill
              {thesis.trim() ? " with your thesis" : ""}.
            </p>
          ) : null}
          <div
            className="chain-buy-row"
            style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}
          >
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
                      quote.notional_usd != null ? ` · ~$${quote.notional_usd.toFixed(2)}` : ""
                    } · ${quote.slippage_bps != null ? `${(Number(quote.slippage_bps) / 100).toFixed(1)}%` : "1%"} slip`
                  : null}
          </div>
        </>
      ) : null}

      {postMode ? (
        <p className="owner-settings-note" style={{ marginBottom: 8 }}>
          Post in ${symbol}
          <span style={{ opacity: 0.7 }}> — requires $rhagent + holding this token</span>
        </p>
      ) : null}

      <textarea
        className="input"
        rows={compact ? 2 : 3}
        maxLength={1000}
        value={thesis}
        onChange={(e) => setThesis(e.target.value)}
        placeholder={
          parentId
            ? "Optional thesis (copy-trade)…"
            : postMode
              ? "Share a thesis, update, or comment…"
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
        disabled={
          busy ||
          (buyMode && hasContract
            ? quoting || !!quoteError || !amountEth
            : !thesis.trim())
        }
      >
        {busy
          ? buyMode && hasContract
            ? "Buying…"
            : "Posting…"
          : parentId
            ? "Copy trade on Uniswap"
            : buyMode && hasContract
              ? "Buy on Uniswap"
              : "Post"}
      </button>
    </form>
  );
}

function doPostLabel(showCombined: boolean, mode: Mode, hasContract: boolean): string {
  if (showCombined && mode === "post") return "Post failed";
  if (!hasContract) return "Post failed";
  return "Buy failed";
}
