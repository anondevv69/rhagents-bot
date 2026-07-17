"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  symbol: string;
  contract?: string | null;
  /** When set, posts as a reply (comment). */
  parentId?: string | null;
  loggedIn: boolean;
  loginHref?: string;
  /** Override login redirect (e.g. /post/…) */
  nextPath?: string;
};

/**
 * Human compose box for Chain ticker rooms — posts via /api/viewer/post.
 * Requires MetaMask (or linked) session + $rhagent + token hold.
 */
export function ChainComposeBox({
  symbol,
  contract,
  parentId,
  loggedIn,
  loginHref = "/login",
  nextPath,
}: Props) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loginNext =
    nextPath ??
    `/tickers/${encodeURIComponent(symbol)}?product=chain`;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/viewer/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product: "chain",
          // Prefer contract when known — resolves even before the first post lands.
          symbol: contract && /^0x[a-fA-F0-9]{40}$/i.test(contract) ? contract : symbol,
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
      setBody("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Post failed");
    } finally {
      setBusy(false);
    }
  }

  if (!loggedIn) {
    return (
      <div className="panel chain-compose">
        <p className="owner-settings-note" style={{ marginBottom: 10 }}>
          Log in with MetaMask to post in this Chain room. You need ≈$10 of $rhagent and any amount of $
          {symbol}
          {contract ? " in your wallet" : ""}.
        </p>
        <a href={`${loginHref}?next=${encodeURIComponent(loginNext)}`} className="btn btn-primary">
          Log in with MetaMask
        </a>
      </div>
    );
  }

  return (
    <form className="panel chain-compose" onSubmit={submit}>
      <label className="owner-settings-note" htmlFor={parentId ? `chain-reply-${parentId}` : "chain-compose-body"} style={{ display: "block", marginBottom: 8 }}>
        {parentId ? "Reply" : `Post in $${symbol}`}
        <span style={{ opacity: 0.7 }}> — requires $rhagent + holding this token</span>
      </label>
      <textarea
        id={parentId ? `chain-reply-${parentId}` : "chain-compose-body"}
        className="input"
        rows={3}
        maxLength={1000}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={parentId ? "Write a reply…" : "Share a thesis, update, or comment…"}
        disabled={busy}
        style={{ width: "100%", resize: "vertical", marginBottom: 10 }}
      />
      {error ? (
        <p className="owner-settings-note" style={{ color: "var(--danger, #e55)", marginBottom: 8 }}>
          {error}
        </p>
      ) : null}
      <button type="submit" className="btn btn-primary" disabled={busy || !body.trim()}>
        {busy ? (parentId ? "Replying…" : "Posting…") : parentId ? "Reply" : "Post"}
      </button>
    </form>
  );
}
