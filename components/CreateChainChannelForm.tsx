"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  loggedIn: boolean;
  loginHref?: string;
};

/**
 * Create / open a Chain ticker channel from a Robinhood Chain ERC-20 contract.
 */
export function CreateChainChannelForm({ loggedIn, loginHref = "/login" }: Props) {
  const router = useRouter();
  const [contract, setContract] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const ca = contract.trim();
    if (!ca || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/viewer/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contract: ca }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        message?: string;
        hint?: string;
        channel_url?: string;
        symbol?: string;
      };
      if (!res.ok || data.ok === false) {
        throw new Error(data.message || data.hint || data.error || `Failed (${res.status})`);
      }
      if (data.symbol) {
        router.push(`/tickers/${encodeURIComponent(data.symbol)}?product=chain`);
        router.refresh();
      } else if (data.channel_url) {
        window.location.href = data.channel_url;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create channel");
    } finally {
      setBusy(false);
    }
  }

  if (!loggedIn) {
    return (
      <div className="panel" style={{ marginBottom: 20 }}>
        <h2 className="owner-settings-heading" style={{ marginTop: 0 }}>
          Create a Chain channel
        </h2>
        <p className="owner-settings-note">
          Connect your wallet, hold ≈$10 of $RHAGENT, and hold any amount of the token to open its
          room.
        </p>
        <a
          href={`${loginHref}?next=${encodeURIComponent("/tickers?product=chain")}`}
          className="btn btn-outline"
        >
          Connect wallet
        </a>
      </div>
    );
  }

  return (
    <form className="panel" style={{ marginBottom: 20 }} onSubmit={submit}>
      <h2 className="owner-settings-heading" style={{ marginTop: 0 }}>
        Create a Chain channel
      </h2>
      <p className="owner-settings-note">
        Paste an on-chain ERC-20 contract. You must hold that token and $RHAGENT.
      </p>
      <input
        type="text"
        className="input"
        placeholder="0x…"
        value={contract}
        onChange={(e) => setContract(e.target.value)}
        disabled={busy}
        autoComplete="off"
        spellCheck={false}
        style={{ width: "100%", marginBottom: 10, fontFamily: "monospace" }}
      />
      {error ? (
        <p className="owner-settings-note" style={{ color: "var(--danger, #e55)", marginBottom: 8 }}>
          {error}
        </p>
      ) : null}
      <button type="submit" className="btn btn-primary" disabled={busy || !contract.trim()}>
        {busy ? "Opening…" : "Open channel"}
      </button>
    </form>
  );
}
