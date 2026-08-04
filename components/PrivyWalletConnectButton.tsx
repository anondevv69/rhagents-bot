"use client";

import { useEffect, useRef, useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { PRIVY_APP_ID } from "@/components/PrivyAuthProvider";

/**
 * Prove Privy embedded wallet ownership and attach chain_wallet to the current session
 * (merges with X / agent-code login — does not replace your human identity).
 */
export function PrivyWalletConnectButton({
  label = "Connect Privy wallet →",
  onConnected,
}: {
  label?: string;
  onConnected?: (wallet: string) => void;
}) {
  const { ready, authenticated, login } = usePrivy();
  const { wallets } = useWallets();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef(false);

  async function connectWallet() {
    const wallet = wallets[0];
    if (!wallet) return;
    setBusy(true);
    setError(null);
    try {
      const address = wallet.address;
      const chRes = await fetch(`/api/agent/chain/challenge?wallet=${encodeURIComponent(address)}`);
      const ch = (await chRes.json()) as {
        ok?: boolean;
        error?: string;
        nonce?: string;
        message?: string;
        wallet?: string;
      };
      if (!chRes.ok || !ch.ok || !ch.nonce || !ch.message) {
        setError(ch.error ?? "Could not create signing challenge");
        return;
      }

      const provider = await wallet.getEthereumProvider();
      const signature = (await provider.request({
        method: "personal_sign",
        params: [ch.message, address],
      })) as string;

      const res = await fetch("/api/viewer/wallet/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          chain_wallet: ch.wallet ?? address,
          nonce: ch.nonce,
          signature,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; chain_wallet?: string };
      if (!res.ok || !data.ok || !data.chain_wallet) {
        setError(data.error ?? "Could not connect wallet");
        return;
      }
      onConnected?.(data.chain_wallet);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connect failed");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (pendingRef.current && authenticated && wallets.length > 0) {
      pendingRef.current = false;
      void connectWallet();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated, wallets.length]);

  if (!PRIVY_APP_ID) return null;

  return (
    <div>
      <button
        type="button"
        className="btn btn-primary"
        style={{ width: "100%" }}
        disabled={!ready || busy}
        onClick={() => {
          setError(null);
          if (authenticated && wallets.length > 0) {
            void connectWallet();
            return;
          }
          pendingRef.current = true;
          if (!authenticated) login();
        }}
      >
        {busy ? "Connecting wallet…" : label}
      </button>
      <p className="gate-normie-note">
        Uses your Privy embedded wallet — one signature ties it to this account without changing your X or agent login.
      </p>
      {error ? <p className="login-code-error">{error}</p> : null}
    </div>
  );
}
