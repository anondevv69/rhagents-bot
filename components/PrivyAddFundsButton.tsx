"use client";

import { useState } from "react";
import { useAddFunds } from "@privy-io/react-auth";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import {
  BASE_CAIP2,
  BASE_USDC,
  PRIVY_FUND_DEFAULT_USD,
} from "@/lib/privy-funding-constants";
import { PRIVY_APP_ID } from "@/components/PrivyAuthProvider";

/**
 * Opens Privy's fiat onramp — card / Apple Pay → USDC on Base in the user's embedded wallet.
 * Enable funding in the Privy dashboard (Account Funding → Stripe / MoonPay).
 */
export function PrivyAddFundsButton({
  label = `Add $${PRIVY_FUND_DEFAULT_USD} with card →`,
  onFunded,
}: {
  label?: string;
  onFunded?: () => void;
}) {
  const { ready, authenticated, login } = usePrivy();
  const { wallets } = useWallets();
  const { addFunds } = useAddFunds();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!PRIVY_APP_ID) return null;

  async function onClick() {
    setError(null);
    if (!authenticated) {
      login();
      return;
    }
    const wallet = wallets[0];
    if (!wallet?.address) {
      setError("Wallet not ready yet — wait a moment and try again.");
      return;
    }
    setBusy(true);
    try {
      await addFunds({
        destination: {
          address: wallet.address,
          chain: BASE_CAIP2,
          asset: BASE_USDC,
        },
        fiat: {
          source: { assets: ["usd"], defaultAsset: "usd" },
          defaultAmount: PRIVY_FUND_DEFAULT_USD,
        },
      });
      setDone(true);
      onFunded?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!/cancel|exit|closed/i.test(msg)) {
        setError(msg || "Funding did not complete — try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        className="btn btn-primary"
        style={{ width: "100%" }}
        disabled={!ready || busy}
        onClick={() => void onClick()}
      >
        {busy ? "Opening payment…" : done ? "Add more funds →" : label}
      </button>
      <p className="gate-normie-note">
        Card or Apple Pay via Privy — USDC lands in your wallet on Base. We then send a small amount
        of ETH on Robinhood Chain so you can swap for {`$rhagent`}.
      </p>
      {error ? <p className="login-code-error">{error}</p> : null}
    </div>
  );
}
