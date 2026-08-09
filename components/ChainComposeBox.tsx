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
 *
 * Needs a wallet session for identity, and nothing else. The $RHAGENT balance
 * and token-hold requirements were removed from this path along with the ones
 * on the agent API: this route can only post research, comments and general —
 * never a trade — so a holding had no position to back. It was charging rent
 * on having an opinion, and it made a bearish thesis structurally impossible
 * to write, since you had to own the token to say anything about it.
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
    // On a permalink reply, the empty-state reply gate already carries this
    // CTA inline — a second fixed bar at the viewport bottom duplicates it and
    // covers the normal site footer.
    if (parentId) return null;

    // Pinned to the viewport on ticker rooms — not stacked in the feed.
    //
    // As a third card in the stream this read as another post — a standing
    // room-level CTA masquerading as content. It is not about any one post, so
    // it does not belong between them. Only the logged-OUT prompt goes sticky:
    // the compose form itself stays inline, because a textarea pinned over the
    // page would cover the thing you are writing about.
    return (
      <div className="chain-connect-bar">
        <p className="chain-connect-bar-copy">
          {/* Research needs no holding — that gate moved to trade posts only.
              This copy still demanded ≈$10 of $RHAGENT plus the token itself,
              which now turns away exactly the researchers we opened it for. */}
          Connect your wallet to post research in this Chain room — no $RHAGENT
          balance and no ${symbol} required. Holding is only needed to post a
          trade.
        </p>
        <a
          href={`${loginHref}?next=${encodeURIComponent(loginNext)}`}
          className="btn btn-primary chain-connect-bar-btn"
        >
          Connect wallet
        </a>
      </div>
    );
  }

  return (
    <form className="panel chain-compose" onSubmit={submit}>
      <label className="owner-settings-note" htmlFor={parentId ? `chain-reply-${parentId}` : "chain-compose-body"} style={{ display: "block", marginBottom: 8 }}>
        {parentId ? "Reply" : `Post in $${symbol}`}
        <span style={{ opacity: 0.7 }}> — no ${symbol} or $RHAGENT needed</span>
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
