"use client";

import { useState } from "react";

export type ChainWalletProof = {
  chain_wallet: string;
  nonce: string;
  signature: string;
};

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

function getEthereum(): EthereumProvider | null {
  if (typeof window === "undefined") return null;
  const eth = (window as Window & { ethereum?: EthereumProvider }).ethereum;
  return eth ?? null;
}

function shortAddr(addr: string) {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/**
 * Connect a Robinhood Chain wallet by signing a challenge — never by pasting an address alone.
 */
export function ChainWalletConnect({
  currentWallet,
  hasChain,
  disabled,
  onLinked,
  submitProof,
}: {
  currentWallet?: string | null;
  hasChain?: boolean;
  disabled?: boolean;
  /** Called after a successful link (parent can refresh). */
  onLinked?: (wallet: string) => void;
  /** POST proof to your auth path (owner session or dashboard proxy). */
  submitProof: (proof: ChainWalletProof) => Promise<{
    ok?: boolean;
    chain_wallet?: string;
    error?: string;
    message?: string;
    buy_url?: string;
  }>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [buyUrl, setBuyUrl] = useState<string | null>(null);
  const [linkedWallet, setLinkedWallet] = useState<string | null>(currentWallet ?? null);

  const shown = linkedWallet ?? currentWallet ?? null;
  const connected = Boolean(hasChain && shown);

  async function connectAndSign() {
    setBusy(true);
    setError(null);
    setBuyUrl(null);
    try {
      const eth = getEthereum();
      if (!eth) {
        setError("Install a browser wallet (MetaMask, Rabby, etc.) that supports ethereum.request.");
        return;
      }

      const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
      const address = accounts?.[0]?.trim();
      if (!address) {
        setError("No wallet account returned — unlock your wallet and try again.");
        return;
      }

      const challengeRes = await fetch(
        `/api/agent/chain/challenge?wallet=${encodeURIComponent(address)}`,
      );
      const challenge = (await challengeRes.json()) as {
        ok?: boolean;
        error?: string;
        nonce?: string;
        message?: string;
        wallet?: string;
      };
      if (!challengeRes.ok || !challenge.ok || !challenge.nonce || !challenge.message) {
        setError(challenge.error ?? "Could not create signing challenge");
        return;
      }

      const signature = (await eth.request({
        method: "personal_sign",
        params: [challenge.message, address],
      })) as string;

      const result = await submitProof({
        chain_wallet: challenge.wallet ?? address,
        nonce: challenge.nonce,
        signature,
      });

      if (!result.ok) {
        setError(result.message ?? result.error ?? "Could not verify wallet");
        if (result.buy_url) setBuyUrl(result.buy_url);
        return;
      }

      const wallet = result.chain_wallet ?? address;
      setLinkedWallet(wallet);
      onLinked?.(wallet);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Wallet connect failed";
      if (/user rejected|denied|cancel/i.test(msg)) {
        setError("Signature cancelled — you must sign to prove you own the wallet.");
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="chain-wallet-connect">
      <div className="owner-settings-conn">
        <span className="owner-settings-conn-label">Robinhood Chain wallet</span>
        <span className={`owner-settings-conn-status${connected ? " is-on" : ""}`}>
          {connected ? "Verified" : "Not linked"}
        </span>
        {shown ? (
          <span className="owner-settings-conn-detail">{shortAddr(shown)}</span>
        ) : (
          <span className="owner-settings-conn-detail">
            Sign with your browser wallet — pasting an address is not accepted
          </span>
        )}
      </div>
      <p className="owner-settings-note">
        We issue a one-time challenge and require a{" "}
        <code>personal_sign</code> from the wallet that holds $rhagent (≥1M tokens or ~$10). That
        proves control — anyone can copy a public address.
      </p>
      <button
        type="button"
        className="btn btn-primary"
        disabled={disabled || busy}
        onClick={() => void connectAndSign()}
      >
        {busy
          ? "Waiting for signature…"
          : connected
            ? "Reconnect / change wallet"
            : "Connect wallet & sign"}
      </button>
      {error ? <p className="owner-settings-error">{error}</p> : null}
      {buyUrl ? (
        <p className="owner-settings-note">
          Need $rhagent?{" "}
          <a href={buyUrl} className="text-link" target="_blank" rel="noreferrer">
            Buy on DexScreener
          </a>
        </p>
      ) : null}
    </div>
  );
}
