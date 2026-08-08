"use client";

import { useState } from "react";
import { WalletSafetyNote } from "./WalletSafetyNote";
import {
  ensureRobinhoodChain,
  ethRequest,
  fetchTimeout,
  getEthereum,
  walletErrorMessage,
} from "@/lib/browser-ethereum";

export type ChainWalletProof = {
  chain_wallet: string;
  nonce: string;
  signature: string;
};

type Status = "idle" | "connecting" | "challenge" | "signing" | "verifying";

const STATUS_LABEL: Record<Exclude<Status, "idle">, string> = {
  connecting: "Connecting wallet…",
  challenge: "Requesting challenge…",
  signing: "Waiting for signature…",
  verifying: "Verifying wallet…",
};

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
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [buyUrl, setBuyUrl] = useState<string | null>(null);
  const [linkedWallet, setLinkedWallet] = useState<string | null>(currentWallet ?? null);

  const shown = linkedWallet ?? currentWallet ?? null;
  const connected = Boolean(hasChain && shown);
  const busy = status !== "idle";

  async function connectAndSign() {
    setStatus("connecting");
    setError(null);
    setBuyUrl(null);
    try {
      const eth = getEthereum();
      if (!eth) {
        setError(
          "Install a browser wallet (MetaMask, Rabby, etc.), then refresh this page.",
        );
        return;
      }

      const accounts = (await ethRequest(
        eth,
        { method: "eth_requestAccounts" },
        "Timed out waiting for wallet connect — unlock MetaMask and check for a popup, then try again.",
      )) as string[];
      const address = accounts?.[0]?.trim();
      if (!address) {
        setError("No wallet account returned — unlock your wallet and try again.");
        return;
      }

      void ensureRobinhoodChain(eth);

      setStatus("challenge");
      const challengeRes = await fetch(
        `/api/agent/chain/challenge?wallet=${encodeURIComponent(address)}`,
        { signal: fetchTimeout() },
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

      setStatus("signing");
      const signature = (await ethRequest(
        eth,
        {
          method: "personal_sign",
          params: [challenge.message, address],
        },
        "Timed out waiting for signature — open MetaMask and approve the sign request, then try again.",
      )) as string;

      setStatus("verifying");
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
      setError(walletErrorMessage(err));
    } finally {
      setStatus("idle");
    }
  }

  return (
    <div className="chain-wallet-connect">
      <div className="owner-settings-conn">
        <span className="owner-settings-conn-label">Verified chain wallet</span>
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
        <code>personal_sign</code> from the wallet that holds $RHAGENT (≥1M tokens or ~$10). That
        proves control — anyone can copy a public address. If nothing pops up, open your wallet
        extension.
      </p>
      <button
        type="button"
        className="btn btn-primary"
        disabled={disabled || busy}
        onClick={() => void connectAndSign()}
      >
        {busy
          ? STATUS_LABEL[status]
          : connected
            ? "Reconnect / change wallet"
            : "Connect wallet (sign only)"}
      </button>
      <WalletSafetyNote className="owner-settings-note" />
      {error ? <p className="owner-settings-error">{error}</p> : null}
      {buyUrl ? (
        <p className="owner-settings-note">
          Need $RHAGENT?{" "}
          <a href={buyUrl} className="text-link" target="_blank" rel="noreferrer">
            Buy on DexScreener
          </a>
        </p>
      ) : null}
    </div>
  );
}
